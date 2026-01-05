import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { RIFLEBIRD_DIR } from '@riflebird/core';

export async function cleanCommand() {
  const cacheDir = path.join(process.cwd(), RIFLEBIRD_DIR);

  try {
    try {
      await fs.access(cacheDir);
    } catch {
      console.log(chalk.green('✓ Cache is already clean'));
      return;
    }

    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log(chalk.green('✓ Riflebird cache cleaned successfully'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow(`⚠ Failed to clean cache: ${message}`));
  }
}
