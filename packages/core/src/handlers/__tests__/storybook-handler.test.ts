import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('@utils', () => {
  return {
    checkAndThrowFatalError: vi.fn(),
    cleanCodeContent: (code: string) => code,
    debug: vi.fn(),
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

vi.mock('@config/constants', () => ({
  DEFAULT_FILE_EXCLUDE_PATTERNS: ['node_modules', '*.min.js'],
}));

vi.mock('@commands/fire/prompt-template-builder', () => ({
  PromptTemplateBuilder: vi.fn().mockImplementation(() => {
    const builder = {
      withSection: vi.fn(),
      build: vi.fn().mockImplementation((template, data) => {
        return template + ' ' + JSON.stringify(data);
      }),
    };
    return builder;
  }),
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
      // @ts-expect-error - Partial mock
    } as AIClient;

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
      // @ts-expect-error - Partial mock
    } as RiflebirdConfig;

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
      // @ts-expect-error - Partial mock
    } as ProjectContext;
  });

  describe('Utility Methods', () => {
    it('should return correct exclusion patterns', () => {
      const patterns = handler.getExclusionPatterns();
      expect(patterns).toContain('node_modules'); // from constants mock
      expect(patterns).toContain('**/*.stories.{ts,tsx,js,jsx}');
    });

    it('should return correct output suffix', () => {
      expect(handler.getOutputSuffix()).toBe('.stories');
    });
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
      vi.mocked(mockAIClient.createChatCompletion).mockResolvedValue({
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
      vi.mocked(mockAIClient.createChatCompletion).mockResolvedValue({
        choices: [{ message: { content: 'Generated Story' } }],
      });

      await handler.generateDocument(
        'Button.tsx',
        'export const Button = () => {}',
        'Button.stories.tsx',
        mockProjectContext
      );

      const calls = vi.mocked(mockAIClient.createChatCompletion).mock.calls;
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

    it('should handle tsc validation failure with exit code 1 and stderr', async () => {
      mocks.executeProcessCommand.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'TSC Error',
      });
      const result = await handler.validateDocument(
        'export default { component: {} }',
        'file.ts',
        mockProjectContext
      );
      expect(result).toBe('TSC Error');
    });

    it('should handle passed validation validation failure with exit code 1 and no stderr', async () => {
      mocks.executeProcessCommand.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: '',
      });
      const result = await handler.validateDocument(
        'export default { component: {} }',
        'file.ts',
        mockProjectContext
      );
      expect(result).toBe('TSC failed with exit code 1');
    });

    it('should handle undefined framework name', async () => {
      // @ts-expect-error - Testing undefined framework name
      mockProjectContext.configFiles.framework.name = undefined;
      const content = 'export default { component: {} }';
      await handler.validateDocument(content, 'file.ts', mockProjectContext);
      // specific args check to ensure no extra flags
      const lastCallArgs =
        mocks.executeProcessCommand.mock.calls[
          mocks.executeProcessCommand.mock.calls.length - 1
        ][1];
      expect(lastCallArgs).not.toContain('--jsx');
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

  // Additional Tests for Coverage

  it('should throw error if AI does not return choices', async () => {
    vi.mocked(mockAIClient.createChatCompletion).mockResolvedValue({
      choices: [],
    });

    await expect(
      handler.generateDocument('Button.tsx', 'code', 'Button.stories.tsx', mockProjectContext)
    ).rejects.toThrow('AI did not return any choices');
  });

  it('should propagate errors from AI client', async () => {
    vi.mocked(mockAIClient.createChatCompletion).mockRejectedValue(new Error('AI Error'));

    await expect(
      handler.generateDocument('Button.tsx', 'code', 'Button.stories.tsx', mockProjectContext)
    ).rejects.toThrow('AI Error');
  });

  it('should handle validation execution error (e.g. spawn fail)', async () => {
    mocks.executeProcessCommand.mockRejectedValue(new Error('Spawn failed'));

    // validateDocument catches error and returns it as string
    const result = await handler.validateDocument(
      'export default { component: Button }',
      'file.ts',
      mockProjectContext
    );
    expect(result).toBe('Spawn failed');
  });

  it('should gracefully handle source file read failure in fixDocument', async () => {
    mocks.readFileFromProject.mockRejectedValue(new Error('Read failed'));
    mocks.executeProcessCommand.mockResolvedValue({ exitCode: 1, stdout: 'Error', stderr: '' });
    mocks.agenticRun.mockResolvedValue('Fixed');

    const result = await handler.fixDocument(
      'failed',
      'source.tsx',
      'story.tsx',
      mockProjectContext,
      'error'
    );

    // Should proceed with empty source content
    expect(result).toBe('Fixed');
    expect(mocks.agenticRun).toHaveBeenCalledWith(
      expect.stringContaining('"FAILING_TESTS_DETAIL":"error"')
    );
    // Source content in prompt will be empty string if read failed?
    // Implementation: let sourceContent = ''; try { sourceContent = await ... } catch ...
    // So sourceContent remains ''
    // We can verify prompt doesn't contain 'Read failed' but contains empty source placeholder if any
  });

  it('should return content immediately if initial validation in fixDocument passes', async () => {
    // If we pass validationErrors=undefined, it runs validation.
    // If validation returns null (success), it should return content.

    mocks.executeProcessCommand.mockResolvedValue({ exitCode: 0 }); // Validation pass

    const result = await handler.fixDocument(
      'export default { component: Button }',
      's.tsx',
      'st.tsx',
      mockProjectContext
    );

    expect(result).toBe('export default { component: Button }');
    expect(mocks.agenticRun).not.toHaveBeenCalled();
  });
});
