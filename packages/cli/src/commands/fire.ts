import { Riflebird, type TestType } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';

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
  const spinner = ora('🔥 Executing tests...').start();

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
    await riflebird.fire({
      testPath,
      all: options?.all,
      testTypes,
      scope: options?.scope as 'component' | 'layout' | 'page' | 'service' | 'util' | 'hook' | 'store' | undefined,
    });

    spinner.succeed('Tests generated successfully!');
    console.log(chalk.green('\n✓ All tests generated!\n'));
  } catch (error) {
    spinner.fail('Failed to generate test');
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
