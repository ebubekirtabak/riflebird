import path from 'node:path';

export type GenerateTestFilePathOptions = {
  testOutputDir?: string;
  projectRoot?: string;
  strategy?: 'root' | 'colocated';
};

/**
 * Detect test output strategy from testOutputDir path pattern
 * @param testOutputDir - Test output directory path
 * @returns Detected strategy ('root' or 'colocated')
 * @example
 * detectTestOutputStrategy('./__tests__') // 'colocated'
 * detectTestOutputStrategy('__tests__') // 'colocated'
 * detectTestOutputStrategy('tests/unit') // 'root'
 */
export const detectTestOutputStrategy = (testOutputDir: string): 'root' | 'colocated' => {
  // Common test directory names that suggest colocated strategy
  const colocatedPatterns = ['__tests__', '__test__', 'tests', 'test', '__specs__', '__spec__', 'specs', 'spec'];

  if (testOutputDir.startsWith('./')) {
    return 'colocated';
  }

  if (!testOutputDir.includes('/') && colocatedPatterns.includes(testOutputDir)) {
    return 'colocated';
  }

  return 'root';
};

/**
 * Generate test file path by inserting .test before the file extension
 * @param filePath - Original file path
 * @returns Test file path with .test inserted before extension
 * @example
 * generateTestFilePath('src/component.tsx') // 'src/component.test.tsx'
 * generateTestFilePath('file.ts') // 'file.test.ts'
 */
export const generateTestFilePath = (filePath: string): string => {
  const lastDotIndex = filePath.lastIndexOf('.');

  if (lastDotIndex === -1) {
    // No extension found, append .test
    return `${filePath}.test`;
  }

  const pathWithoutExt = filePath.substring(0, lastDotIndex);
  const extension = filePath.substring(lastDotIndex);

  return `${pathWithoutExt}.test${extension}`;
};

/**
 * Generate test file path with configurable output directory
 * @param filePath - Original file path (can be absolute or relative)
 * @param options - Configuration options
 * @returns Test file path, either co-located or in testOutputDir
 */
export const generateTestFilePathWithConfig = (
  filePath: string,
  options?: GenerateTestFilePathOptions
): string => {
  const { testOutputDir, projectRoot, strategy } = options || {};

  const effectiveStrategy = strategy || (testOutputDir ? detectTestOutputStrategy(testOutputDir) : 'root');

  const testFileName = generateTestFilePath(filePath);

  if (!testOutputDir) {
    return testFileName;
  }

  if (effectiveStrategy === 'colocated') {
    const dir = path.dirname(filePath);
    const filename = path.basename(testFileName);
    return path.join(dir, testOutputDir, filename);
  }

  let relativePath = filePath;
  if (projectRoot && path.isAbsolute(filePath)) {
    relativePath = path.relative(projectRoot, filePath);
  }

  const relativeTestPath = generateTestFilePath(relativePath);

  return path.join(testOutputDir, relativeTestPath);
};

/**
 * Check if a file path is a test file
 * @param filePath - File path to check
 * @returns True if the file is a test file
 * @example
 * isTestFile('component.test.tsx') // true
 * isTestFile('component.spec.ts') // true
 * isTestFile('__test__/component.spec.ts') // true
 * isTestFile('__tests__/component.ts') // true
 * isTestFile('tests/component.ts') // true
 * isTestFile('component.tsx') // false
 */
export const isTestFile = (filePath: string): boolean => {
  const testPatterns = ['.test.', '.spec.', '__tests__/', '__test__/', 'tests/'];
  return testPatterns.some(pattern => filePath.includes(pattern));
};

/**
 * Get the source file path from a test file path
 * @param filePath - Test file path
 * @returns Source file path without .test or .spec
 * @example
 * getSourceFilePath('component.test.tsx') // 'component.tsx'
 * getSourceFilePath('component.spec.ts') // 'component.ts'
 */
export const getSourceFilePath = (filePath: string): string => {
  return filePath
    .replace(/\.test\./, '.')
    .replace(/\.spec\./, '.');
};
