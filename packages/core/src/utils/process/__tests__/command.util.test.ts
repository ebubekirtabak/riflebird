import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import { ensureCommandExists } from '../command.util';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

describe('ensureCommandExists', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if command is found via "which"', () => {
    // Mock spawnSync to return success for "which"
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
    } as unknown as SpawnSyncReturns<string>);

    const result = ensureCommandExists('git');
    expect(result).toBe(true);
    expect(spawnSync).toHaveBeenCalledWith('which', ['git']);
  });

  it('should return true if command is found via "command -v" (fallback)', () => {
    // Mock "which" to fail (throw or non-zero status - here we simulate throw which is caught)
    vi.mocked(spawnSync).mockImplementationOnce(() => {
      throw new Error('which failed');
    });

    // Mock "command -v" to succeed
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
    } as unknown as SpawnSyncReturns<string>);

    const result = ensureCommandExists('git');
    expect(result).toBe(true);
    expect(spawnSync).toHaveBeenCalledTimes(2);
    expect(spawnSync).toHaveBeenNthCalledWith(1, 'which', ['git']);
    expect(spawnSync).toHaveBeenNthCalledWith(2, 'command', ['-v', 'git'], { shell: true });
  });

  it('should return true if command is found via "command -v" (fallback) when "which" returns non-zero', () => {
    // Mock "which" to return non-zero
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
    } as unknown as SpawnSyncReturns<string>);

    // Mock "command -v" to succeed
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
    } as unknown as SpawnSyncReturns<string>);

    const result = ensureCommandExists('git');
    expect(result).toBe(true);
    expect(spawnSync).toHaveBeenCalledTimes(2);
  });

  it('should throw an error if command is not found by either method', () => {
    // Mock "which" to fail
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
    } as unknown as SpawnSyncReturns<string>);

    // Mock "command -v" to fail
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
    } as unknown as SpawnSyncReturns<string>);

    expect(() => ensureCommandExists('unknown-cmd')).toThrow(
      'Command not found: please install unknown-cmd to use the unknown-cmd provider.'
    );
  });
});
