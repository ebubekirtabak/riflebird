import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { executeProcessCommand } from '../index';
import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'stream';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('executeProcessCommand', () => {
  let mockSpawn: Mock;
  let mockChildProcess: ChildProcess;

  beforeEach(() => {
    mockSpawn = spawn as unknown as Mock;
    mockChildProcess = new EventEmitter() as unknown as ChildProcess;
    mockChildProcess.stdout = new EventEmitter() as unknown as Readable;
    mockChildProcess.stdout!.setEncoding = vi.fn();
    mockChildProcess.stderr = new EventEmitter() as unknown as Readable;
    mockChildProcess.stderr!.setEncoding = vi.fn();
    mockChildProcess.kill = vi.fn();

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  it('should execute process and return stdout/stderr', async () => {
    const promise = executeProcessCommand('echo', ['hello'], { cwd: '/tmp', timeout: 1000 });

    // Simulate process output
    mockChildProcess.stdout!.emit('data', 'hello world');
    mockChildProcess.stderr!.emit('data', 'some error');

    // Simulate process exit
    mockChildProcess.emit('close', 0); // Using close event as per implementation

    const result = await promise;

    expect(result.stdout).toBe('hello world');
    expect(result.stderr).toBe('some error');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
      cwd: '/tmp',
      stdio: 'pipe', // Default
      shell: false,
      env: expect.anything(),
    });
  });

  it('should pass CI flag via env', async () => {
    const promise = executeProcessCommand('echo', ['hello'], {
      cwd: '/tmp',
      timeout: 1000,
      env: { ...process.env, CI: 'true' },
    });
    mockChildProcess.emit('close', 0);
    await promise;

    expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
      cwd: '/tmp',
      stdio: 'pipe',
      shell: false,
      env: expect.objectContaining({ CI: 'true' }),
    });
  });

  it('should handle process timeout', async () => {
    vi.useFakeTimers();
    const promise = executeProcessCommand('sleep', ['2'], { cwd: '/tmp', timeout: 1000 });

    // Advance time to trigger timeout
    vi.advanceTimersByTime(1001);

    // Verify kill was called
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

    // Simulate process exit after kill
    mockChildProcess.emit('close', null);

    const result = await promise;

    expect(result.timedOut).toBe(true);
    vi.useRealTimers();
  });

  it('should handle non-zero exit code', async () => {
    const promise = executeProcessCommand('cmd', [], { cwd: '/tmp', timeout: 1000 });

    mockChildProcess.emit('close', 1);

    const result = await promise;

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it('should handle spawn error (invalid command)', async () => {
    const promise = executeProcessCommand('invalid-command-that-does-not-exist', [], {
      cwd: '/tmp',
      timeout: 1000,
    });

    // Simulate spawn error
    mockChildProcess.emit('error', new Error('spawn invalid-command-that-does-not-exist ENOENT'));

    // We expect the promise to reject or handle the error.
    await expect(promise).rejects.toThrow('spawn invalid-command-that-does-not-exist ENOENT');
  });
});
