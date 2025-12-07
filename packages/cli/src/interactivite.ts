import inquirer from 'inquirer';
import chalk from 'chalk';
import { fireCommand } from './commands/fire.js';
import { initCommand } from './commands/init.js';
import { targetCommand } from './commands/target.js';
import { reloadCommand } from './commands/reload.js';
import { ASCII_LOGO } from './logo.js';

export async function interactiveMode() {
  console.clear();

  console.log(chalk.blue(ASCII_LOGO));
  console.log(chalk.gray('🎯 Precision Testing with AI\n'));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select your target:',
      choices: [
        { name: '🔥 Fire - Generate new test', value: 'fire' },
        { name: '🔄 Reload - Heal broken tests', value: 'reload' },
        { name: '🔍 Scope - Analyze application', value: 'scope' },
        { name: '🎖️ Calibrate - Configure settings', value: 'calibrate' },
        { name: '❌ Exit', value: 'exit' },
      ],
    },
  ]);

  if (action === 'exit') {
    console.log(chalk.green('\n✓ Mission complete!\n'));
    process.exit(0);
  }

  // Handle action...
  await handleAction(action);
}

async function handleAction(action: string) {
  switch (action) {
    case 'fire': {
      const { testPath, headless, browser } = await inquirer.prompt([
        { type: 'input', name: 'testPath', message: 'input file (enter for default):', default: '--all' },
        { type: 'input', name: 'output', message: 'Output file (enter for default):', default: '' },
        {
          type: 'list',
          name: 'framework',
          message: 'Target framework (optional):',
          choices: [ { name: 'Auto-detect', value: '' }, { name: 'Playwright', value: 'playwright' }, { name: 'Cypress', value: 'cypress' }, { name: 'Puppeteer', value: 'puppeteer' } ],
        },
      ]);

      await fireCommand(testPath || undefined, { headless, browser });
      break;
    }

    case 'reload': {
      const { testPath, dryRun } = await inquirer.prompt([
        { type: 'input', name: 'testPath', message: 'Path to test file to heal:' },
        { type: 'confirm', name: 'dryRun', message: 'Dry run (show fixes only)?', default: true },
      ]);

      await reloadCommand(testPath, { dryRun });
      break;
    }

    case 'scope': {
      const { description } = await inquirer.prompt([
        { type: 'input', name: 'description', message: 'Describe the element or page to analyze:' },
      ]);

      await targetCommand(description, {});
      break;
    }

    case 'calibrate': {
      await initCommand();
      break;
    }

    default:
      console.log(chalk.yellow('Unknown action'));
  }

  // After action completes, return to interactive menu
  await interactiveMode();
}
