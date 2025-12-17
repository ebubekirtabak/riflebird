
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runTest } from '../index';
import * as child_process from 'node:child_process';
import { EventEmitter } from 'events';

vi.mock('node:child_process', () => ({
    spawn: vi.fn(),
}));

describe('runTest argument verification', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should NOT add -- separator for pnpm', async () => {
        const mockSpawn = vi.mocked(child_process.spawn);
        const mockChildProcess = new EventEmitter() as unknown as child_process.ChildProcess;
        mockChildProcess.stdout = new EventEmitter() as unknown as child_process.ChildProcess['stdout'];
        mockChildProcess.stderr = new EventEmitter() as unknown as child_process.ChildProcess['stderr'];
        mockChildProcess.kill = vi.fn();
        mockSpawn.mockReturnValue(mockChildProcess);

        // Simulate immediate exit to avoid timeout
        setTimeout(() => {
            mockChildProcess.emit('exit', 0, null);
        }, 10);

        await runTest('pnpm', 'run test', {
            cwd: '/tmp',
            testFilePath: '/tmp/foo.test.ts',
            framework: 'vitest',
            timeout: 1000
        });

        const calls = mockSpawn.mock.calls;
        expect(calls.length).toBe(1);
        const args = calls[0][1];

        // Validate args has no standalone '--'
        expect(args).not.toContain('--');
        expect(args).toContain('--reporter=json');
    });

    it('should add -- separator for npm', async () => {
        const mockSpawn = vi.mocked(child_process.spawn);
        const mockChildProcess = new EventEmitter() as unknown as child_process.ChildProcess;
        mockChildProcess.stdout = new EventEmitter() as unknown as child_process.ChildProcess['stdout'];
        mockChildProcess.stderr = new EventEmitter() as unknown as child_process.ChildProcess['stderr'];
        mockChildProcess.kill = vi.fn();
        mockSpawn.mockReturnValue(mockChildProcess);

        setTimeout(() => {
            mockChildProcess.emit('exit', 0, null);
        }, 10);

        await runTest('npm', 'npm run test', {
            cwd: '/tmp',
            testFilePath: '/tmp/foo.test.ts',
            framework: 'vitest',
            timeout: 1000
        });

        const calls = mockSpawn.mock.calls;
        expect(calls.length).toBe(1);
        const args = calls[0][1];

        // Validate args HAS standalone '--'
        expect(args).toContain('--');
        expect(args).toContain('--reporter=json');
    });
});
