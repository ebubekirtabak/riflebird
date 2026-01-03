import { spawn } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';

export type ProcessExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

export type ProcessExecutionOptions = {
  cwd?: string;
  timeout?: number;
  stdio?: StdioOptions;
  env?: NodeJS.ProcessEnv;
};

/**
 * Execute a process with timeout handling and detailed result
 */
export async function executeProcessCommand(
  command: string,
  args: string[],
  options: ProcessExecutionOptions = {}
): Promise<ProcessExecutionResult> {
  const { cwd = process.cwd(), timeout = 0, stdio = 'pipe', env = process.env } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      shell: true,
      env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);
    }

    const onExit = (code: number | null) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        timedOut,
      });
    };

    const onError = (error: Error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      reject(error);
    };

    child.on('close', onExit);
    child.on('error', onError);
  });
}
