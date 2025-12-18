import type { TestFile, AIClient, ProjectContext, FrameworkInfo } from '@models';
import {
  generateTestFilePathWithConfig,
  info,
  ProjectFileWalker,
  matchesPattern,
  debug,
  checkAndThrowFatalError,
  getFileTree,
  findFilesByPatternInFileTree,
  cleanCodeContent,
} from '@utils';
import { ProjectContextProvider } from '@providers/project-context-provider';
import type { RiflebirdConfig } from '@config/schema';
import { DEFAULT_FILE_EXCLUDE_PATTERNS, DEFAULT_UNIT_TEST_PATTERNS } from '@config/constants';
import { PromptTemplateBuilder } from './prompt-template-builder';
import {
  extractTestErrors,
  parseFailingTestsFromJson,
  runTest,
  getFailingTestsDetail,
  UnitTestErrorContext
} from '@runners/test-runner';
import { AgenticRunner } from '@agentic/agentic-runner';

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
    const healingConfig = this.options.config.healing;
    const isHealingEnabled = healingConfig?.enabled !== false && healingConfig?.mode === 'auto';
    const maxRetries = healingConfig?.maxRetries ?? 3;

    const fileWalker = new ProjectFileWalker({ projectRoot: projectContext.projectRoot });
    const fileContent = await fileWalker.readFileFromProject(testPath, true);
    const { projectRoot, unitTestOutputStrategy } = projectContext;

    debug(`Test file content:\n${fileContent}`);

    const testFilePath = generateTestFilePathWithConfig(testPath, {
      testOutputDir: this.options.config.unitTesting?.testOutputDir,
      projectRoot: projectRoot,
      strategy: unitTestOutputStrategy
    });

    let lastTestCode: string | undefined;
    let lastTestResult: Awaited<ReturnType<typeof runTest>> | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const unitTestCode = await this.generateOrFixTest(
          projectContext,
          {
            testPath,
            fileContent,
            testFilePath,
          },
          testFramework,
          attempt,
          lastTestCode,
          lastTestResult
        );

        info(`Generated test file path: ${testFilePath}${attempt > 1 ? ` (fix attempt ${attempt}/${maxRetries})` : ''}`);
        await fileWalker.writeFileToProject(testFilePath, unitTestCode);
        lastTestCode = unitTestCode;

        if (!isHealingEnabled) {
          return;
        }

        const { passed, result } = await this.verifyTest(
          projectContext,
          testFilePath,
          attempt,
          maxRetries
        );

        if (passed) {
          return; // Success!
        }

        lastTestResult = result;
        const errorInfo = extractTestErrors(result);
        debug(`Test output:\n${errorInfo}`);

        if (attempt < maxRetries) {
          info(`Will attempt to fix the test...`);
          continue; // Try again with fix
        } else {
          // Max retries reached
          throw new Error(
            `Test failed after ${maxRetries} attempts. Last error:\n${errorInfo.slice(0, 500)}`
          );
        }
      } catch (error) {
        checkAndThrowFatalError(error);

        if (attempt === maxRetries) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to process ${testPath}: ${message}`);
        }

        // Non-fatal error, continue to next attempt if healing is enabled
        if (!isHealingEnabled) {
          throw error;
        }

        info(`Error on attempt ${attempt}, retrying...`);
        debug(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async generateOrFixTest(
    projectContext: ProjectContext,
    params: {
      testPath: string;
      fileContent: string;
      testFilePath: string;
    },
    testFramework: FrameworkInfo | undefined,
    attempt: number,
    lastTestCode?: string,
    lastTestResult?: Awaited<ReturnType<typeof runTest>>
  ): Promise<string> {
    if (attempt === 1) {
      // First attempt: generate new test
      return this.generateTest(
        projectContext,
        {
          filePath: params.testPath,
          content: params.fileContent,
          testFilePath: params.testFilePath,
          testContent: '',
        },
        testFramework,
      );
    }

    if (lastTestResult && lastTestCode) {
      const failingTests = parseFailingTestsFromJson(lastTestResult);
      const errorContext = {
        failingTests,
        fullTestOutput: lastTestResult.stderr || lastTestResult.stdout,
      };

      return this.fixTest(
        projectContext,
        {
          filePath: params.testPath,
          content: params.fileContent,
          testFilePath: params.testFilePath,
          testContent: lastTestCode,
        },
        testFramework,
         errorContext
      );
    }

    // Fallback: If attempt > 1 but no result/code (e.g. generation failed), try generating again
    return this.generateTest(
      projectContext,
      {
        filePath: params.testPath,
        content: params.fileContent,
        testFilePath: params.testFilePath,
        testContent: '',
      },
      testFramework
    );
  }

  private async verifyTest(
    projectContext: ProjectContext,
    testFilePath: string,
    attempt: number,
    maxRetries: number
  ): Promise<{ passed: boolean; result: Awaited<ReturnType<typeof runTest>> }> {
    if (!projectContext.packageManager?.testCommand) {
      info('⚠ No test command configured, skipping test verification');
      return {
        passed: true,
        result: { success: true, stdout: '', stderr: '', jsonReport: null, exitCode: 0, duration: 0 }
      };
    }

    info(`Running test to verify: ${testFilePath}`);
    const { projectRoot } = projectContext;

    const testResult = await runTest(
      projectContext.packageManager.testCommand,
      {
        cwd: projectRoot,
        testFilePath: testFilePath,
        timeout: 30000,
        framework: projectContext.testFrameworks?.unit?.name as 'vitest' | 'jest' | 'mocha' | 'ava' | undefined,
      }
    );

    // Check if OUR specific test file passed (not the overall command)
    let ourTestFilePassed = false;

    if (testResult.jsonReport) {
      // If we have JSON report, check if our specific test file has any failures
      const ourTestFileResult = testResult.jsonReport.testResults.find(
        (result) => result.name.includes(testFilePath)
      );

      if (ourTestFileResult) {
        ourTestFilePassed = ourTestFileResult.status === 'passed';
      } else {
        ourTestFilePassed = true;
      }
    } else {
      ourTestFilePassed = testResult.success;
    }

    if (ourTestFilePassed) {
      info(`✓ Test passed successfully${attempt > 1 ? ` after ${attempt} attempt(s)` : ''}`);
      return { passed: true, result: testResult };
    }

    info(`✗ Test failed (attempt ${attempt}/${maxRetries})`);
    return { passed: false, result: testResult };
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
    const { languageConfig, linterConfig, formatterConfig, packageManager } = projectContext;
    const isCopilot = this.options.config.ai.provider === 'copilot-cli';

    // Copilot: Use original prompt (simple generation)
    if (isCopilot) {
      const unitTestWriterPrompt = await import('@prompts/unit-test-prompt.txt');
      const promptTemplate = this.promptBuilder.build(unitTestWriterPrompt.default, {
        testFramework,
        languageConfig,
        linterConfig,
        formatterConfig,
        targetFile,
        packageManager,
      });

      return this.simpleGeneration(promptTemplate);
    }

    // Agentic: Use agentic prompt + AgenticRunner
    const unitTestAgenticPrompt = await import('@prompts/unit-test-agentic-prompt.txt');
    const promptTemplate = this.promptBuilder.build(unitTestAgenticPrompt.default, {
      testFramework,
      languageConfig,
      linterConfig,
      formatterConfig,
      targetFile,
      packageManager,
    });

    const runner = new AgenticRunner({
      aiClient: this.options.aiClient,
      config: this.options.config,
      projectRoot: projectContext.projectRoot,
    });

    return runner.run(promptTemplate);
  }

  /**
   * Simple one-shot generation (for Copilot or fallback)
   */
  private async simpleGeneration(prompt: string): Promise<string> {
    try {
      const response = await this.options.aiClient.createChatCompletion({
        model: this.options.config.ai.model,
        temperature: this.options.config.ai.temperature,
        messages: [{ role: 'system', content: prompt }],
      });

      const { choices = [] } = response;
      if (choices.length === 0) {
        throw new Error('AI did not return any choices for unit test generation');
      }

      const { content } = choices[0].message;
      return cleanCodeContent(content as string);
    } catch (error) {
      checkAndThrowFatalError(error);
      throw error;
    }
  }

  /**
   * Fix a failing test by analyzing errors and generating corrected version
   * @param projectContext - Project context with configurations
   * @param targetFile - Target file information with failed test code
   * @param testFramework - Test framework configuration
   * @param errorContext - Parsed failing tests from JSON report with specific error details
   * @returns Fixed test code
   */
  async fixTest(
    projectContext: ProjectContext,
    targetFile: TestFile,
    testFramework?: FrameworkInfo,
    errorContext?: UnitTestErrorContext
  ): Promise<string> {
    const { languageConfig, linterConfig, formatterConfig, packageManager } = projectContext;
    const failingTestsDetail = getFailingTestsDetail(errorContext);
    const isCopilot = this.options.config.ai.provider === 'copilot-cli';

    // Copilot: Use original prompt
    if (isCopilot) {
      const unitTestFixPrompt = await import('@prompts/unit-test-fix-prompt.txt');
      const promptTemplate = this.promptBuilder.build(unitTestFixPrompt.default, {
        testFramework,
        languageConfig,
        linterConfig,
        formatterConfig,
        targetFile: {
          ...targetFile,
          content: targetFile.content,
        },
        packageManager,
        failed_test_code: targetFile.testContent,
        failing_tests_detail: failingTestsDetail,
      });

      return this.simpleGeneration(promptTemplate);
    }

    // Agentic: Use agentic prompt + AgenticRunner
    const unitTestFixAgenticPrompt = await import('@prompts/unit-test-fix-agentic-prompt.txt');
    const promptTemplate = this.promptBuilder.build(unitTestFixAgenticPrompt.default, {
      testFramework,
      languageConfig,
      linterConfig,
      formatterConfig,
      targetFile: {
        ...targetFile,
        content: targetFile.content,
      },
      packageManager,
      failed_test_code: targetFile.testContent,
      failing_tests_detail: failingTestsDetail,
    });

    const runner = new AgenticRunner({
      aiClient: this.options.aiClient,
      config: this.options.config,
      projectRoot: projectContext.projectRoot,
    });

    return runner.run(promptTemplate);
  }
}
