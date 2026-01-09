import { describe, expect, it } from 'vitest';
import { createTestSandbox, runRiflebirdInteractive } from '../e2e-utils';
import path from 'path';
import fs from 'fs';

describe('init command', () => {
  it('should create config file with defaults', async () => {
    // defaults: Playwright, OpenAI, (API Key), tests/e2e, Healing: Yes, Unit: No, Docs: Yes, Storybook, Visual: No
    // Inputs:
    // 1. Framework: Enter (Playwright)
    // 2. AI Provider: Enter (OpenAI)
    // 3. API Key: 'sk-test' + Enter
    // 4. Output Dir: Enter (tests/e2e)
    // 5. Healing: Enter (Yes)
    // 6. Unit Testing: Enter (No) / or 'n' + Enter? Default is false.
    // 7. Docs: Enter (Yes)
    // 8. Doc Framework: Enter (Storybook)
    // 9. Visual: Enter (No)

    const sandbox = createTestSandbox('react/simple');
    try {
      const inputs = [
        { delay: 1000 },
        { key: 'enter' }, // Framework: Playwright
        { delay: 200 },
        { key: 'enter' }, // AI Provider: OpenAI
        { delay: 200 },
        'sk-test-key', // API Key
        { key: 'enter' },
        { delay: 200 },
        { key: 'enter' }, // Output Dir: tests/e2e
        { delay: 200 },
        { key: 'enter' }, // Healing: Yes
        { delay: 200 },
        { key: 'enter' }, // Unit Testing: No (default false)
        { delay: 200 },
        { key: 'enter' }, // Docs: Yes
        { delay: 200 },
        { key: 'enter' }, // Docs Framework: Storybook
        { delay: 200 },
        { key: 'enter' }, // Visual: No
      ];

      const { stdout, exitCode } = await runRiflebirdInteractive(['init'], sandbox.cwd, inputs);

      if (exitCode !== 0) {
        console.error('Init failed:', stdout);
      }
      expect(exitCode).toBe(0);

      const configPath = path.join(sandbox.cwd, 'riflebird.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain("framework: 'playwright'");
      expect(content).toContain("provider: 'openai'");
      expect(content).toContain("outputDir: 'tests/e2e'");
    } finally {
      sandbox.cleanup();
    }
  });

  it('should create config file with custom values', async () => {
    // Custom: Cypress, Gemini CLI, (No API Key needed), custom-tests, Healing: No
    // Inputs:
    // 1. Framework: Down -> Enter (Cypress)
    // 2. AI Provider: Down -> Down -> Down -> Enter (Gemini CLI)
    // 3. Output Dir: 'custom-tests' + Enter
    // 4. Healing: 'n' + Enter
    // 5. Unit Testing: 'n' + Enter
    // 6. Docs: 'n' + Enter

    const sandbox = createTestSandbox('react/simple');
    try {
      const inputs = [
        { delay: 1000 },
        { key: 'down' },
        { key: 'enter' }, // Framework: Cypress
        { delay: 200 },
        { key: 'down' },
        { key: 'down' },
        { key: 'down' },
        { key: 'enter' }, // AI Provider: Gemini CLI
        { delay: 200 },
        // No API Key prompt for Gemini CLI
        'custom-tests',
        { key: 'enter' }, // Output Dir
        { delay: 200 },
        'n',
        { key: 'enter' }, // Healing: No
        { delay: 200 },
        'n',
        { key: 'enter' }, // Unit Testing: No
        { delay: 200 },
        'n',
        { key: 'enter' }, // Docs: No
      ];

      const { stdout, exitCode } = await runRiflebirdInteractive(['init'], sandbox.cwd, inputs);

      if (exitCode !== 0) {
        console.error('Init failed:', stdout);
      }
      expect(exitCode).toBe(0);

      const configPath = path.join(sandbox.cwd, 'riflebird.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain("framework: 'cypress'");
      expect(content).toContain("provider: 'gemini-cli'");
      expect(content).toContain("outputDir: 'custom-tests'");
      expect(content).toContain('enabled: false'); // Healing
    } finally {
      sandbox.cleanup();
    }
  });
});
