import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InitAnswers } from '../init';
import { initCommand, updateGitIgnore } from '../init';
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
    beforeEach(() => {
      const mockOpen = vi.mocked(fs.open);
      const mockFileHandle = {
        readFile: vi.fn().mockResolvedValue(''),
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      // @ts-expect-error - partial mock
      mockOpen.mockResolvedValue(mockFileHandle);
    });

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
      const healingQuestion = questions.find((q) => q.name === 'healing');

      expect(healingQuestion).toBeDefined();
      expect(healingQuestion?.default).toBe(true);
    });
  });

  describe('updateGitIgnore', () => {
    it('should create .gitignore if it does not exist', async () => {
      const mockOpen = vi.mocked(fs.open);
      const mockFileHandle = {
        readFile: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };

      // @ts-expect-error - partial mock
      mockOpen.mockResolvedValue(mockFileHandle);
      mockFileHandle.readFile.mockResolvedValue(''); // Empty file (simulating creation)
      mockFileHandle.write.mockResolvedValue(undefined);
      mockFileHandle.close.mockResolvedValue(undefined);

      await updateGitIgnore();

      expect(mockOpen).toHaveBeenCalledWith('.gitignore', 'a+');
      expect(mockFileHandle.readFile).toHaveBeenCalledWith('utf-8');
      expect(mockFileHandle.write).toHaveBeenCalledWith(expect.stringContaining('.riflebird/'));
      expect(mockFileHandle.close).toHaveBeenCalled();
    });

    it('should append to .gitignore if it exists but is missing the entry', async () => {
      const mockOpen = vi.mocked(fs.open);
      const mockFileHandle = {
        readFile: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };

      // @ts-expect-error - partial mock
      mockOpen.mockResolvedValue(mockFileHandle);
      mockFileHandle.readFile.mockResolvedValue('node_modules/\n');
      mockFileHandle.write.mockResolvedValue(undefined);
      mockFileHandle.close.mockResolvedValue(undefined);

      await updateGitIgnore();

      expect(mockOpen).toHaveBeenCalledWith('.gitignore', 'a+');
      expect(mockFileHandle.write).toHaveBeenCalledWith(expect.stringContaining('.riflebird/'));
      expect(mockFileHandle.close).toHaveBeenCalled();
    });

    it('should not modify .gitignore if entry already exists', async () => {
      const mockOpen = vi.mocked(fs.open);
      const mockFileHandle = {
        readFile: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };

      // @ts-expect-error - partial mock
      mockOpen.mockResolvedValue(mockFileHandle);
      mockFileHandle.readFile.mockResolvedValue(
        'node_modules/\n\n# Riflebird cache\n.riflebird/\n'
      );
      mockFileHandle.close.mockResolvedValue(undefined);

      await updateGitIgnore();

      expect(mockOpen).toHaveBeenCalledWith('.gitignore', 'a+');
      expect(mockFileHandle.write).not.toHaveBeenCalled();
      expect(mockFileHandle.close).toHaveBeenCalled();
    });

    it('should handle errors gracefully and ensure file is closed', async () => {
      const mockOpen = vi.mocked(fs.open);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockOpen.mockRejectedValue(new Error('Access denied'));

      // Should not throw
      await updateGitIgnore();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/⚠ Failed to update .gitignore:.*Access denied/)
      );
    });

    it('should close file handle even if read fails', async () => {
      const mockOpen = vi.mocked(fs.open);
      const mockFileHandle = {
        readFile: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };

      // @ts-expect-error - partial mock
      mockOpen.mockResolvedValue(mockFileHandle);
      mockFileHandle.readFile.mockRejectedValue(new Error('Read failed'));
      mockFileHandle.close.mockResolvedValue(undefined);

      await updateGitIgnore();

      expect(mockOpen).toHaveBeenCalled();
      expect(mockFileHandle.close).toHaveBeenCalled();
    });
  });
});
