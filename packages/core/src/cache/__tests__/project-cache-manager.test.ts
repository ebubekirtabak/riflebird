import { ProjectCacheManager, CACHE_FILE, CACHE_FOLDER } from '../project-cache-manager';
import { ProjectContext } from '@models/project-context';
import { ProjectConfigFiles, ConfigFile } from '@models/project-config-files';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises');
const mockedFs = fs as unknown as Mocked<typeof fs>;

// Mock utils
vi.mock('@utils', () => ({
  debug: vi.fn(),
  error: vi.fn(),
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
        packageJsonContent: '{}',
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
    beforeEach(() => {
      // Setup default successful calls
      mockedFs.access.mockResolvedValue(undefined); // cache exists

      // Default stat implementation (returns same mtime as verifying "unchanged")
      mockedFs.stat.mockResolvedValue({
        mtimeMs: 1000,
      } as unknown as Stats);

      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();

        if (pathStr === mockCachePath) {
          // Return cache with lastModified set to match default stat
          const contextWithMtime = {
            ...mockContext,
            languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
            linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
            formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
            packageManager: { ...mockContext.packageManager, packageJsonLastModified: 1000 },
          };
          return Promise.resolve(JSON.stringify(contextWithMtime));
        }

        // Return exact content from mockContext for validity
        if (pathStr.endsWith('tsconfig.json'))
          return Promise.resolve(mockContext.languageConfig.configContent!);
        if (pathStr.endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (pathStr.endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);

        // Return simple content for other files (like custom package files if read)
        if (pathStr.endsWith('custom.json')) return Promise.resolve('{}');
        if (pathStr.endsWith('package.json')) return Promise.resolve('{}');

        return Promise.reject(new Error(`File not found: ${filePath}`));
      });

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
    });

    it('should return null if cache file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should return context calling stat but NOT reading files if mtime matches', async () => {
      const result = await cacheManager.load();

      const expectedContext = {
        ...mockContext,
        languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
        linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
        formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
        packageManager: { ...mockContext.packageManager, packageJsonLastModified: 1000 },
      };

      expect(result).toEqual(expectedContext);

      // Should call stat for checking
      expect(mockedFs.stat).toHaveBeenCalled();

      // Should NOT call readFile for configs because mtime matched
      // Only readFile for cache.json should happen
      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
      expect(mockedFs.readFile).toHaveBeenCalledWith(mockCachePath, 'utf-8');

      expect(mockedFs.writeFile).not.toHaveBeenCalled(); // No update needed
    });

    it('should READ file and UPDATE cache if mtime changed', async () => {
      // Setup stat to return NEW mtime for tsconfig
      mockedFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('tsconfig.json')) {
          return Promise.resolve({ mtimeMs: 2000 } as unknown as Stats); // CHANGED for tsconfig
        }
        return Promise.resolve({ mtimeMs: 1000 } as unknown as Stats); // Unchanged for others
      });

      const newTsConfig = '{ "compilerOptions": { "strict": true } }';

      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        // Cache has old mtime (1000)
        if (pathStr === mockCachePath) {
          const contextWithMtime = {
            ...mockContext,
            languageConfig: { ...mockContext.languageConfig, lastModified: 1000 }, // Old mtime
            linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
            formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
            packageManager: { ...mockContext.packageManager, packageJsonLastModified: 1000 },
          };
          return Promise.resolve(JSON.stringify(contextWithMtime));
        }

        if (pathStr.endsWith('tsconfig.json')) return Promise.resolve(newTsConfig); // New content
        if (pathStr.endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (pathStr.endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);
        if (pathStr.endsWith('package.json')) return Promise.resolve('{}');
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.languageConfig.configContent).toBe(newTsConfig);
      expect(result?.languageConfig.lastModified).toBe(2000); // Should be updated

      // Should read cache AND tsconfig (because mtime changed)
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        'utf-8'
      );

      expect(mockedFs.writeFile).toHaveBeenCalled(); // Should trigger save
    });

    it('should UPDATE cache mtime if mtime changed but content is same (touch)', async () => {
      // Setup stat to return NEW mtime for tsconfig calls
      mockedFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('tsconfig.json')) {
          return Promise.resolve({ mtimeMs: 2000 } as unknown as Stats); // CHANGED mtime
        }
        return Promise.resolve({ mtimeMs: 1000 } as unknown as Stats);
      });

      // Content remains SAME
      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr === mockCachePath) {
          const contextWithMtime = {
            ...mockContext,
            languageConfig: { ...mockContext.languageConfig, lastModified: 1000 }, // Old mtime
            linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
            formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
            packageManager: { ...mockContext.packageManager, packageJsonLastModified: 1000 },
          };
          return Promise.resolve(JSON.stringify(contextWithMtime));
        }
        // SAME content as cache
        if (pathStr.endsWith('tsconfig.json'))
          return Promise.resolve(mockContext.languageConfig.configContent!);

        if (pathStr.endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (pathStr.endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);
        if (pathStr.endsWith('package.json')) return Promise.resolve('{}');
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.languageConfig.lastModified).toBe(2000); // Updated mtime

      // Should still save to persist new mtime
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should INVALIDATE cache if a config file is missing check via stat', async () => {
      mockedFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('tsconfig.json')) {
          return Promise.reject(new Error('ENOENT')); // Missing file
        }
        return Promise.resolve({ mtimeMs: 1000 } as unknown as Stats);
      });

      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath === mockCachePath) {
          const contextWithMtime = {
            ...mockContext,
            languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
          };
          return Promise.resolve(JSON.stringify(contextWithMtime));
        }
        return Promise.resolve('some content');
      });

      const result = await cacheManager.load();

      expect(result).toBeNull();
    });

    it('should INVALIDATE cache if default package.json is missing check via stat', async () => {
      const contextWithPkg = {
        ...mockContext,
        packageManager: {
          ...mockContext.packageManager!,
          packageFilePath: 'package.json',
          packageJsonLastModified: 1000,
        },
      };

      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath)
          return Promise.resolve(JSON.stringify(contextWithPkg));
        return Promise.resolve('{}');
      });

      mockedFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('package.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve({ mtimeMs: 1000 } as unknown as Stats);
      });

      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should VALIDATE dynamic package file if present in cache checking mtime', async () => {
      const customPkgContext = {
        ...mockContext,
        packageManager: {
          ...mockContext.packageManager!,
          packageFilePath: 'custom.json',
          packageJsonContent: '{}',
          packageJsonLastModified: 1000,
        },
        languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
        linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
        formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
      };

      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath)
          return Promise.resolve(JSON.stringify(customPkgContext));
        return Promise.resolve('{}');
      });

      mockedFs.stat.mockResolvedValue({ mtimeMs: 1000 } as unknown as Stats);

      const result = await cacheManager.load();
      expect(result).toEqual(customPkgContext);

      // Should call stat but not read files since mtime matches
      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should UPDATE cache if package.json mtime changed', async () => {
      const newPackageJson = '{ "name": "updated-package", "version": "1.0.1" }';

      mockedFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('package.json')) {
          return Promise.resolve({ mtimeMs: 2000 } as unknown as Stats); // CHANGED
        }
        return Promise.resolve({ mtimeMs: 1000 } as unknown as Stats);
      });

      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr === mockCachePath) {
          const contextWithMtime = {
            ...mockContext,
            languageConfig: { ...mockContext.languageConfig, lastModified: 1000 },
            linterConfig: { ...mockContext.linterConfig, lastModified: 1000 },
            formatterConfig: { ...mockContext.formatterConfig, lastModified: 1000 },
            packageManager: {
              ...mockContext.packageManager,
              packageJsonLastModified: 1000,
              packageFilePath: 'package.json',
            },
          };
          return Promise.resolve(JSON.stringify(contextWithMtime));
        }
        if (pathStr.endsWith('package.json')) return Promise.resolve(newPackageJson); // CHANGED
        return Promise.resolve('{}');
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.packageManager?.packageJsonContent).toBe(newPackageJson);
      expect(result?.packageManager?.packageJsonLastModified).toBe(2000);
      expect(mockedFs.writeFile).toHaveBeenCalled(); // Should trigger save
    });
  });
});
