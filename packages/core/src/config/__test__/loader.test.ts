// packages/core/src/config/loader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, defineConfig } from '../loader';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import path from 'path';

// Mock modules
vi.mock('fs/promises');
vi.mock('url');

describe('config/loader', () => {
  const mockConfigPath = '/project/riflebird.config.ts';
  const mockCwd = '/project';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('should load config from provided path', async () => {
      const mockConfig = { database: { url: 'test-url' } };
      vi.mocked(pathToFileURL).mockReturnValue({ href: 'file:///test' } as any);
      vi.doMock('file:///test', () => ({ default: mockConfig }), { virtual: true });

      const result = await loadConfig(mockConfigPath);
      
      expect(pathToFileURL).toHaveBeenCalledWith(mockConfigPath);
      expect(result).toEqual(mockConfig);
    });

    it('should find and load config when no path provided', async () => {
      const mockConfig = { database: { url: 'test-url' } };
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(pathToFileURL).mockReturnValue({ href: 'file:///test' } as any);
      vi.doMock('file:///test', () => ({ default: mockConfig }), { virtual: true });

      const result = await loadConfig();
      
      expect(fs.access).toHaveBeenCalledWith(mockConfigPath);
      expect(pathToFileURL).toHaveBeenCalledWith(mockConfigPath);
      expect(result).toEqual(mockConfig);
    });

    it('should throw error when config file not found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await expect(loadConfig()).rejects.toThrow(
        'riflebird.config.ts not found. Run "riflebird init" to create one.'
      );
    });

    it('should try multiple config file extensions', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);
      
      const mockConfig = { database: { url: 'test-url' } };
      const jsConfigPath = path.join(mockCwd, 'riflebird.config.js');
      vi.mocked(pathToFileURL).mockReturnValue({ href: 'file:///test' } as any);
      vi.doMock('file:///test', () => ({ default: mockConfig }), { virtual: true });

      await loadConfig();

      expect(fs.access).toHaveBeenNthCalledWith(1, path.join(mockCwd, 'riflebird.config.ts'));
      expect(fs.access).toHaveBeenNthCalledWith(2, path.join(mockCwd, 'riflebird.config.js'));
      expect(fs.access).toHaveBeenNthCalledWith(3, path.join(mockCwd, 'riflebird.config.mjs'));
      expect(pathToFileURL).toHaveBeenCalledWith(jsConfigPath);
    });

    it('should handle config module without default export', async () => {
      const mockConfig = { database: { url: 'test-url' } };
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(pathToFileURL).mockReturnValue({ href: 'file:///test' } as any);
      vi.doMock('file:///test', () => (mockConfig), { virtual: true });

      const result = await loadConfig();
      
      expect(result).toEqual(mockConfig);
    });

    it('should validate config with Zod schema', async () => {
      const invalidConfig = { invalid: 'config' };
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(pathToFileURL).mockReturnValue({ href: 'file:///test' } as any);
      vi.doMock('file:///test', () => ({ default: invalidConfig }), { virtual: true });

      // Assuming RiflebirdConfigSchema would throw on invalid config
      await expect(loadConfig()).rejects.toThrow();
    });
  });

  describe('findConfigFile', () => {
    it('should return first existing config file', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);

      // Import the function to test it directly
      const { findConfigFile } = await import('./loader');
      const result = await findConfigFile();
      
      const expectedPath = path.join(mockCwd, 'riflebird.config.js');
      expect(result).toBe(expectedPath);
    });

    it('should return null when no config files exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      const { findConfigFile } = await import('./loader');
      const result = await findConfigFile();
      
      expect(result).toBeNull();
    });
  });

  describe('defineConfig', () => {
    it('should return the provided config', () => {
      const config = { database: { url: 'test-url' } };
      const result = defineConfig(config);
      
      expect(result).toBe(config);
    });
  });
});
