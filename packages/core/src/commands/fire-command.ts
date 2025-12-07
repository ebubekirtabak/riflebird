import { Command, type CommandContext } from './base';
import { ProjectContextProvider } from '@providers/project-context-provider';
import { FrameworkInfo, ProjectContext } from '@models/project-context';
import { debug, info, generateTestFilePath, stripMarkdownCodeBlocks, ProjectFileWalker, findProjectRoot } from '@utils';

export type FireInput = {
  testPath: string;
};

export type FireOutput = {
  success: boolean;
  result?: string;
  error?: string;
};

/**
 * Fire command - Execute tests and analyze project structure
 *
 * Example:
 * ```ts
 * const result = await fireCommand.execute({
 *   testPath: 'tests/login.spec.ts'
 * });
 * ```
 */
export class FireCommand extends Command<FireInput, FireOutput> {
  constructor(context: CommandContext) {
    super(context);
  }

  async execute(input: FireInput): Promise<FireOutput> {
    this.validate(input);
    const { testPath } = input;

    if (testPath.trim().length === 0) {
      throw new Error('Riflebird Fire Command: testPath cannot be empty, we are not supporting running the entire test suite yet.');
    }

    info(`Test path to execute: ${testPath}`);

    try {
      const projectRoot = await findProjectRoot();
      info(`Project root found at: ${projectRoot}`);
      const provider = new ProjectContextProvider(this.context, projectRoot);
      const projectContext = await provider.getContext();
      const { testFrameworks } = projectContext;
      debug(`Project context:`, testFrameworks);

      if (testFrameworks?.unit) {
        debug(`Unit test framework configured: ${testFrameworks.unit.name}`);
        const fileContent =
          '```\n// ' + testPath + '\n' + await new ProjectFileWalker({ projectRoot }).readFileFromProject(testPath) + '\n```';

        console.log(`Test file content:\n${fileContent}`);
        const unitTestCode = await this.writeUnitTestFile(projectContext, fileContent, testFrameworks?.unit);

        // @todo: include test file content when test file already exists
        const testFilePath = generateTestFilePath(testPath);
        info(`Generated test file path: ${testFilePath}`);

        await new ProjectFileWalker({ projectRoot }).writeFileToProject(testFilePath, unitTestCode);

        info(`Unit test file written to: ${testFilePath}`);
      }

      return {
        success: true,
        result: 'Test execution completed',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }

  protected validate(input: FireInput): void {
    if (!input.testPath || input.testPath.trim().length === 0) {
      throw new Error('Test path cannot be empty');
    }
  }

  protected async writeUnitTestFile(
    projectContext: ProjectContext,
    fileContent: string,
    testFramework?: FrameworkInfo
  ): Promise<string> {
    const unitTestWriterPrompt = await import('@prompts/unit-test-prompt.txt');
    const { languageConfig, linterConfig, formatterConfig } = projectContext;

    const promptTemplate = unitTestWriterPrompt.default
      .replace(/\{\{TEST_FRAMEWORK\}\}/g, testFramework?.name || 'unknown framework')
      .replace(/\{\{TEST_FRAMEWORK_CONFIG\}\}/g, '```'+ testFramework?.fileLang + `\n// ${testFramework?.configFilePath}` + `\n${testFramework?.configContent || 'No specific configuration'}` + '```')
      .replace(/\{\{LANGUAGE_CONFIGURATIONS\}\}/g, '```'+ languageConfig.fileLang + `\n// ${languageConfig.configFilePath}` + `\n${languageConfig.configContent || 'No specific language configuration'}` + '```')
      .replace(/\{\{FORMATTING_RULES\}\}/g, '```'+ formatterConfig.fileLang + `\n// ${formatterConfig.configFilePath}` + `\n${formatterConfig.configContent || 'Follow project conventions'}` + '```')
      .replace(/\{\{LINTING_RULES\}\}/g, '```'+ linterConfig.fileLang + `\n// ${linterConfig.configFilePath}` + `\n${linterConfig.configContent || 'Follow project linting rules'}` + '```')
      .replace(/\{\{CODE_SNIPPET\}\}/g, fileContent);

    const { choices = [] } = await this.context.aiClient.createChatCompletion({
      model: this.context.config.ai.model,
      temperature: this.context.config.ai.temperature,
      response_format: { type: "json_object" },
      format: 'json',
      messages: [
        {
          role: 'system',
          content: promptTemplate,
        }
      ],
    });

    if (choices.length === 0) {
      throw new Error('AI did not return any choices for unit test generation');
    }

    let { content } = choices[0].message;

    const cleanContent = stripMarkdownCodeBlocks(content as string);

    return cleanContent;
  }

}
