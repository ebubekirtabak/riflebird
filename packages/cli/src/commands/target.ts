import { Riflebird } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';

export async function targetCommand(description: string, _options: any) {
  const spinner = ora('🎯 Finding element selector...').start();

  try {
    const riflebird = new Riflebird();
    await riflebird.init();

    const selector = await riflebird.target(description);

    spinner.succeed('Selector found!');
    console.log(chalk.green(`\n✓ Best selector: ${chalk.cyan(selector)}\n`));
  } catch (error: any) {
    spinner.fail('Failed to find selector');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
