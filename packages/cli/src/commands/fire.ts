import { Riflebird, type TestType } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';
import { createProgressHandler, ProgressState } from './handlers';

export type FireOptions = {
  headless?: boolean;
  browser?: string;
  all?: boolean;
  e2e?: boolean;
  unit?: boolean;
  visual?: boolean;
  performance?: boolean;
  scope?: string;
};

export async function fireCommand(testPath?: string, options?: FireOptions) {
  const spinner = ora('🔥 Generating tests...').start();
  const progressState: ProgressState = { current: 0, total: 0, file: '', startTime: Date.now() };
  const timerRef = { current: undefined as NodeJS.Timeout | undefined };

  try {
    const riflebird = new Riflebird();
    await riflebird.init();

    // Build test types array from flags
    const testTypes: TestType[] = [];
    if (options?.e2e) testTypes.push('e2e');
    if (options?.unit) testTypes.push('unit');
    if (options?.visual) testTypes.push('visual');
    if (options?.performance) testTypes.push('performance');

    // Execute test(s)
    const result = await riflebird.fire({
      testPath,
      all: options?.all,
      testTypes,
      scope: options?.scope as 'component' | 'layout' | 'page' | 'service' | 'util' | 'hook' | 'store' | undefined,
      onProgress: createProgressHandler(spinner, progressState, timerRef),
    });

    // Stop the live timer
    clearInterval(timerRef.current);

    spinner.succeed('Tests generated successfully!');

    if (result) {
      console.log(chalk.cyan('\n' + result + '\n'));
    }
  } catch (error) {
    // Stop the live timer on error
    clearInterval(timerRef.current);

    spinner.fail('Failed to generate test');
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
