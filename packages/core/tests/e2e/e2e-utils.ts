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
