
// File exclusion patterns for component/source file selection
export const DEFAULT_FILE_EXCLUDE_PATTERNS = [
  // Test files
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/*.e2e.{ts,tsx,js,jsx}',
  '**/__tests__/**',
  '**/__mocks__/**',

  // Storybook
  '**/*.stories.{ts,tsx,js,jsx}',
  '**/*.story.{ts,tsx,js,jsx}',
  '**/.storybook/**',

  // Build/Output directories
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/out/**',

  // Config/Setup files
  '**/*.config.{ts,js}',
  '**/*.setup.{ts,js}',

  // Type definitions
  '**/*.d.ts',

  // Node modules
  '**/node_modules/**',
] as const;
