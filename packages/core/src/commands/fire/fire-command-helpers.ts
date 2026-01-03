import type { TestType, TestScope, FireInput } from './types';
import { SUPPORTED_TEST_TYPES } from './constants';
import { DEFAULT_FILE_EXCLUDE_PATTERNS } from '@config/constants';
import { globToRegex } from '@utils/file-tree';

/**
 * Get default file exclusion patterns
 * Filters out test files, Storybook stories, config files, etc.
 * @returns Array of exclusion patterns
 */
export function getFileExcludePatterns(): string[] {
  return [...DEFAULT_FILE_EXCLUDE_PATTERNS];
}

/**
 * Check if a file path should be excluded based on exclusion patterns
 * @param filePath - The file path to check
 * @param excludePatterns - Optional custom exclusion patterns (defaults to DEFAULT_FILE_EXCLUDE_PATTERNS)
 * @returns true if file should be excluded, false otherwise
 */
export function shouldExcludeFile(filePath: string, excludePatterns?: string[]): boolean {
  const patterns = excludePatterns || [...DEFAULT_FILE_EXCLUDE_PATTERNS];

  return patterns.some((pattern: string) => {
    const regex = globToRegex(pattern);
    return regex.test(filePath);
  });
}

/**
 * Resolve which test types should be executed
 * @param all - Whether to run all test types
 * @param testTypes - Specific test types requested
 * @returns Array of test types to execute
 */
export function resolveTestTypes(all: boolean | undefined, testTypes: TestType[]): TestType[] {
  if (all && testTypes.length === 0) {
    return SUPPORTED_TEST_TYPES;
  }

  if (testTypes.length > 0) {
    return testTypes;
  }

  return ['unit', 'document'];
}

/**
 * Get file patterns from input arguments
 * Determines patterns based on scope (if provided), testPath (if provided), or defaults
 * @param input - The command input containing scope and testPath
 * @returns Array of file patterns to search for
 */
export function getPatternsFromInput({ scope, testPath }: FireInput): string[] {
  if (scope) {
    return getScopePatterns(scope);
  }

  if (testPath) {
    return [testPath];
  }

  return ['src/**/*.{ts,tsx,js,jsx,vue}'];
}

/**
 * Get file patterns based on scope
 * @param scope - The scope to filter by
 * @returns Array of glob patterns
 */
export function getScopePatterns(scope: TestScope): string[] {
  const patterns: Record<TestScope, string[]> = {
    component: [
      '**/src/components/**/*.{tsx,jsx,vue}',
      '**/components/**/*.{tsx,jsx,vue}',
      '**/src/app/components/**/*.{tsx,jsx,vue}',
    ],
    layout: [
      '**/src/layouts/**/*.{tsx,jsx,vue,ts,js}',
      '**/layouts/**/*.{tsx,jsx,vue,ts,js}',
      '**/src/app/layouts/**/*.{tsx,jsx,vue,ts,js}',
    ],
    page: [
      '**/src/pages/**/*.{tsx,jsx,vue,ts,js}',
      '**/pages/**/*.{tsx,jsx,vue,ts,js}',
      '**/src/app/**/(page|route).{tsx,jsx,ts,js}',
    ],
    service: [
      '**/src/services/**/*.{ts,js}',
      '**/services/**/*.{ts,js}',
      '**/src/api/**/*.{ts,js}',
      '**/api/**/*.{ts,js}',
    ],
    util: [
      '**/src/utils/**/*.{ts,js}',
      '**/utils/**/*.{ts,js}',
      '**/src/helpers/**/*.{ts,js}',
      '**/helpers/**/*.{ts,js}',
    ],
    hook: [
      '**/src/hooks/**/*.{ts,tsx,js,jsx}',
      '**/hooks/**/*.{ts,tsx,js,jsx}',
      '**/src/composables/**/*.{ts,js}',
    ],
    store: [
      '**/src/store/**/*.{ts,js}',
      '**/store/**/*.{ts,js}',
      '**/src/stores/**/*.{ts,js}',
      '**/stores/**/*.{ts,js}',
      '**/src/state/**/*.{ts,js}',
    ],
    document: [
      '**/src/documents/**/*.{md,markdown}',
      '**/documents/**/*.{md,markdown}',
      '**/src/app/documents/**/*.{md,markdown}',
      '**/app/documents/**/*.stories.{md,markdown,mdx,markdownx,tsx,jsx,vue,ts,js}',
      '**/app/**/*.stories.{md,markdown,mdx,markdownx,tsx,jsx,vue,ts,js}',
      '**/src/**/*.stories.{md,markdown,mdx,markdownx,tsx,jsx,vue,ts,js}',
    ],
  };

  return patterns[scope] || [];
}
