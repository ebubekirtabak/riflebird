import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  findProjectRoot,
  getProjectPaths,
  ensureRiflebirdDirs,
  riflebirdDirExists,
  listCustomPrompts,
  readCustomPrompt,
  writeCustomPrompt,
} from '../project-paths';
import { RIFLEBIRD_DIR } from '@commons';

describe('project-paths utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'riflebird-project-'));

    // Create a mock project structure
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    await fs.mkdir(path.join(tempDir, 'src'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('findProjectRoot', () => {
    it('should find project root from current directory', async () => {
      const root = await findProjectRoot(tempDir);
      expect(root).toBe(tempDir);
    });

    it('should find project root from nested directory', async () => {
      const nestedDir = path.join(tempDir, 'src', 'components');
      await fs.mkdir(nestedDir, { recursive: true });

      const root = await findProjectRoot(nestedDir);
      expect(root).toBe(tempDir);
    });

    it('should use process.cwd() when no startPath provided', async () => {
      // This test verifies the function works without explicit path
      const root = await findProjectRoot();
      expect(root).toBeDefined();
      expect(typeof root).toBe('string');
      expect(path.isAbsolute(root)).toBe(true);
    });

    it('should return start path when no package.json found', async () => {
      const noPackageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-package-'));

      try {
        const root = await findProjectRoot(noPackageDir);
        // When no package.json found, returns the start path
        expect(root).toBe(noPackageDir);
      } finally {
        await fs.rm(noPackageDir, { recursive: true, force: true });
      }
    });
  });

  describe('getProjectPaths', () => {
    it('should return all Riflebird paths', async () => {
      const paths = await getProjectPaths(tempDir);

      expect(paths.root).toBe(tempDir);
      expect(paths.riflebirdDir).toBe(path.join(tempDir, RIFLEBIRD_DIR));
      expect(paths.promptsDir).toBe(path.join(tempDir, RIFLEBIRD_DIR, 'prompts'));
      expect(paths.templatesDir).toBe(path.join(tempDir, RIFLEBIRD_DIR, 'templates'));
      expect(paths.configDir).toBe(path.join(tempDir, RIFLEBIRD_DIR, 'config'));
    });

    it('should work from nested directory', async () => {
      const nestedDir = path.join(tempDir, 'src', 'components');
      await fs.mkdir(nestedDir, { recursive: true });

      const paths = await getProjectPaths(nestedDir);

      expect(paths.root).toBe(tempDir);
      expect(paths.riflebirdDir).toBe(path.join(tempDir, RIFLEBIRD_DIR));
    });
  });

  describe('ensureRiflebirdDirs', () => {
    it('should create all Riflebird directories', async () => {
      const paths = await ensureRiflebirdDirs(tempDir);

      const riflebirdExists = await fs
        .access(paths.riflebirdDir)
        .then(() => true)
        .catch(() => false);
      const promptsExists = await fs
        .access(paths.promptsDir)
        .then(() => true)
        .catch(() => false);
      const templatesExists = await fs
        .access(paths.templatesDir)
        .then(() => true)
        .catch(() => false);
      const configExists = await fs
        .access(paths.configDir)
        .then(() => true)
        .catch(() => false);

      expect(riflebirdExists).toBe(true);
      expect(promptsExists).toBe(true);
      expect(templatesExists).toBe(true);
      expect(configExists).toBe(true);
    });

    it('should not throw if directories already exist', async () => {
      await ensureRiflebirdDirs(tempDir);
      await expect(ensureRiflebirdDirs(tempDir)).resolves.toBeDefined();
    });
  });

  describe('riflebirdDirExists', () => {
    it('should return false when .riflebird does not exist', async () => {
      const exists = await riflebirdDirExists(tempDir);
      expect(exists).toBe(false);
    });

    it('should return true when .riflebird exists', async () => {
      await ensureRiflebirdDirs(tempDir);
      const exists = await riflebirdDirExists(tempDir);
      expect(exists).toBe(true);
    });
  });

  describe('listCustomPrompts', () => {
    it('should return empty array when no prompts exist', async () => {
      const prompts = await listCustomPrompts(tempDir);
      expect(prompts).toEqual([]);
    });

    it('should list all .md and .txt files', async () => {
      await ensureRiflebirdDirs(tempDir);
      const paths = await getProjectPaths(tempDir);

      await fs.writeFile(path.join(paths.promptsDir, 'custom1.md'), '');
      await fs.writeFile(path.join(paths.promptsDir, 'custom2.txt'), '');
      await fs.writeFile(path.join(paths.promptsDir, 'ignore.json'), '');

      const prompts = await listCustomPrompts(tempDir);

      expect(prompts).toHaveLength(2);
      expect(prompts).toContain('custom1.md');
      expect(prompts).toContain('custom2.txt');
      expect(prompts).not.toContain('ignore.json');
    });
  });

  describe('readCustomPrompt', () => {
    it('should read prompt file content', async () => {
      await ensureRiflebirdDirs(tempDir);
      const paths = await getProjectPaths(tempDir);

      const content = '# Custom Prompt\n\nThis is a test prompt.';
      await fs.writeFile(path.join(paths.promptsDir, 'test.md'), content);

      const result = await readCustomPrompt('test.md', tempDir);
      expect(result).toBe(content);
    });

    it('should throw error when prompt file does not exist', async () => {
      await expect(readCustomPrompt('nonexistent.md', tempDir)).rejects.toThrow(
        'Failed to read custom prompt'
      );
    });
  });

  describe('writeCustomPrompt', () => {
    it('should write prompt file', async () => {
      const content = '# New Prompt\n\nContent here.';
      await writeCustomPrompt('new-prompt.md', content, tempDir);

      const paths = await getProjectPaths(tempDir);
      const saved = await fs.readFile(path.join(paths.promptsDir, 'new-prompt.md'), 'utf-8');

      expect(saved).toBe(content);
    });

    it('should create directories if they do not exist', async () => {
      const content = 'Test content';
      await writeCustomPrompt('auto-create.md', content, tempDir);

      const paths = await getProjectPaths(tempDir);
      const exists = await fs
        .access(paths.promptsDir)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it('should overwrite existing prompt', async () => {
      await writeCustomPrompt('overwrite.md', 'Original', tempDir);
      await writeCustomPrompt('overwrite.md', 'Updated', tempDir);

      const result = await readCustomPrompt('overwrite.md', tempDir);
      expect(result).toBe('Updated');
    });
  });
});
