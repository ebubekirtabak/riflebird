import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

export async function cleanCommand() {
  const cacheDir = path.join(process.cwd(), '.riflebird');

  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log(chalk.green('✓ Riflebird cache cleaned successfully'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow(`⚠ Failed to clean cache: ${message}`));
  }
}
