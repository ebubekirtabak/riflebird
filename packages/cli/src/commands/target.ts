import { Riflebird } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';

export type TargetOptions = {
  url?: string;
};

export async function targetCommand(description: string, _options: TargetOptions) {
  const spinner = ora('🎯 Finding element selector...').start();

  try {
    const riflebird = new Riflebird();
    await riflebird.init();

    const selector = await riflebird.target(description);

    spinner.succeed('Selector found!');
    console.log(chalk.green(`\n✓ Best selector: ${chalk.cyan(selector)}\n`));
  } catch (error) {
    spinner.fail('Failed to find selector');
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
