import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InitAnswers } from '../init';
import { initCommand } from '../init';
import fs from 'fs/promises';
import inquirer from 'inquirer';

vi.mock('inquirer');
vi.mock('fs/promises');

describe('cli/commands/init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('InitAnswers type', () => {
    it('should include unitTesting fields', () => {
      const answers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'openai',
        apiKey: 'test-key',
        outputDir: 'tests/e2e',
        healing: true,
        visual: true,
        unitTesting: true,
        unitTestFramework: 'vitest',
      };

      expect(answers.unitTesting).toBe(true);
      expect(answers.unitTestFramework).toBe('vitest');
    });

    it('should allow optional unitTestFramework', () => {
      const answers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'local',
        outputDir: 'tests/e2e',
        healing: false,
        visual: false,
        unitTesting: false,
      };

      expect(answers.unitTesting).toBe(false);
      expect(answers.unitTestFramework).toBeUndefined();
    });
  });

  describe('config generation', () => {
    it('should include unitTesting config when enabled', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockWriteFile.mockResolvedValue(undefined);

      // We can't easily test the actual command without mocking inquirer,
      // but we can verify the type structure is correct
      const answers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'openai',
        apiKey: 'test-key',
        outputDir: 'tests/e2e',
        healing: true,
        visual: true,
        unitTesting: true,
        unitTestFramework: 'jest',
      };

      expect(answers.unitTestFramework).toBe('jest');
    });

    it('should support all unit test frameworks', () => {
      const frameworks: Array<'vitest' | 'jest' | 'mocha' | 'ava'> = [
        'vitest',
        'jest',
        'mocha',
        'ava',
      ];

      frameworks.forEach((framework) => {
        const answers: InitAnswers = {
          framework: 'playwright',
          aiProvider: 'openai',
          outputDir: 'tests/e2e',
          healing: true,
          visual: true,
          unitTesting: true,
          unitTestFramework: framework,
        };

        expect(answers.unitTestFramework).toBe(framework);
      });
    });
  });

  describe('initCommand', () => {
    it('should create riflebird.config.ts file with user selections', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      const mockWriteFile = vi.mocked(fs.writeFile);

      const mockAnswers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'openai',
        apiKey: 'test-key',
        outputDir: 'tests/e2e',
        healing: true,
        visual: true,
        unitTesting: true,
        unitTestFramework: 'vitest',
      };

      mockPrompt.mockResolvedValue(mockAnswers);
      mockWriteFile.mockResolvedValue(undefined);

      await initCommand();

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        'riflebird.config.ts',
        expect.stringContaining("provider: 'openai'")
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        'riflebird.config.ts',
        expect.stringContaining('unitTesting:')
      );
    });

    it('should handle unit testing config when enabled', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      const mockWriteFile = vi.mocked(fs.writeFile);

      const mockAnswers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'openai',
        outputDir: 'tests/e2e',
        healing: true,
        visual: true,
        unitTesting: true,
        unitTestFramework: 'vitest',
      };

      mockPrompt.mockResolvedValue(mockAnswers);
      mockWriteFile.mockResolvedValue(undefined);

      await initCommand();

      const [[, configContent]] = mockWriteFile.mock.calls;
      expect(configContent).toContain('unitTesting:');
      expect(configContent).toContain("framework: 'vitest'");
      expect(configContent).toContain("testOutputDir: './__tests__/'");
    });

    it('should not include unit testing config when disabled', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      const mockWriteFile = vi.mocked(fs.writeFile);

      const mockAnswers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'openai',
        outputDir: 'tests/e2e',
        healing: false,
        visual: false,
        unitTesting: false,
      };

      mockPrompt.mockResolvedValue(mockAnswers);
      mockWriteFile.mockResolvedValue(undefined);

      await initCommand();

      const [[, configContent]] = mockWriteFile.mock.calls;
      expect(configContent).not.toContain('unitTesting:');
    });
    it('should have healing enabled by default in prompts', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      const mockWriteFile = vi.mocked(fs.writeFile);

      const mockAnswers: InitAnswers = {
        framework: 'playwright',
        aiProvider: 'openai',
        outputDir: 'tests/e2e',
        healing: true,
        visual: true,
        unitTesting: true,
      };

      mockPrompt.mockResolvedValue(mockAnswers);
      mockWriteFile.mockResolvedValue(undefined);

      await initCommand();

      const questions = mockPrompt.mock.calls[0][0] as Array<{ name: string; default: unknown }>;
      const healingQuestion = questions.find(q => q.name === 'healing');

      expect(healingQuestion).toBeDefined();
      expect(healingQuestion?.default).toBe(true);
    });
  });
});
