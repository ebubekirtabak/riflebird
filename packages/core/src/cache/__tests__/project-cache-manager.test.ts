import { ProjectCacheManager, CACHE_FILE, CACHE_FOLDER } from '../project-cache-manager';
import { ProjectContext } from '@models/project-context';
import { ProjectConfigFiles } from '@models/project-config-files';
import * as fs from 'fs/promises';
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
      configFiles: {} as unknown as ProjectConfigFiles,
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

      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();

        if (pathStr === mockCachePath) {
          return Promise.resolve(JSON.stringify(mockContext));
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

        return Promise.reject(new Error(`File not found: ${filePath}`));
      });

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
    });

    it('should return null if cache file does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));
      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should return context if cache is valid and files match', async () => {
      const result = await cacheManager.load();
      expect(result).toEqual(mockContext);
      expect(mockedFs.writeFile).not.toHaveBeenCalled(); // No update needed
    });

    it('should UPDATE cache if config content changed on disk', async () => {
      const newTsConfig = '{ "compilerOptions": { "strict": true } }';

      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr === mockCachePath) return Promise.resolve(JSON.stringify(mockContext));
        if (pathStr.endsWith('tsconfig.json')) return Promise.resolve(newTsConfig); // CHANGED
        if (pathStr.endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (pathStr.endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });

      const result = await cacheManager.load();

      expect(result).not.toBeNull();
      expect(result?.languageConfig.configContent).toBe(newTsConfig); // Should have new content
      expect(mockedFs.writeFile).toHaveBeenCalled(); // Should trigger save
    });

    it('should INVALIDATE cache if a config file is missing', async () => {
      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath === mockCachePath) return Promise.resolve(JSON.stringify(mockContext));
        if (filePath.toString().endsWith('tsconfig.json'))
          return Promise.reject(new Error('ENOENT')); // MISSING
        return Promise.resolve('some content');
      });

      const result = await cacheManager.load();

      expect(result).toBeNull();
    });

    it('should INVALIDATE cache if default package.json is missing', async () => {
      // Setup cache with package.json specified but missing on disk
      const contextWithPkg = {
        ...mockContext,
        packageManager: { ...mockContext.packageManager!, packageFilePath: 'package.json' },
      };

      mockedFs.readFile.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr === mockCachePath) return Promise.resolve(JSON.stringify(contextWithPkg));
        // For config files, rely on default behavior or explicit return
        if (pathStr.endsWith('tsconfig.json'))
          return Promise.resolve(mockContext.languageConfig.configContent!);
        if (pathStr.endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (pathStr.endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);
        return Promise.resolve('some content');
      });

      // Mock package.json access failing
      mockedFs.access.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr === mockCachePath) return Promise.resolve(undefined);
        if (pathStr.endsWith('package.json')) return Promise.reject(new Error('ENOENT'));
        return Promise.resolve(undefined);
      });

      const result = await cacheManager.load();
      expect(result).toBeNull();
    });

    it('should VALIDATE dynamic package file if present in cache', async () => {
      const customPkgContext = {
        ...mockContext,
        packageManager: { ...mockContext.packageManager!, packageFilePath: 'custom.json' },
      };

      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath)
          return Promise.resolve(JSON.stringify(customPkgContext));
        // Return valid content for configs so they pass validation
        if (filePath.toString().endsWith('tsconfig.json'))
          return Promise.resolve(mockContext.languageConfig.configContent!);
        if (filePath.toString().endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (filePath.toString().endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);
        return Promise.resolve('{}');
      });

      // Mock checking both config files (read) and package file (access)
      mockedFs.access.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath) return Promise.resolve(undefined);
        if (filePath.toString().endsWith('custom.json')) return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      });

      const result = await cacheManager.load();
      expect(result).toEqual(customPkgContext);
    });

    it('should INVALIDATE if dynamic package file is missing', async () => {
      const customPkgContext = {
        ...mockContext,
        packageManager: { ...mockContext.packageManager!, packageFilePath: 'missing.json' },
      };

      mockedFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath)
          return Promise.resolve(JSON.stringify(customPkgContext));
        // Return content for configs
        if (filePath.toString().endsWith('tsconfig.json'))
          return Promise.resolve(mockContext.languageConfig.configContent!);
        if (filePath.toString().endsWith('.eslintrc.json'))
          return Promise.resolve(mockContext.linterConfig.configContent!);
        if (filePath.toString().endsWith('.prettierrc'))
          return Promise.resolve(mockContext.formatterConfig.configContent!);
        return Promise.resolve('{}');
      });

      mockedFs.access.mockImplementation((filePath) => {
        if (filePath.toString() === mockCachePath) return Promise.resolve(undefined);
        if (filePath.toString().endsWith('missing.json'))
          return Promise.reject(new Error('ENOENT'));
        return Promise.resolve(undefined);
      });

      const result = await cacheManager.load();
      expect(result).toBeNull();
    });
  });
});
