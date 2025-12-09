import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitTestWriter } from '../unit-test-writer';
import type { ProjectContext, FrameworkInfo } from '@models/project-context';
import { ConfigFile } from '@models/project-config-files';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';


vi.mock('@prompts/unit-test-prompt.txt', () => ({
  default: 'Generate unit test for {{TEST_FRAMEWORK}}.\n\nFramework Config:\n{{TEST_FRAMEWORK_CONFIG}}\n\nLanguage Config:\n{{LANGUAGE_CONFIGURATIONS}}\n\nFormatting:\n{{FORMATTING_RULES}}\n\nLinting:\n{{LINTING_RULES}}\n\nCode:\n{{CODE_SNIPPET}}',
}));

describe('UnitTestWriter', () => {
  let writer: UnitTestWriter;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

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

  describe('generateTest', () => {
    it('should generate test code with AI', async () => {
      const fileContent = 'export function add(a: number, b: number) { return a + b; }';
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        version: '1.0.0',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default {}',
      };

      const result = await writer.generateTest(
        mockProjectContext,
        fileContent,
        undefined,
        testFramework
      );

      expect(result).toBe('import { test } from "vitest";\ntest("should work", () => {});');
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledOnce();
    });

    it('should call AI client with correct parameters', async () => {
      const fileContent = 'function test() {}';
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        fileLang: 'typescript',
      };

      await writer.generateTest(mockProjectContext, fileContent, undefined, testFramework);

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
      const fileContent = 'const x = 1;';
      const testFramework: FrameworkInfo = {
        name: 'jest',
        fileLang: 'javascript',
      };

      await writer.generateTest(mockProjectContext, fileContent, undefined, testFramework);

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
      const fileContent = 'function test() {}';

      await writer.generateTest(mockProjectContext, fileContent);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      expect(promptContent).toContain('unknown framework');
    });

    it('should strip markdown code blocks from AI response', async () => {
      const fileContent = 'const x = 1;';

      const result = await writer.generateTest(mockProjectContext, fileContent);

      // Should not contain markdown code fences (validates real stripMarkdownCodeBlocks behavior)
      expect(result).not.toContain('```');
      expect(result).toContain('import { test }');
    });

    it('should throw error when AI returns no choices', async () => {
      (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [],
      });

      const fileContent = 'const x = 1;';

      await expect(writer.generateTest(mockProjectContext, fileContent)).rejects.toThrow(
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

      const fileContent = 'const x = 1;';

      await customWriter.generateTest(mockProjectContext, fileContent);

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
        const fileContent = 'const x = 1;';

        await writer.generateTest(mockProjectContext, fileContent, undefined, framework);

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

      const fileContent = 'const x = 1;';

      await writer.generateTest(mockProjectContext, fileContent, undefined, testFramework);

      const callArgs = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const promptContent = callArgs.messages[0].content;

      expect(promptContent).toContain('vitest.config.ts');
      expect(promptContent).toContain('globals: true');
      expect(promptContent).toContain('coverage: { enabled: true }');
    });

    it('should include all project configurations in prompt', async () => {
      const fileContent = 'const x = 1;';

      await writer.generateTest(mockProjectContext, fileContent);

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

      const fileContent = 'const x = 1;';
      const result = await writer.generateTest(mockProjectContext, fileContent);

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

      const fileContent = 'function add(a, b) { return a + b; }';
      const result = await writer.generateTest(mockProjectContext, fileContent);

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

      const fileContent = 'function test() {}';

      const result = await writer.generateTest(minimalContext, fileContent);

      expect(result).toBeTruthy();
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledOnce();
    });

    it('should pass testFileContent parameter when provided', async () => {
      const fileContent = 'export function add(a, b) { return a + b; }';
      const testFileContent = 'import { test } from "vitest";';

      await writer.generateTest(mockProjectContext, fileContent, testFileContent);

      // The testFileContent is currently not used in the prompt template,
      // but this test validates that it can be passed without errors
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledOnce();
    });
  });

  describe('integration with PromptTemplateBuilder', () => {
    it('should use PromptTemplateBuilder to format prompt', async () => {
      const fileContent = 'const x = 1;';
      const testFramework: FrameworkInfo = {
        name: 'vitest',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default {}',
      };

      await writer.generateTest(mockProjectContext, fileContent, undefined, testFramework);

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
      const fileContent = 'const x = 1;';

      await writer.generateTest(mockProjectContext, fileContent);

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

      const fileContent = 'const x = 1;';

      await expect(writer.generateTest(mockProjectContext, fileContent)).rejects.toThrow(
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

      const fileContent = 'const x = 1;';

      // null content will cause an error when stripMarkdownCodeBlocks tries to process it
      await expect(writer.generateTest(mockProjectContext, fileContent)).rejects.toThrow();
    });
  });
});
