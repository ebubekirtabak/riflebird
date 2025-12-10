import type { ProjectContext, FrameworkInfo } from '@models/project-context';
import { findFilesByStringPattern, generateTestFilePath, info, ProjectFileWalker, stripMarkdownCodeBlocks } from '@utils';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';
import { PromptTemplateBuilder } from './prompt-template-builder';


export type UnitTestWriterOptions = {
  aiClient: AIClient;
  config: RiflebirdConfig;
};

export class UnitTestWriter {
  private promptBuilder: PromptTemplateBuilder;

  constructor(private options: UnitTestWriterOptions) {
    this.promptBuilder = new PromptTemplateBuilder();
  }

  async writeTestByPattern(
    projectContext: ProjectContext,
    fileWalker: ProjectFileWalker,
    pattern: string,
    testFramework?: FrameworkInfo
  ): Promise<string[]> {
    const { projectRoot } = projectContext;
    const matchedFiles = await findFilesByStringPattern(projectRoot, pattern);
    const results: string[] = [];

    for (const file of matchedFiles) {
      const success = await this.writeTestFile(
        projectContext,
        fileWalker,
        file.path,
        testFramework
      );
      if (success) {
        const testFilePath = generateTestFilePath(file.path);
        results.push(`Unit test: ${testFilePath}`);
      }
    }

    return results;
  }

  async writeTestFile(
    projectContext: ProjectContext,
    fileWalker: ProjectFileWalker,
    testPath: string,
    testFramework?: FrameworkInfo
  ): Promise<boolean> {
    try {
      const fileContent = await fileWalker.readFileFromProject(testPath, true);
      console.log(`Test file content:\n${fileContent}`);
      const unitTestCode = await this.generateTest(projectContext, fileContent, '', testFramework);
      // @todo: include test file content when test file already exists
      const testFilePath = generateTestFilePath(testPath);
      info(`Generated test file path: ${testFilePath}`);
      await fileWalker.writeFileToProject(testFilePath, unitTestCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      info(`Failed to write test file for ${testPath}: ${message}`);
      return false;
    }

    return true;
  }

  /**
   * Generate unit test code for a file
   * @param projectContext - Project context with configurations
   * @param fileContent - Source file content wrapped in markdown
   * @param testFileContent - Test file content wrapped in markdown
   * @param testFramework - Test framework configuration
   * @returns Generated test code
   */
  async generateTest(
    projectContext: ProjectContext,
    fileContent: string,
    testFileContent?: string,
    testFramework?: FrameworkInfo
  ): Promise<string> {
    const unitTestWriterPrompt = await import('@prompts/unit-test-prompt.txt');
    const { languageConfig, linterConfig, formatterConfig } = projectContext;

    const promptTemplate = this.promptBuilder.build(unitTestWriterPrompt.default, {
      testFramework,
      languageConfig,
      linterConfig,
      formatterConfig,
      fileContent,
      testFileContent
    });

    const { choices = [] } = await this.options.aiClient.createChatCompletion({
      model: this.options.config.ai.model,
      temperature: this.options.config.ai.temperature,
      response_format: { type: 'json_object' },
      format: 'json',
      messages: [
        {
          role: 'system',
          content: promptTemplate,
        },
      ],
    });

    if (choices.length === 0) {
      throw new Error('AI did not return any choices for unit test generation');
    }

    const { content } = choices[0].message;
    const cleanContent = stripMarkdownCodeBlocks(content as string);

    return cleanContent;
  }
}
