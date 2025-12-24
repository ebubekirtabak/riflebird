#!/usr/bin/env node

import { Command } from 'commander';
import { aimCommand } from './commands/aim.js';
import { fireCommand } from './commands/fire.js';
import { initCommand } from './commands/init.js';
import { targetCommand } from './commands/target.js';
import { reloadCommand } from './commands/reload.js';
import { cleanCommand } from './commands/clean.js';
import { interactiveMode } from './interactivite.js';

const program = new Command();

program
  .name('riflebird')
  .description('🎯 AI-powered E2E testing framework with precision and self-healing')
  .version('1.0.0');

// Initialize config
program.command('init').description('Initialize Riflebird configuration').action(initCommand);

// Generate test from description
program
  .command('aim <description>')
  .description('Generate E2E test from natural language description')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --framework <framework>', 'Override framework (playwright, cypress, puppeteer)')
  .action(aimCommand);

// Execute test
program
  .command('fire [testPath]')
  .description('Generate test cases and analyze project structure')
  .option('-h, --headless', 'Run in headless mode')
  .option('-b, --browser <browser>', 'Browser to use (chromium, firefox, webkit)')
  .option('-a, --all', 'Run all test types for all files')
  .option('--e2e', 'Include E2E tests')
  .option('--unit', 'Include unit tests')
  .option('--visual', 'Include visual regression tests')
  .option('--performance', 'Include performance tests')
  .option(
    '-s, --scope <scope>',
    'Filter by scope: component, layout, page, service, util, hook, store'
  )
  .action(fireCommand);

// Find element selector
program
  .command('target <description>')
  .description('AI-powered element selector finder')
  .option('-u, --url <url>', 'Page URL to analyze')
  .action(targetCommand);

// Self-healing for broken tests
program
  .command('reload <testPath>')
  .description('Auto-heal broken test with AI')
  .option('--dry-run', 'Show fixes without applying')
  .action(reloadCommand);

// Clean cache
program.command('clean').description('Clean Riflebird cache').action(cleanCommand);

// expose interactive mode as a top-level command
program.command('interactive').description('Run interactive CLI').action(interactiveMode);

program.parse();
