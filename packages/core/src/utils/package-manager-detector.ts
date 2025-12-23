import { ProjectFileWalker } from './project-file-walker';
import type { PackageInfo } from '@models/project-context';
import { PackageJson, PackageManagerInfo } from '@types';

// Common test frameworks to detect
const TEST_FRAMEWORKS = [
  'vitest',
  'jest',
  'mocha',
  'jasmine',
  'ava',
  'tape',
  'playwright',
  'cypress',
  'puppeteer',
  'webdriverio',
  '@testing-library/react',
  '@testing-library/vue',
  '@testing-library/angular',
  'karma',
  'qunit',
  'lab',
  'tap',
] as const;

export const DEFAULT_PACKAGE_MANAGER_FILE = 'package.json';

/**
 * Detect test frameworks from dependencies
 */
function detectTestFrameworks(pkg: PackageJson): string[] {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  return TEST_FRAMEWORKS.filter((framework) =>
    Object.keys(allDeps).some((dep) => dep === framework || dep.startsWith(`${framework}/`))
  );
}

/**
 * Extract package information from package.json
 */
function extractPackageInfo(pkg: PackageJson): PackageInfo {
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    dependencies: pkg.dependencies,
    devDependencies: pkg.devDependencies,
    peerDependencies: pkg.peerDependencies,
    optionalDependencies: pkg.optionalDependencies,
    scripts: pkg.scripts,
    testFrameworks: detectTestFrameworks(pkg),
    engines: pkg.engines,
    private: pkg.private,
    workspaces: pkg.workspaces,
  };
}

/**
 * Detect package manager and extract comprehensive info from package.json
 * @param projectRoot - Project root directory
 * @param detectedType - Package manager type from AI detection (optional)
 * @returns Package manager info with full package.json metadata
 */
export async function detectPackageManagerInfo(
  projectRoot: string,
  detectedType?: string
): Promise<PackageManagerInfo> {
  const walker = new ProjectFileWalker({ projectRoot });

  try {
    // Read package.json
    const pkgContent = await walker.readFileFromProject(DEFAULT_PACKAGE_MANAGER_FILE, false);
    const pkg = JSON.parse(pkgContent) as PackageJson;

    // Extract comprehensive package info
    const packageInfo = extractPackageInfo(pkg);

    // Determine package manager type
    let type: PackageManagerInfo['type'] = 'unknown';
    if (detectedType) {
      const normalized = detectedType.toLowerCase();
      if (normalized.includes('pnpm')) type = 'pnpm';
      else if (normalized.includes('yarn')) type = 'yarn';
      else if (normalized.includes('bun')) type = 'bun';
      else if (normalized.includes('npm')) type = 'npm';
    }

    // Detect test script with heuristics
    const testScript = detectTestScript(pkg, packageInfo.testFrameworks);

    // Build test command based on package manager and script
    let testCommand: string;
    if (testScript) {
      // Use the defined test script
      testCommand = `${type === 'unknown' ? 'npm' : type} run ${testScript}`;
    } else {
      // Fallback to default test command
      testCommand = `${type === 'unknown' ? 'npm' : type} test`;
    }

    return {
      type,
      testCommand,
      testScript,
      packageInfo,
      packageFilePath: DEFAULT_PACKAGE_MANAGER_FILE,
    };
  } catch {
    // If package.json doesn't exist or can't be read, return defaults
    const fallbackType =
      detectedType === 'pnpm'
        ? 'pnpm'
        : detectedType === 'yarn'
          ? 'yarn'
          : detectedType === 'bun'
            ? 'bun'
            : 'npm';
    return {
      type: fallbackType,
      testCommand: `${fallbackType} test`,
    };
  }
}

/**
 * Detect the best test script to use based on heuristics
 * Priority:
 * 1. test:unit
 * 2. test
 * 3. test:<framework> (e.g. test:jest, test:vitest)
 * 4. any script containing 'test' (fallback)
 */
function detectTestScript(pkg: PackageJson, frameworks: string[] = []): string | undefined {
  if (!pkg.scripts) return undefined;

  // 1. Priority: Explicit unit test script
  if (pkg.scripts['test:unit']) return 'test:unit';
  if (pkg.scripts['test-unit']) return 'test-unit'; // Common alternative

  // 2. Priority: Standard test script
  if (pkg.scripts['test']) return 'test';

  // 3. Priority: Framework specific script
  for (const framework of frameworks) {
    const scriptName = `test:${framework}`;
    if (pkg.scripts[scriptName]) return scriptName;

    // Check for framework name directly as script (e.g. "jest": "jest")
    if (pkg.scripts[framework]) return framework;
  }

  // 4. Fallback: Find any script that looks like a test script
  // Prefer scripts that start with 'test:'
  const testScript = Object.keys(pkg.scripts).find((script) => script.startsWith('test:'));
  if (testScript) return testScript;

  return undefined;
}
