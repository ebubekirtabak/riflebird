import { Riflebird } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';

export async function fireCommand(testPath?: string, _options?: any) {
  const spinner = ora('🔥 Executing tests...').start();

  try {
    const riflebird = new Riflebird();
    await riflebird.init();

    // Execute test(s)
    await riflebird.fire(testPath || 'tests/e2e');

    spinner.succeed('Tests executed successfully!');
    console.log(chalk.green('\n✓ All tests passed!\n'));
  } catch (error: any) {
    spinner.fail('Test execution failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
