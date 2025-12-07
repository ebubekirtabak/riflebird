import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectContextProvider } from '../project-context-provider';
import { CommandContext } from '@commands/base';
import { AIClient } from '@models/ai-client';
import { RiflebirdConfig } from '@config/schema';
import * as coreExports from '@riflebird/core';
import { ProjectFileWalker } from '@utils/project-file-walker';
import { FileTreeWalker } from '@utils/file-tree-walker';
import { ProjectConfigFiles } from '@/models/project-config-files';

vi.mock('@riflebird/core', async () => {
  const actual = await vi.importActual('@riflebird/core');
  return {
    ...actual,
    getFileTree: vi.fn(),
  };
});

vi.mock('@utils/project-file-walker');
vi.mock('@utils/file-tree-walker');

describe('ProjectContextProvider', () => {
  let provider: ProjectContextProvider;
  let mockContext: CommandContext;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  const projectRoot = '/test/project';

  beforeEach(() => {
    mockAiClient = {} as AIClient;
    mockConfig = {
      ai: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.2,
      },
      unitTesting: {
        enabled: true,
        framework: 'vitest',
      },
    } as RiflebirdConfig;

    mockContext = {
      aiClient: mockAiClient,
      config: mockConfig,
    } as CommandContext;

    // Mock getFileTree
    vi.mocked(coreExports.getFileTree).mockResolvedValue([
      { name: 'src', path: '/test/project/src', type: 'directory', children: [] },
      { name: 'package.json', path: '/test/project/package.json', type: 'file' },
    ]);

    // Mock FileTreeWalker
    vi.mocked(FileTreeWalker).mockImplementation(() => ({
      findConfigFiles: vi.fn().mockResolvedValue({
        testFrameworks: {
          unit: {
            type: 'unit-test',
            name: 'vitest',
            version: '1.0.0',
            configFile: 'vitest.config.ts',
            configFilePath: 'vitest.config.ts',
            fileLang: 'typescript',
          },
        },
        languageConfig: {
          type: 'language',
          name: 'typescript',
          configFile: 'tsconfig.json',
          configFilePath: 'tsconfig.json',
          fileLang: 'json',
        },
        linting: {
          type: 'linting',
          name: 'eslint',
          configFile: 'eslint.config.mjs',
          configFilePath: 'eslint.config.mjs',
          fileLang: 'javascript',
        },
        formatting: {
          type: 'formatting',
          name: 'prettier',
          configFile: '.prettierrc',
          configFilePath: '.prettierrc',
          fileLang: 'json',
        },
      } as ProjectConfigFiles),
    } as unknown as FileTreeWalker));

    // Mock ProjectFileWalker
    vi.mocked(ProjectFileWalker).mockImplementation(() => ({
      readFileFromProject: vi.fn().mockResolvedValue('mock file content'),
      writeFileToProject: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProjectFileWalker));

    provider = new ProjectContextProvider(mockContext, projectRoot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with context and projectRoot', () => {
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(ProjectContextProvider);
    });
  });

  describe('init', () => {
    it('should initialize file tree and walkers', async () => {
      await provider.init();

      expect(coreExports.getFileTree).toHaveBeenCalledWith(
        projectRoot,
        expect.objectContaining({
          excludeDirs: expect.any(Array),
          maxDepth: 5,
        })
      );
    });

    it('should only initialize once when called multiple times', async () => {
      await provider.init();
      await provider.init();
      await provider.init();

      expect(coreExports.getFileTree).toHaveBeenCalledTimes(1);
    });
  });

  describe('getContext', () => {
    it('should return complete project context', async () => {
      const context = await provider.getContext();

      expect(context).toHaveProperty('configFiles');
      expect(context).toHaveProperty('testFrameworks');
      expect(context).toHaveProperty('languageConfig');
      expect(context).toHaveProperty('linterConfig');
      expect(context).toHaveProperty('formatterConfig');
    });

    it('should call init before building context', async () => {
      const initSpy = vi.spyOn(provider, 'init');
      await provider.getContext();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should read config file contents', async () => {
      const context = await provider.getContext();

      expect(context.languageConfig).toHaveProperty('configContent', 'mock file content');
      expect(context.linterConfig).toHaveProperty('configContent', 'mock file content');
      expect(context.formatterConfig).toHaveProperty('configContent', 'mock file content');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(coreExports.getFileTree).mockRejectedValue(new Error('File tree error'));

      await expect(provider.getContext()).rejects.toThrow('File tree error');
    });
  });

  describe('readTestFramework', () => {
    it('should read unit test framework when enabled', async () => {
      const testFrameworksConfig = {
        unit: {
          type: 'unit-test',
          name: 'vitest',
          version: '1.0.0',
          configFile: 'vitest.config.ts',
          configFilePath: 'vitest.config.ts',
          fileLang: 'typescript' as const,
        },
      };

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);

      expect(result).toHaveProperty('unit');
      expect(result.unit).toHaveProperty('name', 'vitest');
      expect(result.unit).toHaveProperty('configContent', 'mock file content');
    });

    it('should return empty object when unit testing is disabled', async () => {
      mockContext.config.unitTesting = { ...mockConfig.unitTesting!, enabled: false };
      provider = new ProjectContextProvider(mockContext, projectRoot);

      const testFrameworksConfig = {
        unit: {
          type: 'unit-test',
          name: 'vitest',
          configFile: 'vitest.config.ts',
          configFilePath: 'vitest.config.ts',
          fileLang: 'typescript' as const,
        },
      };

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);

      expect(result).toEqual({});
    });

    it('should return empty object when unit config is missing', async () => {
      const testFrameworksConfig = {};

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);

      expect(result).toEqual({});
    });

    it('should handle read errors gracefully', async () => {
      vi.mocked(ProjectFileWalker).mockImplementation(() => ({
        readFileFromProject: vi.fn().mockRejectedValue(new Error('Read error')),
        writeFileToProject: vi.fn(),
      } as unknown as ProjectFileWalker));

      provider = new ProjectContextProvider(mockContext, projectRoot);

      const testFrameworksConfig = {
        unit: {
          type: 'unit-test',
          name: 'vitest',
          configFile: 'vitest.config.ts',
          configFilePath: 'vitest.config.ts',
          fileLang: 'typescript' as const,
        },
      };

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);

      expect(result).toEqual({});
    });
  });

  describe('readConfigFile', () => {
    it('should read config file and return with content', async () => {
      const configFile = {
        type: 'language',
        name: 'typescript',
        configFile: 'tsconfig.json',
        configFilePath: 'tsconfig.json',
        fileLang: 'json' as const,
      };

      const result = await provider.readConfigFile(configFile);

      expect(result).toHaveProperty('name', 'typescript');
      expect(result).toHaveProperty('configFilePath', 'tsconfig.json');
      expect(result).toHaveProperty('configContent', 'mock file content');
    });

    it('should handle missing config file gracefully', async () => {
      vi.mocked(ProjectFileWalker).mockImplementation(() => ({
        readFileFromProject: vi.fn().mockRejectedValue(new Error('File not found')),
        writeFileToProject: vi.fn(),
      } as unknown as ProjectFileWalker));

      provider = new ProjectContextProvider(mockContext, projectRoot);

      const configFile = {
        type: 'config',
        name: 'missing',
        configFile: 'missing.json',
        configFilePath: 'missing.json',
        fileLang: 'json' as const,
      };

      const result = await provider.readConfigFile(configFile);

      expect(result).toEqual({});
    });

    it('should return empty object on read error', async () => {
      const mockWalker = {
        readFileFromProject: vi.fn().mockRejectedValue(new Error('Read failed')),
        writeFileToProject: vi.fn(),
      };

      vi.mocked(ProjectFileWalker).mockImplementation(() => mockWalker as unknown as ProjectFileWalker);
      provider = new ProjectContextProvider(mockContext, projectRoot);

      const configFile = {
        type: 'config',
        name: 'test',
        configFile: 'test.json',
        configFilePath: 'test.json',
        fileLang: 'json' as const,
      };

      const result = await provider.readConfigFile(configFile);

      expect(result).toEqual({});
    });
  });
});
