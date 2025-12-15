/**
 * @todo TDD Refactor: This test file uses complex module mocking that violates TDD principles.
 *
 * Current Issues:
 * - Manual vi.mock() with shared state (getMockWalkerInstance pattern)
 * - Testing implementation details rather than behavior
 * - Tight coupling between tests and internal implementation
 * - Difficult to understand what behavior is being tested
 *
 * Recommended Refactoring (production code):
 * 1. Inject file operations as a dependency:
 *    - Create FileOperations interface with read/write methods
 *    - Pass implementation to UnitTestWriter constructor
 *    - Tests can provide simple in-memory implementations
 *
 * 2. Inject pattern matching utilities:
 *    - Create PatternMatcher interface
 *    - Simplifies testing file filtering logic
 *
 * 3. Separate concerns:
 *    - UnitTestWriter: orchestration only
 *    - FileOperations: I/O boundary
 *    - PatternMatcher: pattern logic
 *    - PromptBuilder: prompt construction
 *
 * This would enable:
 * - Constructor injection of all dependencies
 * - No module-level mocking required
 * - Tests that verify behavior, not implementation
 * - Fast, deterministic unit tests
 *
 * Example improved test structure:
 * ```typescript
 * const fileOps = createInMemoryFileOps({ 'src/foo.ts': 'content' });
 * const aiClient = createMockAiClient();
 * const writer = new UnitTestWriter({ fileOps, aiClient, config });
 * await writer.generateTest(...);
 * expect(fileOps.getWrittenFiles()).toEqual({ 'src/__tests__/foo.test.ts': '...' });
 * ```
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitTestWriter } from '../unit-test-writer';
import type { ProjectContext, FrameworkInfo } from '@models/project-context';
import { ConfigFile } from '@models/project-config-files';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';
import { ProjectContextProvider } from '@providers/project-context-provider';
import type { TestFile } from '@models';


vi.mock('@prompts/unit-test-prompt.txt', () => ({
  default: 'Generate unit test for {{TEST_FRAMEWORK}}.\n\nFramework Config:\n{{TEST_FRAMEWORK_CONFIG}}\n\nLanguage Config:\n{{LANGUAGE_CONFIGURATIONS}}\n\nFormatting:\n{{FORMATTING_RULES}}\n\nLinting:\n{{LINTING_RULES}}\n\nCode:\n{{CODE_SNIPPET}}',
}));

vi.mock('@utils', async () => {
  const actual = await vi.importActual('@utils');
  return {
    ...actual,
    getFileTree: vi.fn(),
    findFilesByPatternInFileTree: vi.fn(),
    matchesPattern: vi.fn(),
  };
});

vi.mock('@utils/project-file-walker', () => {
  const mockInstance = {
    readFileFromProject: vi.fn().mockResolvedValue('// source code'),
    writeFileToProject: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ProjectFileWalker: vi.fn(() => mockInstance),
    getMockWalkerInstance: () => mockInstance,
  };
});

describe('UnitTestWriter', () => {
  let writer: UnitTestWriter;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockProjectContext: ProjectContext;
  let mockWalkerInstance: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Get and configure the file walker mock instance
    const { getMockWalkerInstance } = await import('@utils/project-file-walker');
    mockWalkerInstance = getMockWalkerInstance();

    mockWalkerInstance.readFileFromProject.mockResolvedValue('// source code');
    mockWalkerInstance.writeFileToProject.mockResolvedValue(undefined);

    // Setup mock AI client with default successful response
    mockAiClient = {
      createChatCompletion: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '```typescript\nimport { test } from "vitest";\ntest("should work", () => {});\n```',
            },
          },
        ],
      }),
    } as unknown as AIClient;

    // Setup mock config
    mockConfig = {
      ai: {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        provider: 'openai',
      },
    } as RiflebirdConfig;

    // Setup mock project context
    mockProjectContext = {
      testFrameworks: {
        unit: {
          name: 'vitest',
          version: '1.0.0',
          fileLang: 'typescript',
          configFilePath: 'vitest.config.ts',
          configContent: 'export default { test: { globals: true } }',
        },
      },
      languageConfig: {
        name: 'typescript',
        fileLang: 'json',
        configFilePath: 'tsconfig.json',
        configContent: '{ "compilerOptions": { "strict": true } }',
      },
      linterConfig: {
        name: 'eslint',
        fileLang: 'javascript',
        configFilePath: 'eslint.config.js',
        configContent: 'module.exports = { rules: {} }',
      },
      formatterConfig: {
        name: 'prettier',
        fileLang: 'json',
        configFilePath: '.prettierrc',
        configContent: '{ "semi": true }',
      },
      configFiles: {
        framework: {} as ConfigFile,
        language: 'typescript',
        packageManager: 'pnpm',
        libs: { core: [], testing: [], styling: [] },
        testFrameworks: {},
        linting: {} as ConfigFile,
        formatting: {} as ConfigFile,
        languageConfig: {} as ConfigFile,
        importantConfigFiles: {},
      },
    };

    writer = new UnitTestWriter({
      aiClient: mockAiClient,
      config: mockConfig,
    });
  });

  describe('getExclusionPatternsForUnitTesting', () => {
    it('should return default exclusion patterns when no user config', () => {
      const patterns = writer.getExclusionPatternsForUnitTesting();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).toContain('**/*.test.ts');
      expect(patterns).toContain('**/*.spec.ts');
      expect(patterns).toContain('**/node_modules/**');
    });

    it('should merge user-defined patterns with defaults', () => {
      const customConfig = {
        ai: { model: 'gpt-4o-mini', temperature: 0.2, provider: 'openai' },
        unitTesting: {
          testMatch: ['**/custom-exclude/**', '**/*.excluded.ts'],
        },
      } as RiflebirdConfig;

      const customWriter = new UnitTestWriter({
        aiClient: mockAiClient,
        config: customConfig,
      });

      const patterns = customWriter.getExclusionPatternsForUnitTesting();

      expect(patterns).toContain('**/custom-exclude/**');
      expect(patterns).toContain('**/*.excluded.ts');
      expect(patterns).toContain('**/*.test.ts');
      expect(patterns).toContain('**/*.spec.ts');
    });

    it('should deduplicate patterns using Set', () => {
      const configWithDuplicates = {
        ai: { model: 'gpt-4o-mini', temperature: 0.2, provider: 'openai' },
        unitTesting: {
          testMatch: ['**/*.test.ts', '**/*.spec.ts'], // Duplicates of defaults
        },
      } as RiflebirdConfig;

      const customWriter = new UnitTestWriter({
        aiClient: mockAiClient,
        config: configWithDuplicates,
      });

      const patterns = customWriter.getExclusionPatternsForUnitTesting();
      const testPatternCount = patterns.filter(p => p === '**/*.test.ts').length;
      const specPatternCount = patterns.filter(p => p === '**/*.spec.ts').length;

      // Each pattern should appear only once due to Set deduplication
      expect(testPatternCount).toBe(1);
      expect(specPatternCount).toBe(1);
    });

    it('should include all DEFAULT_UNIT_TEST_PATTERNS', () => {
      const patterns = writer.getExclusionPatternsForUnitTesting();

      // DEFAULT_UNIT_TEST_PATTERNS are included
      expect(patterns).toContain('**/__tests__/**');
    });

    it('should include all DEFAULT_COVERAGE_EXCLUDE patterns', () => {
      const patterns = writer.getExclusionPatternsForUnitTesting();

      // DEFAULT_COVERAGE_EXCLUDE patterns are included
      expect(patterns).toContain('**/node_modules/**');
      expect(patterns).toContain('**/dist/**');
      expect(patterns).toContain('**/build/**');
    });
  });

  describe('generateTest', () => {
    it('should generate test code with AI', async () => {
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        version: '1.0.0',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default {}',
      };

      const targetFile: TestFile = {
        filePath: 'src/add.ts',
        content: 'export function add(a: number, b: number) { return a + b; }',
        testFilePath: 'src/add.test.ts',
        testContent: '',
      };

      const result = await writer.generateTest(
        mockProjectContext,
        targetFile,
        testFramework,
      );

      expect(result).toBe('import { test } from "vitest";\ntest("should work", () => {});');
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledOnce();
    });

    it('should call AI client with correct parameters', async () => {
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        fileLang: 'typescript',
      };

      const targetFile: TestFile = {
        filePath: 'src/test-file.ts',
        content: 'function test() {}',
        testFilePath: 'src/test-file.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, testFramework);

      expect(mockAiClient.createChatCompletion).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        format: 'json',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('Generate unit test for vitest'),
          },
        ],
      });
    });

    it('should build prompt with project context', async () => {
      const testFramework: FrameworkInfo = {
        name: 'jest',
        fileLang: 'javascript',
      };

      const targetFile: TestFile = {
        filePath: 'src/context.ts',
        content: 'const x = 1;',
        testFilePath: 'src/context.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, testFramework);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      expect(promptContent).toContain('jest');
      expect(promptContent).toContain('tsconfig.json'); // Language config file
      expect(promptContent).toContain('eslint');
      expect(promptContent).toContain('prettier');
      expect(promptContent).toContain('const x = 1;');
    });

    it('should handle missing test framework', async () => {
      const targetFile: TestFile = {
        filePath: 'src/missing.ts',
        content: 'function test() {}',
        testFilePath: 'src/missing.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, undefined);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      expect(promptContent).toContain('unknown framework');
    });

    it('should strip markdown code blocks from AI response', async () => {
      const targetFile: TestFile = {
        filePath: 'src/markdown.ts',
        content: 'const x = 1;',
        testFilePath: 'src/markdown.test.ts',
        testContent: '',
      };

      const result = await writer.generateTest(mockProjectContext, targetFile, undefined);

      // Should not contain markdown code fences (validates real stripMarkdownCodeBlocks behavior)
      expect(result).not.toContain('```');
      expect(result).toContain('import { test }');
    });

    it('should throw error when AI returns no choices', async () => {
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [],
      });

      const targetFile: TestFile = {
        filePath: 'src/no-choices.ts',
        content: 'const x = 1;',
        testFilePath: 'src/no-choices.test.ts',
        testContent: '',
      };

      await expect(writer.generateTest(mockProjectContext, targetFile, undefined)).rejects.toThrow(
        'AI did not return any choices for unit test generation'
      );
    });

    it('should use AI config from constructor options', async () => {
      const customConfig = {
        ai: {
          model: 'gpt-4-turbo',
          temperature: 0.5,
          provider: 'openai',
        },
      } as RiflebirdConfig;

      const customWriter = new UnitTestWriter({
        aiClient: mockAiClient,
        config: customConfig,
      });

      const targetFile: TestFile = {
        filePath: 'src/custom-ai.ts',
        content: 'const x = 1;',
        testFilePath: 'src/custom-ai.test.ts',
        testContent: '',
      };

      await customWriter.generateTest(mockProjectContext, targetFile, undefined);

      expect(mockAiClient.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
          temperature: 0.5,
        })
      );
    });

    it('should handle different test frameworks', async () => {
      const testFrameworks = [
        { name: 'vitest', fileLang: 'typescript' },
        { name: 'jest', fileLang: 'javascript' },
        { name: 'mocha', fileLang: 'typescript' },
      ];

      for (const framework of testFrameworks) {
        vi.clearAllMocks();
        const targetFile: TestFile = {
          filePath: 'src/framework-test.ts',
          content: 'const x = 1;',
          testFilePath: 'src/framework-test.test.ts',
          testContent: '',
        };

        await writer.generateTest(mockProjectContext, targetFile, framework);

        const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
          .calls[0][0];
        const promptContent = callArgs.messages[0].content;

        expect(promptContent).toContain(framework.name);
      }
    });

    it('should include framework configuration in prompt', async () => {
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default { test: { globals: true, coverage: { enabled: true } } }',
      };

      const targetFile: TestFile = {
        filePath: 'src/config-test.ts',
        content: 'const x = 1;',
        testFilePath: 'src/config-test.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, testFramework);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      expect(promptContent).toContain('vitest.config.ts');
      expect(promptContent).toContain('globals: true');
      expect(promptContent).toContain('coverage: { enabled: true }');
    });

    it('should include all project configurations in prompt', async () => {
      const targetFile: TestFile = {
        filePath: 'src/all-configs.ts',
        content: 'const x = 1;',
        testFilePath: 'src/all-configs.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, undefined);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      // Language config
      expect(promptContent).toContain('tsconfig.json');
      expect(promptContent).toContain('"strict": true');

      // Linter config
      expect(promptContent).toContain('eslint.config.js');

      // Formatter config
      expect(promptContent).toContain('.prettierrc');
      expect(promptContent).toContain('"semi": true');
    });

    it('should handle AI response with multiple message formats', async () => {
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Plain test code without markdown',
            },
          },
        ],
      });

      const targetFile: TestFile = {
        filePath: 'src/plain-response.ts',
        content: 'const x = 1;',
        testFilePath: 'src/plain-response.test.ts',
        testContent: '',
      };
      const result = await writer.generateTest(mockProjectContext, targetFile, undefined);

      expect(result).toBe('Plain test code without markdown');
    });

    it('should preserve test code structure after stripping markdown', async () => {
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [
          {
            message: {
              content: `\`\`\`typescript
import { describe, it, expect } from 'vitest';

describe('Calculator', () => {
  it('should add numbers', () => {
    expect(1 + 1).toBe(2);
  });
});
\`\`\``,
            },
          },
        ],
      });

      const targetFile: TestFile = {
        filePath: 'src/calculator.ts',
        content: 'function add(a, b) { return a + b; }',
        testFilePath: 'src/calculator.test.ts',
        testContent: '',
      };
      const result = await writer.generateTest(mockProjectContext, targetFile, undefined);

      expect(result).toContain('import { describe, it, expect }');
      expect(result).toContain("describe('Calculator'");
      expect(result).toContain('expect(1 + 1).toBe(2)');
    });

    it('should handle empty or minimal project context', async () => {
      const minimalContext: ProjectContext = {
        languageConfig: { name: 'javascript' } as FrameworkInfo,
        linterConfig: { name: 'none' } as FrameworkInfo,
        formatterConfig: { name: 'none' } as FrameworkInfo,
        configFiles: {
          framework: {} as ConfigFile,
          language: 'javascript',
          packageManager: 'npm',
          libs: { core: [], testing: [], styling: [] },
          testFrameworks: {},
          linting: {} as ConfigFile,
          formatting: {} as ConfigFile,
          languageConfig: {} as ConfigFile,
          importantConfigFiles: {},
        },
      };

      const targetFile: TestFile = {
        filePath: 'src/minimal.ts',
        content: 'function test() {}',
        testFilePath: 'src/minimal.test.ts',
        testContent: '',
      };

      const result = await writer.generateTest(minimalContext, targetFile, undefined);

      expect(result).toBeTruthy();
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledOnce();
    });

    it('should pass testFileContent parameter when provided', async () => {
      const targetFile: TestFile = {
        filePath: 'src/with-test.ts',
        content: 'export function add(a, b) { return a + b; }',
        testFilePath: 'src/with-test.test.ts',
        testContent: 'import { test } from "vitest";',
      };

      await writer.generateTest(mockProjectContext, targetFile, undefined);

      // The testContent is currently not used in the prompt template,
      // but this test validates that it can be passed without errors
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledOnce();
    });
  });

  describe('integration with PromptTemplateBuilder', () => {
    it('should use PromptTemplateBuilder to format prompt', async () => {
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default {}',
      };

      const targetFile: TestFile = {
        filePath: 'src/template-test.ts',
        content: 'const x = 1;',
        testFilePath: 'src/template-test.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, testFramework);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      // Verify PromptTemplateBuilder formatted the template correctly
      expect(promptContent).toMatch(/Framework Config:\s*```/);
      expect(promptContent).toMatch(/Language Config:\s*```json/);
      expect(promptContent).toContain('vitest.config.ts');
      expect(promptContent).toContain('tsconfig.json');
    });

    it('should handle custom variables through PromptTemplateBuilder', async () => {
      const targetFile: TestFile = {
        filePath: 'src/custom-vars.ts',
        content: 'const x = 1;',
        testFilePath: 'src/custom-vars.test.ts',
        testContent: '',
      };

      await writer.generateTest(mockProjectContext, targetFile, undefined);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      // All standard placeholders should be replaced
      expect(promptContent).not.toContain('{{TEST_FRAMEWORK}}');
      expect(promptContent).not.toContain('{{CODE_SNIPPET}}');
      expect(promptContent).not.toContain('{{LANGUAGE_CONFIGURATIONS}}');
    });
  });

  describe('error handling', () => {
    it('should handle AI client errors gracefully', async () => {
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('API Error')
      );

      const targetFile: TestFile = {
        filePath: 'src/api-error.ts',
        content: 'const x = 1;',
        testFilePath: 'src/api-error.test.ts',
        testContent: '',
      };

      await expect(writer.generateTest(mockProjectContext, targetFile, undefined)).rejects.toThrow(
        'API Error'
      );
    });

    it('should handle malformed AI responses', async () => {
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const targetFile: TestFile = {
        filePath: 'src/malformed.ts',
        content: 'const x = 1;',
        testFilePath: 'src/malformed.test.ts',
        testContent: '',
      };

      // null content will cause an error when stripMarkdownCodeBlocks tries to process it
      await expect(writer.generateTest(mockProjectContext, targetFile, undefined)).rejects.toThrow();
    });
  });

  describe('writeTestByPattern', () => {
    let mockProvider: ProjectContextProvider;
    let getFileTreeMock: ReturnType<typeof vi.fn>;
    let findFilesByPatternInFileTreeMock: ReturnType<typeof vi.fn>;
    let matchesPatternMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const { getFileTree, findFilesByPatternInFileTree, matchesPattern } = await import('@utils');
      getFileTreeMock = getFileTree as ReturnType<typeof vi.fn>;
      findFilesByPatternInFileTreeMock = findFilesByPatternInFileTree as ReturnType<typeof vi.fn>;
      matchesPatternMock = matchesPattern as ReturnType<typeof vi.fn>;

      mockProvider = {
        getContext: vi.fn().mockResolvedValue({
          ...mockProjectContext,
          projectRoot: '/test/project',
        }),
      } as unknown as ProjectContextProvider;

      // Setup default mocks
      getFileTreeMock.mockResolvedValue([]);
      findFilesByPatternInFileTreeMock.mockReturnValue([]);
      matchesPatternMock.mockReturnValue(false);

      // Reset AI client mock for each test
      vi.clearAllMocks();
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [
          {
            message: {
              content: '```typescript\nimport { test } from "vitest";\ntest("should work", () => {});\n```',
            },
          },
        ],
      });
    });

    it('should normalize patterns by removing leading ./', async () => {
      const patterns = ['./src/**/*.ts', './lib/**/*.js'];

      await writer.writeTestByPattern(mockProvider, patterns);

      expect(findFilesByPatternInFileTreeMock).toHaveBeenCalledWith(
        expect.anything(),
        ['src/**/*.ts', 'lib/**/*.js']
      );
    });

    it('should accept single pattern string', async () => {
      await writer.writeTestByPattern(mockProvider, 'src/**/*.ts');

      expect(findFilesByPatternInFileTreeMock).toHaveBeenCalledWith(
        expect.anything(),
        ['src/**/*.ts']
      );
    });

    it.skip('should filter out excluded files using matchesPattern', async () => {
      // Complex mocking scenario - skipping for now
    });

    it('should call onProgress callback for each file', async () => {
      const mockFiles = [
        { name: 'file1.ts', path: '/test/project/src/file1.ts', type: 'file' as const },
        { name: 'file2.ts', path: '/test/project/src/file2.ts', type: 'file' as const },
      ];

      findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
      matchesPatternMock.mockReturnValue(false); // No exclusions

      const onProgress = vi.fn();

      await writer.writeTestByPattern(mockProvider, 'src/**/*.ts', undefined, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2, '/test/project/src/file1.ts', expect.any(Number));
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2, '/test/project/src/file2.ts', expect.any(Number));
    });

    it('should include elapsed time in progress callbacks', async () => {
      const mockFiles = [
        { name: 'file.ts', path: '/test/project/src/file.ts', type: 'file' as const },
      ];

      findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
      matchesPatternMock.mockReturnValue(false);

      const onProgress = vi.fn();

      await writer.writeTestByPattern(mockProvider, 'src/**/*.ts', undefined, onProgress);

      const elapsedMs = onProgress.mock.calls[0][3];
      expect(typeof elapsedMs).toBe('number');
      expect(elapsedMs).toBeGreaterThanOrEqual(0);
    });

    describe('error handling', () => {
      it('should collect failures when file processing fails', async () => {
        const mockFiles = [
          { name: 'file1.ts', path: '/test/project/src/file1.ts', type: 'file' as const },
          { name: 'file2.ts', path: '/test/project/src/file2.ts', type: 'file' as const },
        ];

        findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
        matchesPatternMock.mockReturnValue(false);

        // Make AI client fail for first call only
        (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>)
          .mockRejectedValueOnce(new Error('AI processing failed'))
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: '```typescript\ntest("works", () => {});\n```',
                },
              },
            ],
          });

        const result = await writer.writeTestByPattern(mockProvider, 'src/**/*.ts');

        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]).toMatchObject({
          file: '/test/project/src/file1.ts',
          error: expect.stringContaining('AI processing failed'),
        });
        expect(result.files).toHaveLength(1);
      });

      it('should throw immediately on AI rate limit errors mid-batch', async () => {
        const mockFiles = [
          { name: 'file1.ts', path: '/test/project/src/file1.ts', type: 'file' as const },
          { name: 'file2.ts', path: '/test/project/src/file2.ts', type: 'file' as const },
        ];

        findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
        matchesPatternMock.mockReturnValue(false);

        // First file succeeds, second hits rate limit
        (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'test code' } }],
          })
          .mockRejectedValueOnce({
            status: 429,
            message: 'Rate limit exceeded',
          });

        await expect(writer.writeTestByPattern(mockProvider, 'src/**/*.ts')).rejects.toThrow(
          /Rate Limit Exceeded/
        );
      });

      it('should throw immediately on authentication errors', async () => {
        const mockFiles = [
          { name: 'file.ts', path: '/test/project/src/file.ts', type: 'file' as const },
        ];

        findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
        matchesPatternMock.mockReturnValue(false);

        (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue({
          status: 401,
          message: 'Invalid API key',
        });

        await expect(writer.writeTestByPattern(mockProvider, 'src/**/*.ts')).rejects.toThrow(
          /Authentication Error/
        );
      });

      it('should continue processing other files after non-fatal errors', async () => {
        const mockFiles = [
          { name: 'file1.ts', path: '/test/project/src/file1.ts', type: 'file' as const },
          { name: 'file2.ts', path: '/test/project/src/file2.ts', type: 'file' as const },
          { name: 'file3.ts', path: '/test/project/src/file3.ts', type: 'file' as const },
        ];

        findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
        matchesPatternMock.mockReturnValue(false);

        // Fail first and third with generic errors, succeed second
        (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>)
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'test code' } }],
          })
          .mockRejectedValueOnce(new Error('Parse error'));

        const result = await writer.writeTestByPattern(mockProvider, 'src/**/*.ts');

        expect(result.failures).toHaveLength(2);
        expect(result.files).toHaveLength(1);
        expect(result.failures[0].file).toBe('/test/project/src/file1.ts');
        expect(result.failures[1].file).toBe('/test/project/src/file3.ts');
      });

      it('should handle non-Error exceptions in failure messages', async () => {
        const mockFiles = [
          { name: 'file.ts', path: '/test/project/src/file.ts', type: 'file' as const },
        ];

        findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
        matchesPatternMock.mockReturnValue(false);

        // Throw a string error instead of Error object
        (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(
          'String error message from AI'
        );

        const result = await writer.writeTestByPattern(mockProvider, 'src/**/*.ts');

        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].error).toContain('String error message from AI');
      });

      it('should call onProgress callback even when errors occur', async () => {
        const mockFiles = [
          { name: 'file1.ts', path: '/test/project/src/file1.ts', type: 'file' as const },
          { name: 'file2.ts', path: '/test/project/src/file2.ts', type: 'file' as const },
        ];

        findFilesByPatternInFileTreeMock.mockReturnValue(mockFiles);
        matchesPatternMock.mockReturnValue(false);

        (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error('Test error')
        );

        const onProgress = vi.fn();

        await writer.writeTestByPattern(mockProvider, 'src/**/*.ts', undefined, onProgress);

        expect(onProgress).toHaveBeenCalledTimes(2);
        expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2, '/test/project/src/file1.ts', expect.any(Number));
        expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2, '/test/project/src/file2.ts', expect.any(Number));
      });

      it('should return empty results when no files match patterns', async () => {
        findFilesByPatternInFileTreeMock.mockReturnValue([]);

        const result = await writer.writeTestByPattern(mockProvider, 'nonexistent/**/*.ts');

        expect(result.files).toHaveLength(0);
        expect(result.failures).toHaveLength(0);
      });
    });
  });

  describe.skip('writeTestFile', () => {
    beforeEach(async () => {
      // Reset mock instance
      const { getMockWalkerInstance } = await import('@utils/file-walker');
      const mockInstance = getMockWalkerInstance();

      mockInstance.readFileFromProject.mockClear();
      mockInstance.writeFileToProject.mockClear();
      mockInstance.readFileFromProject.mockResolvedValue('export function add(a, b) { return a + b; }');
      mockInstance.writeFileToProject.mockResolvedValue(undefined);
    });
  });
});
