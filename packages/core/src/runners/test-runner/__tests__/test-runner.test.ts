import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { stripAnsiCodes, runTest, getReporterArgsByFramework, parseTestCommand, readJsonReport } from '../index';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Unit tests for pure functions (no mocks needed)
describe('stripAnsiCodes', () => {
  it('should remove ANSI color codes', () => {
    const input = '\x1b[31mError:\x1b[0m Test failed';
    expect(stripAnsiCodes(input)).toBe('Error: Test failed');
  });

  it('should handle strings without ANSI codes', () => {
    const input = 'Plain text';
    expect(stripAnsiCodes(input)).toBe(input);
  });
});

describe('parseTestCommand', () => {
  it('should parse npm command', () => {
    const { command, args } = parseTestCommand('npm test');
    expect(command).toBe('npm');
    expect(args).toEqual(['test', '--']);
  });

  it('should parse pnpm command', () => {
    const { command, args } = parseTestCommand('pnpm run test');
    expect(command).toBe('pnpm');
    expect(args).toEqual(['run', 'test']);
  });
});

describe('getReporterArgsByFramework', () => {
  it('should return correct args for vitest', () => {
    const args = getReporterArgsByFramework({ jsonReportPath: 'report.json' }, 'vitest');
    expect(args).toContain('--reporter=json');
    expect(args).toContain('--outputFile=report.json');
  });

  it('should return correct args for jest', () => {
    const args = getReporterArgsByFramework({ jsonReportPath: 'report.json' }, 'jest');
    expect(args).toContain('--json');
    expect(args).toContain('--outputFile=report.json');
  });
});

// Integration tests using real FS and Processes
describe('Test Runner Integration', () => {
  let tmpDir: string;
  let dummyRunnerPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'riflebird-test-runner-'));
    dummyRunnerPath = path.join(tmpDir, 'runner.js');

    // Create a dummy test runner script
    const runnerScript = `
      const fs = require('fs');
      const args = process.argv.slice(2);

      // Basic argument parsing
      const outputFileArg = args.find(a => a.startsWith('--outputFile='));
      let outputFile;
      if (outputFileArg) outputFile = outputFileArg.split('=')[1];

      // Check flags
      if (args.includes('fail')) {
        console.error('Test failed');
        process.exit(1);
      }

      if (args.includes('timeout')) {
        setTimeout(() => {}, 5000); // Hang
        return;
      }

      // Success case
      console.log('Test passed');

      if (outputFile) {
        fs.writeFileSync(outputFile, JSON.stringify({
           numTotalTestSuites: 1,
           testResults: [],
           success: true
        }));
      }
    `;

    await fs.writeFile(dummyRunnerPath, runnerScript);
    // Create a dummy test file
    await fs.writeFile(path.join(tmpDir, 'test.spec.js'), '// test file');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should execute successfully and read JSON report', async () => {
    const result = await runTest('node', `node ${dummyRunnerPath}`, {
      cwd: tmpDir,
      testFilePath: path.join(tmpDir, 'test.spec.js'),
      framework: 'vitest', // triggers --outputFile arg
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Test passed');
    expect(result.jsonReport).toEqual({
      numTotalTestSuites: 1,
      testResults: [],
      success: true
    });
  });

  it('should handle test failures', async () => {
    // We append 'fail' to args by adding it to testCommand or rely on runTest appending test file.
    // Since runTest appends testFilePath relative path, we can't easily inject 'fail' flag via testFilePath without making it look like a file.
    // But we can enable failure via test command args if parseTestCommand allows it.
    // parseTestCommand splits by space.

    // Command: "node runner.js fail"
    const result = await runTest('node', `node ${dummyRunnerPath} fail`, {
      cwd: tmpDir,
      testFilePath: path.join(tmpDir, 'test.spec.js'),
      framework: 'vitest',
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Test failed');
    // JSON report might not be written on failure based on our dummy runner logic?
    // Our dummy runner ONLY writes JSON if NOT failed (or if we updated it).
    // Real runners usually write JSON even on failure.
    // Let's update dummy runner logic in beforeEach if we want to test report on failure,
    // but here checking null report behaves as expected.
    expect(result.jsonReport).toBeNull();
  });

  it('should handle timeouts', async () => {
    const result = await runTest('node', `node ${dummyRunnerPath} timeout`, {
      cwd: tmpDir,
      testFilePath: path.join(tmpDir, 'test.spec.js'),
      framework: 'vitest',
      timeout: 500, // Short timeout
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('should read and clean up existing JSON reports', async () => {
    const reportPath = path.join(tmpDir, 'existing-report.json');
    const reportContent = { test: 'content' };
    await fs.writeFile(reportPath, JSON.stringify(reportContent));

    const read = await readJsonReport(tmpDir, reportPath);
    expect(read).toEqual(reportContent);

    // Verify cleanup
    await expect(fs.access(reportPath)).rejects.toThrow();
  });

  it('should return null for missing JSON report', async () => {
    const read = await readJsonReport(tmpDir, path.join(tmpDir, 'nonexistent.json'));
    expect(read).toBeNull();
  });
});
