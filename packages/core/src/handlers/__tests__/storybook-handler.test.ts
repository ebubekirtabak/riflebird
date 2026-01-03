import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { StorybookDocumentHandler } from '../storybook-handler';
import { AIClient, ProjectContext } from '@models';
import { RiflebirdConfig } from '@config/schema';

// Mocks
const mocks = vi.hoisted(() => ({
  executeProcessCommand: vi.fn(),
  readFileFromProject: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  agenticRun: vi.fn(),
}));

vi.mock('@utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@utils')>();
  return {
    ...actual,
    checkAndThrowFatalError: vi.fn(),
    cleanCodeContent: (code: string) => code,
    ProjectFileWalker: vi.fn().mockImplementation(() => ({
      readFileFromProject: mocks.readFileFromProject,
    })),
  };
});

vi.mock('@runners/process-execution', () => ({
  executeProcessCommand: mocks.executeProcessCommand,
}));

vi.mock('node:fs/promises', async () => ({
  writeFile: mocks.writeFile,
  unlink: mocks.unlink,
}));

vi.mock('node:fs', async () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock AgenticRunner
vi.mock('@agentic/agentic-runner', () => ({
  AgenticRunner: vi.fn().mockImplementation(() => ({
    run: mocks.agenticRun,
  })),
}));

// Mock Prompt Text
vi.mock('@prompts/storybook-story-fix-agentic-prompt.txt', () => ({
  default: 'Errors: {{FAILING_TESTS_DETAIL}} Source: {{CODE_SNIPPET}}',
}));

vi.mock('@prompts/storybook-story-prompt.txt', () => ({
  default: 'Prompt with: {{VISUAL_TESTING_RULES}}',
}));

describe('StorybookDocumentHandler', () => {
  let handler: StorybookDocumentHandler;
  let mockAIClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAIClient = {
      createChatCompletion: vi.fn(),
      createCompletion: vi.fn(),
    } as unknown as AIClient;

    mockConfig = {
      ai: {
        model: 'gpt-4',
        provider: 'openai',
        temperature: 0.2,
      },
      project: {
        languageConfig: {},
        linterConfig: {},
        formatterConfig: {},
      },
    } as unknown as RiflebirdConfig;

    handler = new StorybookDocumentHandler({
      aiClient: mockAIClient,
      config: mockConfig,
    });

    mockProjectContext = {
      projectRoot: '/root',
      configFiles: {
        framework: { name: 'react' },
        language: { name: 'typescript', fileLang: 'ts' },
      },
      languageConfig: { name: 'typescript', fileLang: 'ts' },
      linterConfig: { name: 'eslint', fileLang: 'json' },
      formatterConfig: { name: 'prettier', fileLang: 'json' },
    } as unknown as ProjectContext;
  });

  describe('generateDocument', () => {
    it('should include visual testing rules when enabled', async () => {
      // @ts-ignore
      mockConfig.documentation = { visual: { enabled: true } };
      // Force update options
      handler = new StorybookDocumentHandler({
        aiClient: mockAIClient,
        config: mockConfig,
      });

      // Mock AI response
      (mockAIClient.createChatCompletion as Mock).mockResolvedValue({
        choices: [{ message: { content: 'Generated Story' } }],
      });

      await handler.generateDocument(
        'Button.tsx',
        'export const Button = () => {}',
        'Button.stories.tsx',
        mockProjectContext
      );

      expect(mockAIClient.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Visual Testing Best Practices'),
            }),
          ]),
        })
      );
    });

    it('should not include visual testing rules when disabled', async () => {
      // @ts-ignore
      mockConfig.documentation = { visual: { enabled: false } };
      handler = new StorybookDocumentHandler({
        aiClient: mockAIClient,
        config: mockConfig,
      });

      // Mock AI response
      (mockAIClient.createChatCompletion as Mock).mockResolvedValue({
        choices: [{ message: { content: 'Generated Story' } }],
      });

      await handler.generateDocument(
        'Button.tsx',
        'export const Button = () => {}',
        'Button.stories.tsx',
        mockProjectContext
      );

      const calls = (mockAIClient.createChatCompletion as Mock).mock.calls;
      const prompt = calls[0][0].messages[0].content;
      // Should result in empty string replacement or just not containing the rules header
      expect(prompt).not.toContain('Visual Testing Best Practices');
    });
  });

  describe('validateDocument', () => {
    it('should use React-specific tsc flags when framework is React', async () => {
      mockProjectContext.configFiles.framework.name = 'react';
      const content = 'export default { component: {} }';
      const filePath = 'Button.stories.tsx';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--jsx', 'react-jsx']),
        expect.objectContaining({ cwd: '/root' })
      );
    });

    it('should use React-specific tsc flags when framework is Next.js', async () => {
      mockProjectContext.configFiles.framework.name = 'next.js';
      const content = 'export default { component: {} }';
      const filePath = 'Button.stories.tsx';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--jsx', 'react-jsx']),
        expect.objectContaining({ cwd: '/root' })
      );
    });

    it('should use React-specific tsc flags when framework is Remix', async () => {
      mockProjectContext.configFiles.framework.name = 'remix';
      const content = 'export default { component: {} }';
      const filePath = 'Button.stories.tsx';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--jsx', 'react-jsx']),
        expect.objectContaining({ cwd: '/root' })
      );
    });

    it('should use Angular-specific tsc flags when framework is Angular', async () => {
      mockProjectContext.configFiles.framework.name = 'angular';
      const content = 'export default { component: {} }';
      const filePath = 'Button.stories.ts';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--experimentalDecorators', '--emitDecoratorMetadata']),
        expect.objectContaining({ cwd: '/root' })
      );
    });

    it('should use Solid-specific tsc flags when framework is Solid', async () => {
      mockProjectContext.configFiles.framework.name = 'solid';
      const content = 'export default { component: {} }';
      const filePath = 'Button.stories.tsx';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--jsx', 'preserve']),
        expect.objectContaining({ cwd: '/root' })
      );
    });

    it('should use Vue-specific tsc flags when framework is Nuxt', async () => {
      mockProjectContext.configFiles.framework.name = 'nuxt';
      const content = 'export default { component: {} }';
      const filePath = 'Button.stories.ts';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--jsx', 'react-jsx']),
        expect.objectContaining({ cwd: '/root' })
      );
    });

    it('should use default tsc flags for unknown frameworks', async () => {
      mockProjectContext.configFiles.framework.name = 'unknown-framework';
      const content = 'export default { component: {} }';

      const filePath = 'Button.stories.ts';

      await handler.validateDocument(content, filePath, mockProjectContext);

      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc']),
        expect.objectContaining({ cwd: '/root' })
      );
      expect(mocks.executeProcessCommand).not.toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['--jsx', 'react-jsx']),
        expect.anything()
      );
      // Better check: ensure the args array doesn't contain react-jsx
      const calls = mocks.executeProcessCommand.mock.calls;
      const lastCallArgs = calls[calls.length - 1][1];
      expect(lastCallArgs).not.toContain('react-jsx');
      expect(lastCallArgs).not.toContain('--experimentalDecorators');
    });
  });

  describe('fixDocument', () => {
    it('should run validation, build prompt with errors, and call agentic runner', async () => {
      const invalidContent = 'export default { component: Button }';
      const componentPath = 'src/components/Button.tsx';
      const sourceContent = 'export const Button = () => <button />';

      // Mock reading source file
      mocks.readFileFromProject.mockResolvedValue(sourceContent);

      // Mock validation failure (executeProcessCommand returns non-zero exit code)
      const validationResult = {
        exitCode: 1,
        stdout: 'Error: Component not exported',
        stderr: '',
        timedOut: false,
      };
      mocks.executeProcessCommand.mockResolvedValue(validationResult);

      // Mock AgenticRunner Success
      mocks.agenticRun.mockResolvedValue('Fixed Content');

      const storyPath = 'src/components/Button.stories.tsx';
      const result = await handler.fixDocument(
        invalidContent,
        componentPath,
        storyPath,
        mockProjectContext
      );

      expect(result).toBe('Fixed Content');

      // Verify validation runs
      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['tsc', '--noEmit']),
        expect.objectContaining({ stdio: 'pipe' })
      );

      // Verify Agentic Runner called
      expect(mocks.agenticRun).toHaveBeenCalledWith(
        expect.stringContaining('Error: Component not exported')
      );
      expect(mocks.agenticRun).toHaveBeenCalledWith(expect.stringContaining(sourceContent));
    });

    it('should handle validation success (weird case) and still run runner', async () => {
      const content = 'export default {}';
      mocks.readFileFromProject.mockResolvedValue('');
      // Success returns object with exitCode 0
      mocks.executeProcessCommand.mockResolvedValue({
        exitCode: 0,
        stdout: 'Success Output',
        stderr: '',
        timedOut: false,
      });
      mocks.agenticRun.mockResolvedValue('Fixed Content');

      await handler.fixDocument(content, 'test.tsx', 'test.stories.tsx', mockProjectContext);

      // Should still run, but validation errors might be empty or success output?
      // Logic: if !result.success ... wait, we removed that check.
      // So validationErrors will be empty string.
      expect(mocks.agenticRun).toHaveBeenCalled();
    });
  });
});
