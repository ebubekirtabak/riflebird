import { Command, type CommandContext } from './base';
import { ProjectContextProvider } from '@providers/project-context-provider';
import { debug, info, findProjectRoot } from '@utils';
import { resolveTestTypes, getScopePatterns } from './fire/fire-command-helpers';
import { UnitTestWriter } from './fire/unit-test-writer';
import { DocumentWriter } from './fire/document-writer';
import { DocumentHandler } from './fire/document-handler';
import { FireInput, FireOutput, TestType, TestScope } from './fire/types';
import { ALL_TEST_TYPES, SUPPORTED_TEST_SCOPES } from './fire/constants';

export type { FireInput, FireOutput, TestType, TestScope };

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
  private unitTestWriter: UnitTestWriter;
  private documentWriter: DocumentWriter;
  private documentHandler: DocumentHandler;

  constructor(context: CommandContext) {
    super(context);
    this.unitTestWriter = new UnitTestWriter({
      aiClient: context.aiClient,
      config: context.config,
    });
    this.documentWriter = new DocumentWriter({
      aiClient: context.aiClient,
      config: context.config,
    });
    this.documentHandler = new DocumentHandler(context, this.documentWriter);
  }

  async execute(input: FireInput): Promise<FireOutput> {
    // Auto-enable all if scope is provided
    if (input.scope && !input.all) {
      input.all = true;
    }

    this.validate(input);
    const { testPath, all, testTypes = [], scope } = input;
    const activeTestTypes = resolveTestTypes(all, testTypes);

    // Build execution info message
    if (all) {
      const scopeMsg = scope ? ` (scope: ${scope})` : '';
      info(`Running all tests for types: ${activeTestTypes.join(', ')}${scopeMsg}`);
    } else if (testPath) {
      const isPattern = testPath.includes('*') || testPath.includes('?');
      const pathType = isPattern ? 'pattern' : 'path';
      info(`Test ${pathType} to execute: ${testPath} (types: ${activeTestTypes.join(', ')})`);
    }

    try {
      const projectRoot = await findProjectRoot();
      info(`Project root found at: ${projectRoot}`);
      const provider = new ProjectContextProvider(this.context, projectRoot);
      const projectContext = await provider.getContext();
      const { testFrameworks } = projectContext;
      debug(`Project context:`, testFrameworks);

      const results: string[] = [];

      if (results.length > 1 && activeTestTypes.includes('unit') && testFrameworks?.unit) {
        debug(`Unit test framework configured: ${testFrameworks.unit.name}`);
        if (all) {
          const scopeInfo = input.scope ? ` for ${input.scope} files` : '';
          info(`Scanning project for files to generate unit tests${scopeInfo}...`);

          const patterns = input.scope
            ? getScopePatterns(input.scope)
            : ['src/**/*.{ts,tsx,js,jsx,vue}'];

          info(`Using patterns: ${patterns.join(', ')}`);

          const { files, failures } = await this.unitTestWriter.writeTestByPattern(
            provider,
            patterns,
            testFrameworks.unit,
            input.onProgress
          );
          results.push(...files);

          if (failures.length > 0) {
            info(`\n⚠️  ${failures.length} file(s) failed to generate tests:`);
            failures.forEach((f) => info(`  - ${f.file}: ${f.error}`));
            const failureMsgs = failures.map((f) => `  - ${f.file}: ${f.error}`);
            results.push('\nFailures:', ...failureMsgs);
          }
        } else if (testPath) {
          const isPattern = testPath.includes('*') || testPath.includes('?');

          if (isPattern) {
            info(`Pattern detected: ${testPath}`);
            const { files, failures } = await this.unitTestWriter.writeTestByPattern(
              provider,
              testPath,
              testFrameworks.unit,
              input.onProgress
            );
            results.push(...files);

            if (failures.length > 0) {
              info(`\n⚠️  ${failures.length} file(s) failed to generate tests:`);
              failures.forEach((f) => info(`  - ${f.file}: ${f.error}`));
              const failureMsgs = failures.map((f) => `  - ${f.file}: ${f.error}`);
              results.push('\nFailures:', ...failureMsgs);
            }
          } else {
            await this.unitTestWriter.writeTestFile(projectContext, testPath, testFrameworks.unit);
          }
        }
      }

      if (activeTestTypes.includes('e2e')) {
        // @todo: Implement E2E test execution
        info('E2E test execution (coming soon)');
        results.push('E2E test execution (coming soon)');
      }

      if (activeTestTypes.includes('document')) {
        const docResults = await this.documentHandler.handle(
          projectRoot,
          provider,
          projectContext,
          input
        );
        results.push(...docResults);
      }

      if (activeTestTypes.includes('visual')) {
        // @todo: Implement visual regression testing
        info('Visual regression testing (coming soon)');
        results.push('Visual testing (coming soon)');
      }

      if (activeTestTypes.includes('performance')) {
        // @todo: Implement performance testing
        info('Performance testing (coming soon)');
        results.push('Performance testing (coming soon)');
      }

      return {
        success: true,
        result: `Test execution completed:\n${results.join('\n')}`,
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
    const { testPath, all, testTypes = [], scope } = input;

    // Must provide either a path, pattern, or --all flag
    if (!all && (!testPath || testPath.trim().length === 0)) {
      throw new Error('Either provide a test path/pattern or use --all flag');
    }

    // Scope can only be used with --all
    if (scope && !all) {
      throw new Error('Scope filters (component, layout, etc.) can only be used with --all flag');
    }

    for (const type of testTypes) {
      if (!ALL_TEST_TYPES.includes(type)) {
        throw new Error(
          `Invalid test type: ${type}. Valid types are: ${ALL_TEST_TYPES.join(', ')}`
        );
      }
    }

    // Validate scope if provided
    if (scope) {
      if (!SUPPORTED_TEST_SCOPES.includes(scope)) {
        throw new Error(
          `Invalid scope: ${scope}. Valid scopes are: ${SUPPORTED_TEST_SCOPES.join(', ')}`
        );
      }
    }
  }
}
