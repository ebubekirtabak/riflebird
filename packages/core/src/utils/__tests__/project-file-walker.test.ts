import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectFileWalker } from '../project-file-walker';
import fs from 'fs/promises';
import path from 'path';

vi.mock('fs/promises');

describe('ProjectFileWalker', () => {
  const mockProjectRoot = '/test/project';
  let fileWalker: ProjectFileWalker;

  beforeEach(() => {
    fileWalker = new ProjectFileWalker({ projectRoot: mockProjectRoot });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readFileFromProject', () => {
    it('should read file with correct full path', async () => {
      const mockContent = 'test file content';
      const relativePath = 'src/config.ts';

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await fileWalker.readFileFromProject(relativePath);

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, relativePath),
        'utf-8'
      );
      expect(result).toBe(mockContent);
    });

    it('should throw error when file does not exist', async () => {
      const relativePath = 'non-existent.ts';
      const error = new Error('ENOENT: no such file or directory');

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(fileWalker.readFileFromProject(relativePath)).rejects.toThrow(
        'ENOENT: no such file or directory'
      );
    });

    it('should handle nested file paths', async () => {
      const mockContent = '{ "name": "test" }';
      const relativePath = 'deep/nested/path/config.json';

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await fileWalker.readFileFromProject(relativePath);

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, relativePath),
        'utf-8'
      );
      expect(result).toBe(mockContent);
    });
  });

  describe('writeFileToProject', () => {
    it('should write file with correct full path', async () => {
      const content = 'new file content';
      const relativePath = 'output/result.txt';

      vi.mocked(fs.writeFile).mockResolvedValue();

      await fileWalker.writeFileToProject(relativePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, relativePath),
        content,
        'utf-8'
      );
    });

    it('should throw error when write fails', async () => {
      const content = 'content';
      const relativePath = 'readonly/file.txt';
      const error = new Error('EACCES: permission denied');

      vi.mocked(fs.writeFile).mockRejectedValue(error);

      await expect(
        fileWalker.writeFileToProject(relativePath, content)
      ).rejects.toThrow('EACCES: permission denied');
    });

    it('should handle empty content', async () => {
      const content = '';
      const relativePath = 'empty.txt';

      vi.mocked(fs.writeFile).mockResolvedValue();

      await fileWalker.writeFileToProject(relativePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, relativePath),
        '',
        'utf-8'
      );
    });

    it('should handle nested directory paths', async () => {
      const content = 'test content';
      const relativePath = 'deep/nested/output/file.ts';

      vi.mocked(fs.writeFile).mockResolvedValue();

      await fileWalker.writeFileToProject(relativePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, relativePath),
        content,
        'utf-8'
      );
    });
  });

  describe('constructor', () => {
    it('should initialize with project root', () => {
      const customRoot = '/custom/root';
      const walker = new ProjectFileWalker({ projectRoot: customRoot });

      expect(walker).toBeInstanceOf(ProjectFileWalker);
    });
  });
});
