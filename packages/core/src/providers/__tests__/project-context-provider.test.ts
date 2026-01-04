import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { ProjectContextProvider } from '../project-context-provider';
import { CommandContext } from '@commands/base';
import { AIClient } from '@models/ai-client';
import { TestFrameworkAdapter } from '@adapters/base';
import { RiflebirdConfig } from '@config/schema';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Define a MockAIClient type intersecting AIClient with Vitest's Mock type for the method
type MockAIClient = AIClient & {
  createChatCompletion: Mock;
};

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));

vi.mock('../../cache/project-cache-manager', () => {
  return {
    ProjectCacheManager: class {
      load = mockLoad;
      save = vi.fn();
    },
  };
});

vi.mock('@utils/log-util', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@prompts/project-configuration.txt', () => ({
  default: '{{FILE_TREE}}',
}));

vi.mock('@security', () => ({
  SecretScanner: {
    sanitize: vi.fn((content) => ({ secretsDetected: 0, sanitizedCode: content })),
  },
  sanitizationLogger: {
    logSanitization: vi.fn(),
  },
}));

vi.mock('@utils', async () => {
  const { ProjectFileWalker } = await import('@utils/project-file-walker');
  const { FileTreeWalker } = await import('@utils/file-tree-walker');
  const { getFileTree } = await import('@utils/file-tree');
  const { detectOutputStrategy } = await import('@utils/file-util');
  const { detectPackageManagerInfo } = await import('@utils/package-manager-detector');

  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    ProjectFileWalker,
    FileTreeWalker,
    getFileTree,
    detectOutputStrategy,
    detectPackageManagerInfo,
  };
});

