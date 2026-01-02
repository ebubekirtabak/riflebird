import { cleanCodeContent, checkAndThrowFatalError, executeProcessCommand, debug } from '@utils';
import type { AIClient, ProjectContext, TestFile } from '@models';
import type { RiflebirdConfig } from '@config/schema';
import { PromptTemplateBuilder } from '@commands/fire/prompt-template-builder';
import { DEFAULT_FILE_EXCLUDE_PATTERNS } from '@config/constants';
import { DocumentFrameworkHandler } from './document-framework';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type StorybookHandlerOptions = {
  aiClient: AIClient;
  config: RiflebirdConfig;
};

export class StorybookDocumentHandler implements DocumentFrameworkHandler {
  private promptBuilder: PromptTemplateBuilder;

  constructor(private options: StorybookHandlerOptions) {
    this.promptBuilder = new PromptTemplateBuilder();
  }

  getExclusionPatterns(): string[] {
    return [
      ...new Set([
        ...DEFAULT_FILE_EXCLUDE_PATTERNS,
        '**/*.stories.{ts,tsx,js,jsx}',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
      ]),
    ];
  }

  getOutputSuffix(): string {
    return '.stories';
  }

  async generateDocument(
    sourceFilePath: string,
    sourceFileContent: string,
    outputFilePath: string,
    projectContext: ProjectContext
  ): Promise<string | null> {
    const { languageConfig, linterConfig, formatterConfig, configFiles } = projectContext;
    const extension = sourceFilePath.split('.').pop() || '';
    const { framework, language } = configFiles;

    // @todo: Make this import robust or dependency injected if possible
    const promptTemplate = await import('@prompts/storybook-story-prompt.txt');

    const prompt = this.promptBuilder.build(promptTemplate.default, {
      framework: framework.name,
      language,
      component_name: sourceFilePath,
      component_code: sourceFileContent,
      existing_stories: '', // @todo: Add support for existing stories context if needed
      extension,
      languageConfig,
      linterConfig,
      formatterConfig,
      targetFile: {
        filePath: sourceFilePath,
        content: sourceFileContent,
        testFilePath: outputFilePath,
        testContent: '',
      } as TestFile,
    });

    try {
      const response = await this.options.aiClient.createChatCompletion({
        model: this.options.config.ai.model,
        temperature: 0.2,
        messages: [{ role: 'system', content: prompt }],
      });

      const { choices = [] } = response;
      if (choices.length === 0) {
        throw new Error('AI did not return any choices for story generation');
      }

      const { content } = choices[0].message;
      return cleanCodeContent(content as string);
    } catch (error) {
      checkAndThrowFatalError(error);
      throw error;
    }
  }

  async validateDocument(
    content: string,
    filePath: string,
    projectContext: ProjectContext
  ): Promise<string | null> {
    const { projectRoot, configFiles } = projectContext;
    // 1. Basic Content Checks
    if (!content.includes('export default')) {
      return 'Missing "export default"';
    }
    if (!content.includes('component:')) {
      return 'Missing "component:" in default export';
    }

    // 2. TSC Validation
    // Validate the actual document file path as requested by the user
    // "that's why you whould save the document file anyway"

    // Use the provided filePath as the target.
    // NOTE: It is the caller's responsibility to pass the correct DOCUMENT path, not source path.
    const absolutePath = join(projectRoot, filePath);

    try {
      await writeFile(absolutePath, content, 'utf8');

      const frameworkName = configFiles.framework?.name?.toLowerCase();
      const tscArgs = ['tsc', '--noEmit', '--skipLibCheck', absolutePath];

      if (frameworkName === 'react') {
        tscArgs.push('--jsx', 'react-jsx');
      } else if (frameworkName === 'angular') {
        tscArgs.push('--experimentalDecorators', '--emitDecoratorMetadata');
      }

      await executeProcessCommand('npx', tscArgs, {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      return null; // Success (no errors)
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      // TypeScript errors are typically in stdout. Stderr often contains noise (debugger attached, etc.)
      const validationErrors =
        err.stdout && err.stdout.trim() ? err.stdout : err.stderr || err.message || String(error);
      debug(`Story validation failed for ${filePath}: ${validationErrors}`);
      return validationErrors;
    }
  }

  async fixDocument(
    content: string,
    filePath: string,
    storyFilePath: string,
    projectContext: ProjectContext,
    validationErrors?: string
  ): Promise<string | null> {
    const { projectRoot } = projectContext;
    let errors = validationErrors;

    // If no validation errors provided, we might need to run validation again to find them.
    // We must validate the STORY file, not the source file.
    if (!errors) {
      errors = (await this.validateDocument(content, storyFilePath, projectContext)) || '';
    }

    if (!errors) {
      return content;
    }

    const { languageConfig, linterConfig, formatterConfig, configFiles } = projectContext;
    const { framework } = configFiles;
    const extension = filePath.split('.').pop() || '';
    const promptTemplate = await import('@prompts/storybook-story-fix-agentic-prompt.txt');

    const { ProjectFileWalker } = await import('@utils');
    const walker = new ProjectFileWalker({ projectRoot });
    let sourceContent = '';
    try {
      sourceContent = await walker.readFileFromProject(filePath);
    } catch {
      debug(`Could not read original source file: ${filePath}`);
    }

    const prompt = this.promptBuilder.build(promptTemplate.default, {
      framework: framework.name,
      languageConfig,
      linterConfig,
      formatterConfig,
      targetFile: {
        filePath: filePath,
        content: sourceContent,
        testFilePath: filePath,
        testContent: content,
      } as TestFile & { [key: string]: unknown },
      EXTENSION: extension,
      FAILED_TEST_CODE: content,
      FAILING_TESTS_DETAIL: errors || 'Validation failed with unknown error',
      FILE_PATH: filePath,
      CODE_SNIPPET: sourceContent,
    });

    const { AgenticRunner } = await import('@agentic/agentic-runner');
    const runner = new AgenticRunner({
      aiClient: this.options.aiClient,
      config: this.options.config,
      projectRoot,
    });

    return runner.run(prompt);
  }
}
