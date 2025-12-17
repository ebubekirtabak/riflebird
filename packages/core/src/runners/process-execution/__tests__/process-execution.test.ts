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
    const promise = executeProcessCommand('echo', ['hello'], '/tmp', 1000);

    // Simulate process output
    mockChildProcess.stdout!.emit('data', 'hello world');
    mockChildProcess.stderr!.emit('data', 'some error');

    // Simulate process exit
    mockChildProcess.emit('exit', 0);

    const result = await promise;

    expect(result.stdout).toBe('hello world');
    expect(result.stderr).toBe('some error');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
      cwd: '/tmp',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: expect.objectContaining({ CI: 'false' }),
    });
  });

  it('should pass CI flag as true', async () => {
    const promise = executeProcessCommand('echo', ['hello'], '/tmp', 1000, true);
    mockChildProcess.emit('exit', 0);
    await promise;

    expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
      cwd: '/tmp',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: expect.objectContaining({ CI: 'true' }),
    });
  });

  it('should pass CI flag as false', async () => {
    const promise = executeProcessCommand('echo', ['hello'], '/tmp', 1000, false);
    mockChildProcess.emit('exit', 0);
    await promise;

    expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
      cwd: '/tmp',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: expect.objectContaining({ CI: 'false' }),
    });
  });

  it('should handle process timeout', async () => {
    vi.useFakeTimers();
    const promise = executeProcessCommand('sleep', ['2'], '/tmp', 1000);

    // Advance time to trigger timeout
    vi.advanceTimersByTime(1001);

    // Verify kill was called
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

    // Simulate process exit after kill
    mockChildProcess.emit('exit', null, 'SIGTERM');

    const result = await promise;

    expect(result.timedOut).toBe(true);
    // Exit code might be null when killed
    vi.useRealTimers();
  });

  it('should handle non-zero exit code', async () => {
    const promise = executeProcessCommand('cmd', [], '/tmp', 1000);

    mockChildProcess.emit('exit', 1);

    const result = await promise;

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });
});