describe('ProjectContextProvider', () => {
  let provider: ProjectContextProvider;
  let mockContext: CommandContext;
  let mockAiClient: MockAIClient;
  let mockConfig: RiflebirdConfig;
  let projectRoot: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'riflebird-test-project-'));

    // Create fixture files
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'vitest',
        },
        devDependencies: {
          vitest: '^1.0.0',
          typescript: '^5.0.0',
        },
      })
    );
    await fs.writeFile(
      path.join(projectRoot, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} })
    );
    await fs.writeFile(path.join(projectRoot, 'vitest.config.ts'), 'export default {}');
    await fs.writeFile(path.join(projectRoot, 'eslint.config.mjs'), 'export default []');
    await fs.writeFile(path.join(projectRoot, '.prettierrc'), '{}');

    // Create src directory
    await fs.mkdir(path.join(projectRoot, 'src'));
    await fs.writeFile(path.join(projectRoot, 'src', 'index.ts'), 'console.log("hello");');

    mockAiClient = {
      createChatCompletion: vi.fn(),
    } as unknown as MockAIClient;

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
      // Explicit cast to match full config shape without verbose mocking
    } as RiflebirdConfig;

    mockContext = {
      aiClient: mockAiClient,
      config: mockConfig,
      adapter: {} as TestFrameworkAdapter,
    } as CommandContext;

    mockLoad.mockReset().mockResolvedValue(null);
    provider = new ProjectContextProvider(mockContext, projectRoot);
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(projectRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
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
      const fileTree = await provider.getFileTree();
      expect(fileTree.length).toBeGreaterThan(0);

      const fileNames = fileTree.map((node) => node.name);
      expect(fileNames).toContain('package.json');
      expect(fileNames).toContain('src');
    });

    it('should only initialize once when called multiple times', async () => {
      await provider.init();
      const firstTree = await provider.getFileTree();
      await provider.init();
      const secondTree = await provider.getFileTree();

      expect(firstTree).toBe(secondTree);
    });

    it('should return existing fileTreeWalker if already initialized', async () => {
      await provider.init();
      const firstWalker = await provider.getFileTreeWalker();
      const secondWalker = await provider.getFileTreeWalker();
      expect(firstWalker).toBe(secondWalker);
    });
  });

  describe('getContext', () => {
    beforeEach(() => {
      // Mock AI response for config file detection
      const mockConfigResponse = {
        testFrameworks: {
          unit: {
            type: 'unit-test',
            name: 'vitest',
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
        packageManager: 'npm',
      };

      mockAiClient.createChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockConfigResponse),
            },
          },
        ],
      });
    });

    it('should return cached context if available', async () => {
      const cachedContext = {
        testFrameworks: { unit: { name: 'vitest' } },
      };

      mockLoad.mockResolvedValue(cachedContext);

      const context = await provider.getContext();

      expect(context).toBe(cachedContext);
      expect(mockLoad).toHaveBeenCalled();
    });

    it('should return complete project context reading real files', async () => {
      const context = await provider.getContext();

      expect(context).toBeDefined();
      expect(context.projectRoot).toBe(projectRoot);

      // Verify file contents were read
      expect(context.languageConfig.configContent).toContain('compilerOptions');
      expect(context.testFrameworks?.unit?.configContent).toContain('export default {}');

      // Verify package manager info
      expect(context.packageManager).toBeDefined();
      expect(context.packageManager?.type).toBeDefined(); // Might detect as npm or unknown depending on partial implementation
    });

    it('should detect unit test output strategy from config', async () => {
      mockContext.config.unitTesting!.testOutputDir = './__tests__';
      provider = new ProjectContextProvider(mockContext, projectRoot);

      const context = await provider.getContext();
      expect(context.unitTestOutputStrategy).toBe('colocated');
    });

    it('should throw error if underlying operations fail', async () => {
      // Force error by mocking AI client to reject
      mockAiClient.createChatCompletion.mockRejectedValue(new Error('AI invalid'));
      // And checking expectation
      await expect(provider.getContext()).rejects.toThrow('AI invalid');
    });
  });

  describe('readTestFramework', () => {
    it('should read unit test framework when enabled', async () => {
      const testFrameworksConfig = {
        unit: {
          type: 'unit-test' as const,
          name: 'vitest',
          version: '1.0.0',
          configFile: 'vitest.config.ts',
          configFilePath: 'vitest.config.ts',
          fileLang: 'typescript' as const,
        },
      };

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);

      expect(result.unit).toBeDefined();
      expect(result.unit?.configContent).toContain('export default {}');
      expect(result.unit?.lastModified).toEqual(expect.any(Number));
    });

    it('should read documentation framework when enabled', async () => {
      // Enable documentation
      if (!mockContext.config.documentation) {
        mockContext.config.documentation = {
          enabled: true,
          setupFiles: [],
          documentationOutputDir: 'docs',
          documentationMatch: [],
        };
      }
      mockContext.config.documentation.enabled = true;

      // Create dummy doc config
      await fs.writeFile(path.join(projectRoot, 'jsdoc.json'), '{}');

      const testFrameworksConfig = {
        documentation: {
          type: 'documentation' as const,
          name: 'jsdoc',
          configFile: 'jsdoc.json',
          configFilePath: 'jsdoc.json',
          fileLang: 'json' as const,
        },
      };

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);

      expect(result.documentation).toBeDefined();
      expect(result.documentation?.name).toBe('jsdoc');
      expect(result.documentation?.configContent).toBe('{}');
    });

    it('should handle errors during framework read gracefully', async () => {
      // Point to non-existent file to force error in readFileFromProject
      const testFrameworksConfig = {
        unit: {
          type: 'unit-test' as const,
          name: 'vitest',
          configFile: 'non-existent.ts',
          configFilePath: 'non-existent.ts',
          fileLang: 'typescript' as const,
        },
      };

      const result = await provider.readTestFramework(testFrameworksConfig, projectRoot);
      expect(result).toEqual({});
    });

    it('should return empty object when unit testing is disabled', async () => {
      mockContext.config.unitTesting!.enabled = false;
      provider = new ProjectContextProvider(mockContext, projectRoot);

      const testFrameworksConfig = {
        unit: {
          type: 'unit-test' as const,
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

      expect(result.configContent).toContain('compilerOptions');
      expect(result.lastModified).toEqual(expect.any(Number));
    });

    it('should handle missing config file gracefully', async () => {
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
  });
});
