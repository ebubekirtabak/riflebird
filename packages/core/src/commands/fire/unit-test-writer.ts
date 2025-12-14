import type { ProjectContext, FrameworkInfo } from '@models/project-context';
import {
  generateTestFilePathWithConfig,
  info,
  ProjectFileWalker,
  stripMarkdownCodeBlocks,
  matchesPattern,
  debug,
  checkAndThrowFatalError,
  getFileTree,
  findFilesByPatternInFileTree,
} from '@utils';
import { ProjectContextProvider } from '@providers/project-context-provider';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';
import { DEFAULT_FILE_EXCLUDE_PATTERNS, DEFAULT_UNIT_TEST_PATTERNS } from '@config/constants';
import { PromptTemplateBuilder } from './prompt-template-builder';
import type { TestFile } from '@models';

export type UnitTestWriterOptions = {
  aiClient: AIClient;
  config: RiflebirdConfig;
};

export type PatternResult = {
  files: string[];
  failures: Array<{ file: string; error: string }>;
};

export class UnitTestWriter {
  private promptBuilder: PromptTemplateBuilder;

  constructor(private options: UnitTestWriterOptions) {
    this.promptBuilder = new PromptTemplateBuilder();
  }

  getExclusionPatternsForUnitTesting(): string[] {
    // Combine user-defined and default exclusion patterns
    const userExcludes = this.options.config.unitTesting?.testMatch || [];
    return [
      ...new Set([...userExcludes, ...DEFAULT_UNIT_TEST_PATTERNS, ...DEFAULT_FILE_EXCLUDE_PATTERNS]),
    ];
  }

  /**
   * Write tests for one or more patterns efficiently
   * When multiple patterns are provided, pulls the file tree only once for optimal performance
   *
   * @param provider - Project context provider
   * @param patterns - Single pattern string or array of glob patterns to match files
   * @param testFramework - Test framework configuration
   * @param onProgress - Progress callback
   * @returns Aggregated results from all patterns
   */
  async writeTestByPattern(
    provider: ProjectContextProvider,
    patterns: string | string[],
    testFramework?: FrameworkInfo,
    onProgress?: (current: number, total: number, file: string, elapsedMs: number) => void
  ): Promise<PatternResult> {
    const projectContext = await provider.getContext();
    const { projectRoot } = projectContext;
    const exclusionPatterns = this.getExclusionPatternsForUnitTesting();

    // Normalize patterns: remove leading ./ and convert to array
    const patternArray = (Array.isArray(patterns) ? patterns : [patterns])
      .map(p => p.replace(/^\.\//, ''));

    info(`Searching for files with pattern(s): ${patternArray.join(', ')}`);

    const fileTree = await getFileTree(projectRoot);

    const matchedFiles = findFilesByPatternInFileTree(fileTree, patternArray);
    info(`Found ${matchedFiles.length} files matching pattern(s)`);

    // Filter out excluded files (test files, storybook files, etc.)
    const filesToProcess = matchedFiles.filter(file => {
      for (const excludePattern of exclusionPatterns) {
        if (matchesPattern(file.name, file.path, [excludePattern], false)) {
          return false;
        }
      }
      return true;
    });
    info(`After exclusions: ${filesToProcess.length} files to process`);

    const results: string[] = [];
    const failures: Array<{ file: string; error: string }> = [];
    let current = 0;
    const total = filesToProcess.length;
    const startTime = Date.now();

    for (const file of filesToProcess) {
      current++;
      if (onProgress) {
        onProgress(current, total, file.path, Date.now() - startTime);
      }

      try {
        await this.writeTestFile(
          projectContext,
          file.path,
          testFramework,
        );
        results.push(`Unit test: ${file.path}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checkAndThrowFatalError(error);

        failures.push({ file: file.path, error: message });
      }
    }

    return { files: results, failures };
  }

  async writeTestFile(
    projectContext: ProjectContext,
    testPath: string,
    testFramework?: FrameworkInfo,
  ): Promise<void> {
    try {
      const fileWalker = new ProjectFileWalker({ projectRoot: projectContext.projectRoot });
      const fileContent = await fileWalker.readFileFromProject(testPath, true);
      const { projectRoot, unitTestOutputStrategy } = projectContext;
      debug(`Test file content:\n${fileContent}`);
      const testFilePath = generateTestFilePathWithConfig(testPath, {
        testOutputDir: this.options.config.unitTesting?.testOutputDir,
        projectRoot: projectRoot,
        strategy: unitTestOutputStrategy
      });
      // @todo: include test file content when test file already exists
      const unitTestCode = await this.generateTest(
        projectContext,
        {
          filePath: testPath,
          content: fileContent,
          testFilePath: testFilePath,
          testContent: '',
        },
        testFramework
      );
      info(`Generated test file path: ${testFilePath}`);
      await fileWalker.writeFileToProject(testFilePath, unitTestCode);
    } catch (error) {
      // Check for fatal AI errors first (these should stop execution immediately)
      checkAndThrowFatalError(error);

      const message = error instanceof Error ? error.message : String(error);
      // Enhance error message with context
      throw new Error(`Failed to process ${testPath}: ${message}`);
    }
  }

  /**
   * Generate unit test code for a file
   * @param projectContext - Project context with configurations
   * @param targetFile - Target file information
   * @param testFramework - Test framework configuration
   * @returns Generated test code
   */
  async generateTest(
    projectContext: ProjectContext,
    targetFile: TestFile,
    testFramework?: FrameworkInfo,
  ): Promise<string> {
    const unitTestWriterPrompt = await import('@prompts/unit-test-prompt.txt');
    const { languageConfig, linterConfig, formatterConfig } = projectContext;

    const promptTemplate = this.promptBuilder.build(unitTestWriterPrompt.default, {
      testFramework,
      languageConfig,
      linterConfig,
      formatterConfig,
      targetFile,
    });

    try {
      const response = await this.options.aiClient.createChatCompletion({
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

      const { choices = [] } = response;
      if (choices.length === 0) {
        throw new Error('AI did not return any choices for unit test generation');
      }

      const { content } = choices[0].message;
      const cleanContent = stripMarkdownCodeBlocks(content as string);

      return cleanContent;
    } catch (error) {
      // Check for rate limit or quota exceeded errors
      checkAndThrowFatalError(error);

      throw error;
    }
  }
}
