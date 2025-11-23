import { Riflebird } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';

export type FireOptions = {
  headless?: boolean;
  browser?: string;
};

export async function fireCommand(testPath?: string, _options?: FireOptions) {
  const spinner = ora('🔥 Executing tests...').start();

  try {
    const riflebird = new Riflebird();
    await riflebird.init();

    // Execute test(s)
    await riflebird.fire(testPath || 'tests/e2e');

    spinner.succeed('Tests executed successfully!');
    console.log(chalk.green('\n✓ All tests passed!\n'));
  } catch (error) {
    spinner.fail('Test execution failed');
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
