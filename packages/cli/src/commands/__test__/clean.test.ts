import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanCommand } from '../clean';
import fs from 'fs/promises';
import path from 'path';
import { RIFLEBIRD_DIR } from '@riflebird/core';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    rm: vi.fn(),
    access: vi.fn(),
  },
}));

import { type MockInstance } from 'vitest';

describe('cleanCommand', () => {
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(`should remove the ${RIFLEBIRD_DIR} directory and log success if it exists`, async () => {
    const cwd = '/test/cwd';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const expectedPath = path.join(cwd, RIFLEBIRD_DIR);

    // Mock access to succeed (directory exists)
    vi.mocked(fs.access).mockResolvedValue(undefined);

    await cleanCommand();

    expect(fs.access).toHaveBeenCalledWith(expectedPath);
    expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Riflebird cache cleaned successfully')
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should log a message if the cache directory does not exist', async () => {
    const cwd = '/test/cwd';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const expectedPath = path.join(cwd, RIFLEBIRD_DIR);

    // Mock access to fail (directory does not exist)
    const error = new Error('ENOENT');
    Object.assign(error, { code: 'ENOENT' });
    vi.mocked(fs.access).mockRejectedValue(error);

    await cleanCommand();

    expect(fs.access).toHaveBeenCalledWith(expectedPath);
    expect(fs.rm).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cache is already clean'));
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should handle errors during removal and log a warning', async () => {
    // Mock access to succeed
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const error = new Error('Permission denied');
    vi.mocked(fs.rm).mockRejectedValueOnce(error);

    await cleanCommand();

    expect(fs.rm).toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to clean cache: Permission denied')
    );
  });
});
