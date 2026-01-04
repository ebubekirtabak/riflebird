import { ProjectCacheManager, CACHE_FILE, CACHE_FOLDER } from '../project-cache-manager';
import { ProjectContext } from '@models/project-context';
import { ProjectFileWalker } from '@utils';
import { ProjectConfigFiles, ConfigFile } from '@models/project-config-files';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, vi, type Mocked, type Mock } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises');
const mockedFs = fs as unknown as Mocked<typeof fs>;

// Mock utils
vi.mock('@utils', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  ProjectFileWalker: vi.fn().mockImplementation(() => ({
    readWithStats: vi.fn(),
  })),
}));

const createMockProjectConfigFiles = (): ProjectConfigFiles => {
  const mockConfigFile: ConfigFile = {
    type: 'test',
    configFile: 'test.json',
    configFilePath: 'test.json',
  };

  return {
    framework: mockConfigFile,
    language: 'typescript',
    packageManager: 'npm',
    libs: {
      core: [],
      testing: [],
      styling: [],
    },
    testFrameworks: {},
    linting: mockConfigFile,
    formatting: mockConfigFile,
    languageConfig: mockConfigFile,
    importantConfigFiles: {},
  };
};

describe('ProjectCacheManager', () => {
  const mockProjectRoot = '/test/project';
  const mockCacheDir = path.join(mockProjectRoot, CACHE_FOLDER);
  const mockCachePath = path.join(mockCacheDir, CACHE_FILE);
  let cacheManager: ProjectCacheManager;
  let mockContext: ProjectContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RIFLEBIRD_VERSION', '0.1.4');
    cacheManager = new ProjectCacheManager(mockProjectRoot);

    // Default valid context
    mockContext = {
      projectRoot: mockProjectRoot,
      configFiles: createMockProjectConfigFiles(),
      languageConfig: {
        configFilePath: 'tsconfig.json',
        configContent: '{ "compilerOptions": {} }',
      },
      linterConfig: {
        configFilePath: '.eslintrc.json',
        configContent: '{ "plugins": [] }',
      },
      formatterConfig: {
        configFilePath: '.prettierrc',
        configContent: '{ "singleQuote": true }',
      },
      packageManager: {
        type: 'npm',
        testCommand: 'npm test',
        packageFilePath: 'package.json',
        packageFileContent: '{}',
        packageFileLastModified: 1000,
      },
    };
  });

  describe('hasCache', () => {
    it('should return true when cache file exists', async () => {
      mockedFs.access.mockResolvedValue(undefined);

      const result = await cacheManager.hasCache();

      expect(result).toBe(true);
      expect(mockedFs.access).toHaveBeenCalledWith(mockCachePath);
    });

    it('should return false when cache file does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await cacheManager.hasCache();

      expect(result).toBe(false);
    });
  });

  describe('save', () => {
    it('should save project context to cache file', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await cacheManager.save(mockContext);

      expect(mockedFs.mkdir).toHaveBeenCalledWith(mockCacheDir, { recursive: true });
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        mockCachePath,
        expect.stringContaining('"projectRoot": "/test/project"'),
        'utf-8'
      );
    });

    it('should handle errors gracefully', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Write error'));

      await expect(cacheManager.save(mockContext)).resolves.not.toThrow();
    });
  });

  describe('load (Reconciliation Logic)', () => {
    let mockReadWithStats: Mock;

    beforeEach(async () => {
      // Setup ProjectFileWalker mock
      const { ProjectFileWalker } = await import('@utils');
      mockReadWithStats = vi.fn();

      vi.mocked(ProjectFileWalker).mockImplementation(
        () =>
          ({
            readWithStats: mockReadWithStats,
          }) as unknown as Mocked<ProjectFileWalker>
      );

      // Re-instantiate cacheManager to use the new mock
      cacheManager = new ProjectCacheManager(mockProjectRoot);

      // Default mock behaviors
      mockedFs.access.mockResolvedValue(undefined); // cache exists
      mockedFs.stat.mockResolvedValue({ mtimeMs: 1000 } as unknown as Stats); // default stat
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      // Default readWithStats behavior (valid files)
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        const pathStr = filePath.toString();
        // Return default content matching the mockContext for configs
        if (pathStr.endsWith('tsconfig.json'))
          return { content: mockContext.languageConfig.configContent!, stats: { mtimeMs: 1000 } };
        if (pathStr.endsWith('.eslintrc.json'))
          return { content: mockContext.linterConfig.configContent!, stats: { mtimeMs: 1000 } };
        if (pathStr.endsWith('.prettierrc'))
          return { content: mockContext.formatterConfig.configContent!, stats: { mtimeMs: 1000 } };
        if (pathStr.endsWith('package.json')) return { content: '{}', stats: { mtimeMs: 1000 } };

        // For custom files
        if (pathStr.endsWith('custom.json')) return { content: '{}', stats: { mtimeMs: 1000 } };

        throw new Error(`File not found: ${filePath}`);
      });

      // Default fs.readFile behavior (ONLY for cache.json)
      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath) {
          const contextWithMtime = {
            ...mockContext,
            riflebirdVersion: '0.1.4',
            languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
            linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
            formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
            packageManager: { ...mockContext.packageManager, packageFileLastModified: 1000 },
          };
          return Promise.resolve(JSON.stringify(contextWithMtime));
        }
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });
    });

    it('should return null if cache file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should return null if cache file read fails with generic error', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Generic failure'));
      const result = await cacheManager.load();
      expect(result).toBeNull();
      const debugMock = (await import('@utils')).debug;
      expect(debugMock).toHaveBeenCalledWith('Error loading cache:', expect.any(Error));
    });

    it('should return null if JSON parsing throws non-SyntaxError', async () => {
      const originParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementationOnce(() => {
        throw new Error('General Error');
      });

      try {
        const result = await cacheManager.load();
        expect(result).toBeNull();
        const debugMock = (await import('@utils')).debug;
        expect(debugMock).toHaveBeenCalledWith('Error loading cache:', expect.any(Error));
      } finally {
        JSON.parse = originParse;
      }
    });

    it('should return null and log invalidation message if cache file is corrupted', async () => {
      mockedFs.readFile.mockResolvedValue('{ invalid json }');
      const result = await cacheManager.load();

      expect(result).toBeNull();
      const debugMock = (await import('@utils')).debug;
      expect(debugMock).toHaveBeenCalledWith('Cache file corrupted, invalidating...');
    });

    it('should invalidate cache if version mismatches', async () => {
      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath) {
          const contextOld = {
            ...mockContext,
            riflebirdVersion: '0.0.0', // Mismatch
          };
          return Promise.resolve(JSON.stringify(contextOld));
        }
        return Promise.resolve('{}');
      });

      const result = await cacheManager.load();
      expect(result).toBeNull();
      const infoMock = (await import('@utils')).info;
      expect(infoMock).toHaveBeenCalledWith(expect.stringContaining('Riflebird version changed'));
    });

    it('should return context calling readWithStats checking mtime matches', async () => {
      const result = await cacheManager.load();

      // Should be identical to saved context (+ valid mtimes)
      expect(result).toEqual({
        ...mockContext,
        riflebirdVersion: '0.1.4',
        languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
        linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
        formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
        packageManager: { ...mockContext.packageManager, packageFileLastModified: 1000 },
      });

      // Should call readWithStats for all configs
      expect(mockReadWithStats).toHaveBeenCalledTimes(4); // tsconfig, eslintrc, prettierrc, package.json

      // Should NOT update cache
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });

    it('should READ file and UPDATE cache if mtime changed', async () => {
      const newTsConfig = '{ "compilerOptions": { "strict": true } }';

      // Mock ONLY tsconfig to have changed mtime and content
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.toString().endsWith('tsconfig.json')) {
          return { content: newTsConfig, stats: { mtimeMs: 2000 } };
        }
        // Others default
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.languageConfig.configContent).toBe(newTsConfig);
      expect(result?.languageConfig.lastModified).toBe(2000); // Updated

      expect(mockedFs.writeFile).toHaveBeenCalled(); // Should trigger save
    });

    it('should UPDATE cache mtime if mtime changed but content is same (touch)', async () => {
      // Content same but mtime changed
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.toString().endsWith('tsconfig.json')) {
          return { content: mockContext.languageConfig.configContent!, stats: { mtimeMs: 2000 } };
        }
        // Others default
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.languageConfig.lastModified).toBe(2000);

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should skip validation for framework with missing configFilePath', async () => {
      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath) {
          const contextMissingPath = {
            ...mockContext,
            riflebirdVersion: '0.1.4',
            languageConfig: {
              ...mockContext.languageConfig,
              configFilePath: undefined,
              lastModified: 1000,
            },
            // Ensure others are valid to pass
            linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
            formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
            packageManager: { ...mockContext.packageManager, packageFileLastModified: 1000 },
          };
          return Promise.resolve(JSON.stringify(contextMissingPath));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await cacheManager.load();
      expect(result).not.toBeNull();
      // Should NOT call readWithStats for tsconfig (undefined path)
      expect(mockReadWithStats).not.toHaveBeenCalledWith(expect.stringContaining('tsconfig.json'));
    });

    it('should INVALIDATE cache if a config file is missing check via readWithStats', async () => {
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.toString().endsWith('tsconfig.json')) {
          throw new Error('ENOENT');
        }
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should INVALIDATE cache if default package.json is missing check via readWithStats', async () => {
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.toString().endsWith('package.json')) {
          throw new Error('ENOENT');
        }
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should UPDATE cache if package file touched (mtime changed) but content same', async () => {
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.toString().endsWith('package.json')) {
          return { content: '{}', stats: { mtimeMs: 2000 } };
        }
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();
      expect(result?.packageManager?.packageFileLastModified).toBe(2000);
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should return invalid status if reconciliation process throws', async () => {
      const originParse = JSON.parse;
      let callCount = 0;
      JSON.parse = vi.fn().mockImplementation((arg) => {
        callCount++;
        if (callCount === 2) throw new Error('Reconciliation Error');
        return originParse(arg);
      });

      try {
        const result = await cacheManager.load();
        expect(result).toBeNull();
        const debugMock = (await import('@utils')).debug;
        expect(debugMock).toHaveBeenCalledWith('Cache validation error:', expect.any(Error));
      } finally {
        JSON.parse = originParse;
      }
    });

    it('should VALIDATE dynamic package file if present in cache checking mtime', async () => {
      const customPkgContext = {
        ...mockContext,
        riflebirdVersion: '0.1.4',
        packageManager: {
          ...mockContext.packageManager!,
          packageFilePath: 'custom.json',
          packageFileContent: '{}',
          packageFileLastModified: 1000,
        },
        languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
        linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
        formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(customPkgContext));

      // mock custom.json existence
      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('custom.json')) return { content: '{}', stats: { mtimeMs: 1000 } };
        // default configs
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();
      expect(result).toEqual(customPkgContext);

      expect(mockReadWithStats).toHaveBeenCalledWith(expect.stringContaining('custom.json'));
    });

    it('should UPDATE cache if package.json mtime changed', async () => {
      const newPackageJson = '{ "name": "updated-package", "version": "1.0.1" }';

      mockReadWithStats.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('package.json'))
          return { content: newPackageJson, stats: { mtimeMs: 2000 } };
        return { content: '{}', stats: { mtimeMs: 1000 } };
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.packageManager?.packageFileContent).toBe(newPackageJson);
      expect(result?.packageManager?.packageFileLastModified).toBe(2000);
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });
});
