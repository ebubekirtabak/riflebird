import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import type { z } from 'zod';
import {
  AIProviderSchema,
  FrameworkSchema,
  UnitTestFrameworkSchema,
  DEFAULT_UNIT_TEST_PATTERNS,
  DEFAULT_COVERAGE_INCLUDE,
  DEFAULT_COVERAGE_EXCLUDE,
} from '@riflebird/core';

export type InitAnswers = {
  framework: z.infer<typeof FrameworkSchema>;
  aiProvider: z.infer<typeof AIProviderSchema>;
  apiKey?: string;
  outputDir: string;
  healing: boolean;
  visual: boolean;
  unitTesting: boolean;
  unitTestFramework?: z.infer<typeof UnitTestFrameworkSchema>;
};

export async function initCommand() {
  console.log(chalk.blue.bold('\n🎯 Riflebird Configuration Setup\n'));

  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'list',
      name: 'framework',
      message: 'Select your E2E testing framework:',
      choices: [
        { name: 'Playwright', value: 'playwright' },
        { name: 'Cypress', value: 'cypress' },
        { name: 'Puppeteer', value: 'puppeteer' },
        { name: 'WebdriverIO', value: 'webdriverio' },
      ],
    },
    {
      type: 'list',
      name: 'aiProvider',
      message: 'Select AI provider:',
      choices: [
        { name: 'OpenAI (GPT-4)', value: 'openai' },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'Local (Ollama)', value: 'local' },
      ],
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your AI API key (or set as environment variable):',
      when: (answers: InitAnswers) => answers.aiProvider !== 'local',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Tests output directory:',
      default: 'tests/e2e',
    },
    {
      type: 'confirm',
      name: 'healing',
      message: 'Enable auto-healing for broken tests?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'visual',
      message: 'Enable visual testing with AI?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'unitTesting',
      message: 'Enable unit testing configuration?',
      default: false,
    },
    {
      type: 'list',
      name: 'unitTestFramework',
      message: 'Select unit testing framework:',
      choices: [
        { name: 'Vitest', value: 'vitest' },
        { name: 'Jest', value: 'jest' },
        { name: 'Mocha', value: 'mocha' },
        { name: 'AVA', value: 'ava' },
      ],
      when: (answers: InitAnswers) => answers.unitTesting,
    },
  ]);

  // Generate config file
  const config = generateConfigFile(answers);

  // Write to file
  await fs.writeFile('riflebird.config.ts', config);

  // Update .gitignore
  await updateGitIgnore();

  console.log(chalk.green('\n✓ riflebird.config.ts created!\n'));
  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.white('  1. Set API key: export OPENAI_API_KEY=your_key_here'));
  console.log(chalk.white('  2. Generate test: riflebird aim "your test description"'));
  console.log(chalk.white('  3. Run test: riflebird fire\n'));
}

function generateConfigFile(answers: InitAnswers): string {
  const envVar = `${answers.aiProvider.toUpperCase()}_API_KEY`;

  return `import { defineConfig } from '@riflebird/core';

export default defineConfig({
  ai: {
    provider: '${answers.aiProvider}',
    apiKey: process.env.${envVar},
    model: '${answers.aiProvider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022'}',
    temperature: 0.2,
  },

  e2e: {
    framework: '${answers.framework}',

    ${answers.framework}: {
    ${
      answers.framework === 'playwright'
        ? `browser: 'chromium',
    headless: false,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:3000',
    timeout: 30000,`
        : answers.framework === 'cypress'
          ? `baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,`
          : `headless: false,
    baseUrl: 'http://localhost:3000',`
    }
    },
  },

  generation: {
    outputDir: '${answers.outputDir}',
    naming: 'kebab-case',
    language: 'typescript',
    includeComments: true,
    includeAssertions: true,
  },

  healing: {
    enabled: ${answers.healing},
    mode: 'auto',
    maxRetries: 3,
    strategy: 'smart',
  },

  visual: {
    enabled: ${answers.visual},
    threshold: 0.1,
    ignoreRegions: [],
    updateBaselines: false,
  },

  reporting: {
    format: ['html', 'json'],
    outputDir: 'test-results',
    screenshots: 'on-failure',
    video: 'on-failure',
    aiSummary: true,
  },
${
  answers.unitTesting
    ? `
  unitTesting: {
    enabled: true,
    framework: '${answers.unitTestFramework || 'vitest'}',
    testOutputDir: './__tests__/',
    testMatch: ${JSON.stringify([...DEFAULT_UNIT_TEST_PATTERNS])},
    coverage: {
      enabled: true,
      provider: 'v8',
      threshold: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ${JSON.stringify([...DEFAULT_COVERAGE_INCLUDE])},
      exclude: ${JSON.stringify([...DEFAULT_COVERAGE_EXCLUDE])},
      reporter: ['text', 'html'],
    },
    watch: false,
    globals: true,
    environment: 'node',
    setupFiles: [],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    timeout: 5000,
  },`
    : ''
}
});
`;
}

export async function updateGitIgnore(): Promise<void> {
  const gitignorePath = '.gitignore';
  const ignoreEntry = '\n# Riflebird cache\n.riflebird/\n';
  let fileHandle;

  try {
    // Open file for reading and appending. 'a+' creates the file if it doesn't exist.
    fileHandle = await fs.open(gitignorePath, 'a+');

    const content = await fileHandle.readFile('utf-8');
    if (!content.includes('.riflebird/')) {
      await fileHandle.write(ignoreEntry);
      console.log(chalk.green('✓ Added .riflebird/ to .gitignore'));
    } else {
      console.log(chalk.green('✓ .riflebird/ already in .gitignore'));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow(`⚠ Failed to update .gitignore: ${message}`));
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}
