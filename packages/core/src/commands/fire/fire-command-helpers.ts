import type { TestType, TestScope } from '../fire-command';
import { SUPPORTED_TEST_TYPES } from './constants';
import { DEFAULT_COVERAGE_EXCLUDE } from '../../config/constants';
import { globToRegex } from '../../utils/file-tree';

/**
 * Get default file exclusion patterns
 * Filters out test files, Storybook stories, config files, etc.
 * @returns Array of exclusion patterns
 */
export function getFileExcludePatterns(): string[] {
  return [...DEFAULT_COVERAGE_EXCLUDE];
}

/**
 * Check if a file path should be excluded based on exclusion patterns
 * @param filePath - The file path to check
 * @param excludePatterns - Optional custom exclusion patterns (defaults to DEFAULT_FILE_EXCLUDE_PATTERNS)
 * @returns true if file should be excluded, false otherwise
 */
export function shouldExcludeFile(filePath: string, excludePatterns?: string[]): boolean {
  const patterns = excludePatterns || (DEFAULT_COVERAGE_EXCLUDE as readonly string[] as string[]);

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

  return ['unit'];
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
  };

  return patterns[scope] || [];
}
