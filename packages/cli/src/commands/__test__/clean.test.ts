import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanCommand } from '../clean';
import fs from 'fs/promises';
import path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    rm: vi.fn(),
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

  it('should remove the .riflebird directory and log success', async () => {
    const cwd = '/test/cwd';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const expectedPath = path.join(cwd, '.riflebird');

    await cleanCommand();

    expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Riflebird cache cleaned successfully')
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should handle errors and log a warning', async () => {
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
