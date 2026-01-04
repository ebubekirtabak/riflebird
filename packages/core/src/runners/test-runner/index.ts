import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ProjectFileWalker } from '@utils';
import { TestRunOptions, TestRunResult, VitestJsonReport, ReporterArgsParams } from './types';
import { executeProcessCommand } from '@runners/process-execution';

export * from './types';
export * from './test-output-extractor';

const cleanTempFiles = async (path: string) => {
  await fs.unlink(path).catch(() => {
    /* ignore cleanup errors */
  });
};

/**
 * Get framework-specific arguments for JSON reporting
 * @param params - Parameters required for reporter arguments
 * @param framework - Test framework name (vitest, jest, mocha)
 * @returns Array of command line arguments
 */
export function getReporterArgsByFramework(
  params: ReporterArgsParams,
  framework?: string
): string[] {
  if (!framework) {
    return [];
  }

  const normalizedFramework = framework.toLowerCase();
  const argsByFramework: Record<string, string[]> = {
    vitest: ['--reporter=json', `--outputFile=${params.jsonReportPath}`],
    jest: ['--json', `--outputFile=${params.jsonReportPath}`],
    mocha: ['--reporter', 'json', '--reporter-option', `output=${params.jsonReportPath}`],
  };

  return argsByFramework[normalizedFramework] || [];
}

/**
 * Generate a unique, safe path for the JSON report file
 * @param cwd - Current working directory
 * @param framework - Test framework name
 * @returns Absolute path to the JSON report file
 */
export function generateJsonReportPath(cwd: string, framework?: string): string {
  const safeFramework = (framework || 'unit-test').replace(/[^a-z0-9-]/gi, '-');
  const filename = `.${safeFramework}-report-${Date.now()}-${randomUUID()}.json`;

  return path.join(cwd, filename);
}

/**
 * Read and parse the JSON report file
 * @param cwd - Current working directory
 * @param jsonReportPath - Path to the JSON report file
 * @returns Parsed JSON report or null if not found/invalid
 */
export async function readJsonReport(
  cwd: string,
  jsonReportPath: string
): Promise<VitestJsonReport | null> {
  try {
    const fileWalker = new ProjectFileWalker({ projectRoot: cwd });
    const jsonContent = await fileWalker.readFileFromProject(jsonReportPath);
    const jsonReport = JSON.parse(jsonContent) as VitestJsonReport;
    await cleanTempFiles(jsonReportPath);
    return jsonReport;
  } catch {
    // JSON report not available, will use stdout/stderr
    return null;
  }
}

/**
 * Parse test command string into executable and arguments
 * @param testCommand - Raw test command (e.g., "npm test", "pnpm run test")
 * @returns Object with command executable and arguments array
 */
export function parseTestCommand(testCommand: string): { command: string; args: string[] } {
  const commandParts = testCommand.split(' ');
  const command = commandParts[0];
  const args = commandParts.slice(1);

  // Only npm needs explicit '--' separator for arguments
  if (command === 'npm') {
    args.push('--');
  }

  return { command, args };
}

/**
 * Run a test file using the specified package manager and test command with JSON reporter
 * @param testCommand - Test command from package.json (e.g., "test", "run test")
 * @param options - Test execution options
 * @returns Test execution result with JSON report
 */
export async function runTest(
  testCommand: string,
  options: TestRunOptions
): Promise<TestRunResult> {
  const startTime = Date.now();
  const { cwd, testFilePath, timeout = 30000, framework } = options;

  const { command, args } = parseTestCommand(testCommand);

  const jsonReportPath = generateJsonReportPath(cwd, framework);
  args.push(...getReporterArgsByFramework({ jsonReportPath }, framework));

  const relativeTestPath = path.relative(cwd, testFilePath);
  args.push(relativeTestPath);

  try {
    const { stdout, stderr, exitCode, timedOut } = await executeProcessCommand(command, args, {
      cwd,
      timeout,
    });

    const duration = Date.now() - startTime;

    const jsonReport = await readJsonReport(cwd, jsonReportPath);

    if (timedOut) {
      return {
        success: false,
        exitCode: -1,
        stdout,
        stderr,
        duration,
        jsonReport,
        error: `Test execution timed out after ${timeout}ms`,
      };
    }

    return {
      success: exitCode === 0,
      exitCode: exitCode ?? -1,
      stdout,
      stderr,
      duration,
      jsonReport,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    await cleanTempFiles(jsonReportPath);
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: message,
      duration,
      jsonReport: null,
      error: `Failed to execute test: ${message}`,
    };
  }
}
