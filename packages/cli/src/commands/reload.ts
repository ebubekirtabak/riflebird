import { Riflebird } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';

export type ReloadOptions = {
  dryRun?: boolean;
};

export async function reloadCommand(testPath: string, options: ReloadOptions) {
  const spinner = ora('🔄 Healing broken test...').start();

  try {
    const riflebird = new Riflebird();
    await riflebird.init();

    const healedCode = await riflebird.reload(testPath);

    spinner.succeed('Test healed successfully!');

    if (options.dryRun) {
      console.log(chalk.yellow('\n📋 Dry run - showing fixes without applying:\n'));
      console.log(healedCode);
    } else {
      await fs.writeFile(testPath, healedCode);
      console.log(chalk.green(`\n✓ Test updated: ${testPath}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to heal test');
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
