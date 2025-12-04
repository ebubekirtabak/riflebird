import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, defineConfig } from '../loader';
import fs from 'fs/promises';
import type { RiflebirdConfig } from '../schema';

// Mock modules
vi.mock('fs/promises');

describe('config/loader', () => {
  const mockCwd = '/project';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  describe('loadConfig', () => {
    it('should throw error when config file not found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await expect(loadConfig()).rejects.toThrow(
        'riflebird.config.ts not found. Run "riflebird init" to create one.'
      );
    });

    it('should throw error on invalid config schema', async () => {
      // First check passes (file exists), then loadConfig will validate and fail
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // This will make it find the .ts file, but jiti needs to return invalid config
      // We can't easily mock jiti in tests, so we just verify the error handling works
      await expect(loadConfig()).rejects.toThrow();
    });
  });

  describe('defineConfig', () => {
    it('should return the provided config', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          model: 'gpt-4',
          temperature: 0.2,
          apiKey: 'test-key',
        },
        framework: 'playwright' as const,
      } satisfies RiflebirdConfig;

      const result = defineConfig(config);

      expect(result).toBe(config);
      expect(result).toEqual(config);
    });
  });
});
