// packages/cli/src/commands/aim.ts
import { Riflebird } from '@riflebird/core';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

export async function aimCommand(description: string, options: any) {
  const spinner = ora('🎯 Targeting test flow...').start();

  try {
    // Initialize Riflebird with user config
    const riflebird = new Riflebird();
    await riflebird.init();

    // Generate test
    const testCode = await riflebird.aim(description);

    spinner.succeed('Test generated successfully!');

    // Save to file
    const outputPath = options.output || 'generated-test.spec.ts';
    const fullPath = path.join(process.cwd(), outputPath);
    
    await fs.writeFile(fullPath, testCode);

    console.log(chalk.green(`\n✓ Test saved to: ${outputPath}\n`));
    console.log(chalk.gray('Preview:\n'));
    console.log(testCode);

    console.log(chalk.cyan(`\n💡 Run with: riflebird fire ${outputPath}\n`));
  } catch (error) {
    spinner.fail('Failed to generate test');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}