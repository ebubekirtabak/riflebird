import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectFileWalker } from '../project-file-walker';
import path from 'path';
import fs from 'fs/promises';
import { sanitizationLogger } from '@security';

// Mock fs
vi.mock('fs/promises');

// Spy on logger
vi.spyOn(sanitizationLogger, 'logSanitization').mockImplementation(() => { });

describe('ProjectFileWalker', () => {
  const mockProjectRoot = '/tmp/mock-project';
  let walker: ProjectFileWalker;

  beforeEach(() => {
    walker = new ProjectFileWalker({ projectRoot: mockProjectRoot });
    vi.clearAllMocks();
  });

  describe('resolveAndValidatePath', () => {
    it('should resolve valid paths within project root', async () => {
      const filePath = 'src/index.ts';
      const result = await walker.resolveAndValidatePath(filePath);
      expect(result).toBe(path.resolve(mockProjectRoot, filePath));
    });

    it('should throw error for path traversal attempt', async () => {
      const filePath = '../outside.secret';
      await expect(walker.resolveAndValidatePath(filePath))
        .rejects.toThrow('Security Error: Access denied');
    });

    it('should resolve paths that traverse out and back in', async () => {
      const filePath = 'src/../index.ts';
      const result = await walker.resolveAndValidatePath(filePath);
      expect(result).toBe(path.resolve(mockProjectRoot, 'index.ts'));
    });
  });

  describe('writeFileToProject', () => {
    it('should ensure directory exists before writing', async () => {
      const filePath = 'deep/nested/file.txt';
      const content = 'hello';

      await walker.writeFileToProject(filePath, content);

      const expectedFullPath = path.resolve(mockProjectRoot, filePath);
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(expectedFullPath), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(expectedFullPath, content, 'utf-8');
    });

    it('should fail if path is unsafe', async () => {
      const filePath = '../bad.txt';
      await expect(walker.writeFileToProject(filePath, 'content'))
        .rejects.toThrow('Security Error');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('readFileFromProject', () => {
    it('should read valid file', async () => {
      const filePath = 'test.ts';
      const fullPath = path.resolve(mockProjectRoot, filePath);
      vi.mocked(fs.readFile).mockResolvedValue('content');

      const result = await walker.readFileFromProject(filePath);

      expect(fs.readFile).toHaveBeenCalledWith(fullPath, 'utf-8');
      expect(result).toBe('content');
    });

    it('should fail if path is unsafe', async () => {
      const filePath = '../config.json';
      await expect(walker.readFileFromProject(filePath))
        .rejects.toThrow('Security Error');
    });
  });
});
