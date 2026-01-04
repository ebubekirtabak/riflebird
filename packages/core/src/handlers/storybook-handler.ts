import { cleanCodeContent, checkAndThrowFatalError, debug } from '@utils';
import { executeProcessCommand } from '@runners/process-execution';
import type { AIClient, ProjectContext, TestFile } from '@models';
import type { RiflebirdConfig } from '@config/schema';
import { PromptTemplateBuilder } from '@commands/fire/prompt-template-builder';
import { DEFAULT_FILE_EXCLUDE_PATTERNS } from '@config/constants';
import { DocumentFrameworkHandler } from './document-framework';
import { FRAMEWORK_CONFIGS } from './framework-configs';

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

    let visualTestingRules = '';
    if (this.options.config.documentation?.visual?.enabled) {
      visualTestingRules = `
Visual Testing Best Practices (CRITICAL):
1. Deterministic Data: Avoid Math.random(), Date.now(), or any non-deterministic data. Use static dates (e.g., '2024-01-01') and seeds.
2. Stable Snapshots: Ensure loading states, animations, or spinners are paused or have a static fallback for snapshots.
3. Interaction Testing: Use expectations within the 'play' function to verify interactions (e.g., opening a dropdown) so hidden content is revealed for the snapshot.
4. Explicit States: Generate separate stories for 'Loading', 'Empty', 'Error' states to ensure full visual coverage.
      `.trim();
    }

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
      visual_testing_rules: visualTestingRules,
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
    try {
      const extraArgs = this.getTscArgsForFramework(configFiles.framework?.name);
      const tscArgs = ['tsc', '--noEmit', '--skipLibCheck', filePath, ...extraArgs];

      const result = await executeProcessCommand('npx', tscArgs, {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      if (result.exitCode !== 0) {
        const validationErrors =
          result.stdout && result.stdout.trim()
            ? result.stdout
            : result.stderr || `TSC failed with exit code ${result.exitCode}`;

        debug(`Story validation failed for ${filePath}: ${validationErrors}`);
        return validationErrors;
      }

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

  private getTscArgsForFramework(frameworkName?: string): string[] {
    const name = frameworkName?.toLowerCase();
    if (!name) {
      return [];
    }

    for (const config of Object.values(FRAMEWORK_CONFIGS)) {
      if (config.aliases.includes(name)) {
        return config.tscArgs;
      }
    }

    return [];
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
