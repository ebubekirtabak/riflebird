import path from 'node:path';
import fs from 'node:fs';

/**
 * Configuration for generating file paths
 */
export type GenerateFilePathOptions = {
  outputDir?: string;
  projectRoot?: string;
  strategy?: 'root' | 'colocated';
  /**
   * Suffix to insert before extension (e.g., '.test', '.stories')
   * Required if filenameTransformer is not provided.
   */
  suffix?: string;
  /**
   * Custom transformer for the filename
   * If provided, suffix is ignored.
   */
  filenameTransformer?: (filePath: string) => string;
};

/**
 * Generic helper to generate related file paths (tests, stories, etc)
 * Replaces specific helpers like generateTestFilePathWithConfig
 */
export const generateFilePathWithConfig = (
  filePath: string,
  options: GenerateFilePathOptions
): string => {
  const { outputDir, projectRoot, strategy, suffix, filenameTransformer } = options;

  const effectiveStrategy = strategy || (outputDir ? detectOutputStrategy(outputDir) : 'root');

  let relatedFileName: string;
  if (suffix) {
    relatedFileName = insertSuffix(filePath, suffix);
  } else if (filenameTransformer) {
    relatedFileName = filenameTransformer(filePath);
  } else {
    throw new Error(
      'Either suffix or filenameTransformer must be provided to generateFilePathWithConfig'
    );
  }

  if (!outputDir) {
    return relatedFileName;
  }

  if (effectiveStrategy === 'colocated') {
    const dir = path.dirname(filePath);
    const filename = path.basename(relatedFileName);
    return path.join(dir, outputDir, filename);
  }

  let relativePath = filePath;
  if (projectRoot && path.isAbsolute(filePath)) {
    relativePath = path.relative(projectRoot, filePath);
  }

  const relativeRelatedPath = suffix
    ? insertSuffix(relativePath, suffix)
    : filenameTransformer!(relativePath);

  return path.join(outputDir, relativeRelatedPath);
};

/**
 * Detect output strategy from outputDir path pattern
 * @param outputDir - Output directory path
 * @returns Detected strategy ('root' or 'colocated')
 * @example
 * detectOutputStrategy('./__tests__') // 'colocated'
 * detectOutputStrategy('__tests__') // 'colocated'
 * detectOutputStrategy('tests/unit') // 'root'
 */
export const detectOutputStrategy = (outputDir: string): 'root' | 'colocated' => {
  // Common test directory names that suggest colocated strategy
  const colocatedPatterns = [
    '__tests__',
    '__test__',
    'tests',
    'test',
    '__specs__',
    '__spec__',
    'specs',
    'spec',
  ];

  if (outputDir.startsWith('./')) {
    return 'colocated';
  }

  if (!outputDir.includes('/') && colocatedPatterns.includes(outputDir)) {
    return 'colocated';
  }

  return 'root';
};

/**
 * Insert a suffix before the file extension
 * @param filePath - Original file path
 * @param suffix - Suffix to insert (e.g., '.test', '.stories')
 * @returns Path with suffix inserted
 */
export const insertSuffix = (filePath: string, suffix: string): string => {
  const lastDotIndex = filePath.lastIndexOf('.');

  if (lastDotIndex === -1) {
    return `${filePath}${suffix}`;
  }

  const pathWithoutExt = filePath.substring(0, lastDotIndex);
  const extension = filePath.substring(lastDotIndex);

  return `${pathWithoutExt}${suffix}${extension}`;
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
  return insertSuffix(filePath, '.test');
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
  return testPatterns.some((pattern) => filePath.includes(pattern));
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
  return filePath.replace(/\.test\./, '.').replace(/\.spec\./, '.');
};

const JS_TS_FAMILY = ['.tsx', '.ts', '.jsx', '.js', '.d.ts', '.mjs', '.cjs'];
const STYLES_FAMILY = ['.css', '.scss', '.less', '.sass'];
const HTML_FAMILY = ['.html', '.htm'];
const JSON_FAMILY = ['.json', '.json5', '.jsonc'];
const MD_FAMILY = ['.md', '.markdown'];

/**
 * Get related extensions for file recovery based on input extension
 * @param extension - File extension (e.g., '.ts', '.js')
 * @returns Array of related extensions to try
 */
export const getRelatedExtensions = (extension: string): string[] => {
  const ext = extension.toLowerCase();

  if (JS_TS_FAMILY.includes(ext)) {
    return JS_TS_FAMILY;
  }

  if (STYLES_FAMILY.includes(ext)) {
    return STYLES_FAMILY;
  }

  if (HTML_FAMILY.includes(ext)) {
    return HTML_FAMILY;
  }

  if (JSON_FAMILY.includes(ext)) {
    return JSON_FAMILY;
  }

  if (MD_FAMILY.includes(ext)) {
    return MD_FAMILY;
  }

  // Default: return just the input extension to be safe, or empty if we want to rely on the caller's fallback
  return [extension];
};
/*
 * Generate story file path by inserting .stories before the file extension
 * @param filePath - Original file path
 * @returns Story file path with .stories inserted before extension
 * @example
 * generateStoryFilePath('src/component.tsx') // 'src/component.stories.tsx'
 * generateStoryFilePath('file.ts') // 'file.stories.ts'
 */
export const generateStoryFilePath = (filePath: string): string => {
  return insertSuffix(filePath, '.stories');
};

/**
 * Check if a file or directory exists at the given path.
 * This is a synchronous operation that checks the filesystem.
 *
 * @param filePath - Absolute or relative path to check for existence
 * @returns `true` if the file/directory exists and is accessible, `false` otherwise
 *
 * @remarks
 * - Returns `false` for empty or whitespace-only paths instead of throwing
 * - Returns `false` for paths with null bytes instead of throwing
 * - Catches any filesystem errors and returns `false` (e.g., permission issues)
 * - Works with both files and directories
 * - For relative paths, resolves relative to current working directory
 *
 * @example
 * ```typescript
 * // Check if a file exists
 * fileExists('/path/to/file.ts') // true or false
 *
 * // Check relative path
 * fileExists('./package.json') // true or false
 *
 * // Invalid paths return false instead of throwing
 * fileExists('') // false
 * fileExists('   ') // false
 * fileExists('path\x00with\x00nulls') // false
 * ```
 */
export const fileExists = (filePath: string): boolean => {
  if (!filePath || filePath.trim().length === 0) {
    return false;
  }

  if (filePath.includes('\0')) {
    return false;
  }

  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
};
