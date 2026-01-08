import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';

export const E2E_ROOT = __dirname;
export const MOCK_BIN_DIR = path.join(E2E_ROOT, 'mocks', 'bin');
export const FIXTURES_DIR = path.join(E2E_ROOT, 'fixtures');
export const PROJECT_ROOT = path.resolve(__dirname, '../../'); // packages/core
export const CLI_ROOT = path.resolve(PROJECT_ROOT, '../cli'); // packages/cli
export const DIST_INDEX = path.join(CLI_ROOT, 'dist', 'index.js');

export type TestSandbox = {
  cwd: string;
  cleanup: () => void;
};

export function createTestSandbox(fixtureName: string): TestSandbox {
  const fixturePath = path.join(FIXTURES_DIR, fixtureName);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixtureName}`);
  }

  const tempDir = path.join(os.tmpdir(), `riflebird-e2e-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // Recursive copy
  fs.cpSync(fixturePath, tempDir, { recursive: true });

  // Rename config if exists
  const fixtureConfig = path.join(tempDir, 'riflebird.config.fixture.ts');
  if (fs.existsSync(fixtureConfig)) {
    fs.renameSync(fixtureConfig, path.join(tempDir, 'riflebird.config.ts'));
  }

  // Rename package.json if exists as fixture
  const fixturePackage = path.join(tempDir, 'package.fixture.json');
  if (fs.existsSync(fixturePackage)) {
    fs.renameSync(fixturePackage, path.join(tempDir, 'package.json'));
  }

  return {
    cwd: tempDir,
    cleanup: () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to cleanup temp dir:', tempDir, e);
      }
    },
  };
}

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export function runRiflebird(args: string[], cwd: string): RunResult {
  // Ensure the mock gemini is in the PATH
  const env = {
    ...process.env,
    PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
    // Ensure we use the mock configuration if needed, or override via env vars
    // For unit tests we might want to force certain configs
  };

  // We run the built CLI code using node
  const result = spawnSync('node', [DIST_INDEX, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status,
  };
}

export type InteractiveInput = string | { key: string } | { delay: number };

export async function runRiflebirdInteractive(
  args: string[],
  cwd: string,
  inputs: InteractiveInput[]
): Promise<RunResult> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
    };

    const child = spawn('node', [DIST_INDEX, ...args], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code,
      });
    });

    // Handle inputs
    const writeInputs = async () => {
      for (const input of inputs) {
        if (typeof input === 'string') {
          child.stdin.write(input);
        } else if ('key' in input) {
          // Handle special keys if needed, for now just assuming string inputs
          // or use a library if complex key codes are needed.
          // For simple inquirer, \n is Enter.
          if (input.key === 'enter') child.stdin.write('\n');
          if (input.key === 'down') child.stdin.write('\u001B[B');
          if (input.key === 'up') child.stdin.write('\u001B[A');
        } else if ('delay' in input) {
          await new Promise((r) => setTimeout(r, input.delay));
        }
        // Small delay between inputs to ensure they are processed
        await new Promise((r) => setTimeout(r, 100));
      }
      child.stdin.end();
    };

    writeInputs().catch(reject);
  });
}
