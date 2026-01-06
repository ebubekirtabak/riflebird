import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectFileWalker, FileContentWithStats } from '../project-file-walker';
import path from 'path';
import fs, { FileHandle } from 'fs/promises';
import { sanitizationLogger, SecretScanner, type SanitizationResult } from '@security';
import { Stats } from 'node:fs';

// Mock fs
vi.mock('fs/promises');

// Mock security module
vi.mock('@security', () => ({
  SecretScanner: {
    sanitize: vi.fn(),
  },
  sanitizationLogger: {
    logSanitization: vi.fn(),
  },
}));

describe('ProjectFileWalker', () => {
  const mockProjectRoot = '/tmp/mock-project';
  let walker: ProjectFileWalker;

  beforeEach(() => {
    walker = new ProjectFileWalker({ projectRoot: mockProjectRoot });
    vi.clearAllMocks();

    // Default mock implementation for SecretScanner
    vi.mocked(SecretScanner.sanitize).mockImplementation(
      (code) =>
        ({
          sanitizedCode: code,
          secretsDetected: 0,
          results: [],
          secrets: [],
          originalLength: 0,
          sanitizedLength: 0,
        }) as SanitizationResult
    );
  });

  describe('resolveAndValidatePath', () => {
    it('should resolve valid paths within project root', async () => {
      const filePath = 'src/index.ts';
      const result = await walker.resolveAndValidatePath(filePath);
      expect(result).toBe(path.resolve(mockProjectRoot, filePath));
    });

    it('should throw error for path traversal attempt', async () => {
      const filePath = '../outside.secret';
      await expect(walker.resolveAndValidatePath(filePath)).rejects.toThrow(
        'Security Error: Access denied'
      );
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
      await expect(walker.writeFileToProject(filePath, 'content')).rejects.toThrow(
        'Security Error'
      );
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
      await expect(walker.readFileFromProject(filePath)).rejects.toThrow('Security Error');
    });
  });

  describe('getFileLastModified', () => {
    it('should return last modified time for valid file', async () => {
      const filePath = 'package.json';
      const fullPath = path.resolve(mockProjectRoot, filePath);
      const mockStats = { mtimeMs: 123456789 } as unknown as Stats;

      vi.mocked(fs.stat).mockResolvedValue(mockStats);

      const result = await walker.getFileLastModified(filePath);

      expect(fs.stat).toHaveBeenCalledWith(fullPath);
      expect(result).toBe(123456789);
    });

    it('should fail if path is unsafe', async () => {
      const filePath = '../outside.txt';
      await expect(walker.getFileLastModified(filePath)).rejects.toThrow('Security Error');
    });

    it('should propagate fs errors', async () => {
      const filePath = 'missing.txt';
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      await expect(walker.getFileLastModified(filePath)).rejects.toThrow(
        'Failed to get last modified time'
      );
    });
  });

  describe('readWithStats', () => {
    it('should read file content and stats successfully', async () => {
      const filePath = 'test.ts';
      const fullPath = path.resolve(mockProjectRoot, filePath);
      const mockContent = 'file content';
      const mockStats = { size: 100 } as Stats;

      const mockFileHandle = {
        stat: vi.fn().mockResolvedValue(mockStats),
        readFile: vi.fn().mockResolvedValue(mockContent),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;

      vi.mocked(fs.open).mockResolvedValue(mockFileHandle);
      vi.mocked(SecretScanner.sanitize).mockReturnValue({
        sanitizedCode: mockContent,
        secretsDetected: 0,
        results: [],
        secrets: [],
        originalLength: 0,
        sanitizedLength: 0,
      } as SanitizationResult);

      const result: FileContentWithStats = await walker.readWithStats(filePath);

      expect(fs.open).toHaveBeenCalledWith(fullPath, 'r');
      expect(mockFileHandle.stat).toHaveBeenCalled();
      expect(mockFileHandle.readFile).toHaveBeenCalledWith({ encoding: 'utf-8' });
      expect(mockFileHandle.close).toHaveBeenCalled();
      expect(result).toEqual({ content: mockContent, stats: mockStats });
    });

    it('should fail if path is unsafe', async () => {
      const filePath = '../secret.key';
      await expect(walker.readWithStats(filePath)).rejects.toThrow('Security Error');
      expect(fs.open).not.toHaveBeenCalled();
    });

    it('should sanitize content and log secrets if detected', async () => {
      const filePath = 'config.ts';
      const secretContent = 'apiKey = "12345";';
      const sanitizedContent = 'apiKey = "[REDACTED]";';
      const mockStats = { size: 100 } as Stats;

      const mockFileHandle = {
        stat: vi.fn().mockResolvedValue(mockStats),
        readFile: vi.fn().mockResolvedValue(secretContent),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;

      vi.mocked(fs.open).mockResolvedValue(mockFileHandle);
      vi.mocked(SecretScanner.sanitize).mockReturnValue({
        sanitizedCode: sanitizedContent,
        secretsDetected: 1,
        results: [],
        secrets: [],
        originalLength: 0,
        sanitizedLength: 0,
      } as SanitizationResult);

      await walker.readWithStats(filePath);

      expect(sanitizationLogger.logSanitization).toHaveBeenCalledWith(
        expect.objectContaining({
          secretsDetected: 1,
          sanitizedCode: sanitizedContent,
        }),
        filePath
      );
    });

    it('should throw error if fs.open fails', async () => {
      const filePath = 'missing.ts';
      vi.mocked(fs.open).mockRejectedValue(new Error('ENOENT'));

      await expect(walker.readWithStats(filePath)).rejects.toThrow(
        'Failed to read file with stats'
      );
    });

    it('should close file handle even if reading fails', async () => {
      const filePath = 'broken.ts';
      const mockFileHandle = {
        stat: vi.fn().mockRejectedValue(new Error('Read error')),
        readFile: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;

      vi.mocked(fs.open).mockResolvedValue(mockFileHandle);

      await expect(walker.readWithStats(filePath)).rejects.toThrow(
        'Failed to read file with stats'
      );

      expect(mockFileHandle.close).toHaveBeenCalled();
    });
  });
});
