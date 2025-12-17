import { spawn } from 'node:child_process';
import { once } from 'node:events';

export interface ProcessExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * Execute a test process with timeout handling
 * @param command - Command to execute (e.g., "npm", "pnpm")
 * @param args - Arguments for the command
 * @param cwd - Current working directory
 * @param timeout - Timeout in milliseconds
 * @returns Process execution result
 */
export async function executeProcessCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number,
  CI?: boolean
): Promise<ProcessExecutionResult> {
  const proc = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: CI ? 'true' : 'false' },
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');
  proc.stdout.on('data', (data: string) => {
    stdout += data;
  });
  proc.stderr.on('data', (data: string) => {
    stderr += data;
  });

  // Set up timeout
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGTERM');
  }, timeout);

  // Wait for process to exit
  const [exitCode] = (await once(proc, 'exit')) as [number | null, string | null];
  clearTimeout(timeoutHandle);

  return {
    stdout,
    stderr,
    exitCode,
    timedOut,
  };
}
