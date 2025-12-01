
export const COMMON_EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.husky',
  '.vscode',
  '.idea',
  'out',
  'tmp',
  'temp',
] as const;

export const COMPONENT_EXTENSIONS = [
  '.tsx',
  '.jsx',
  '.ts',
  '.js',
  '.vue',
  '.svelte',
] as const;

export const TEST_FILE_PATTERNS = [
  '.test.ts',
  '.test.tsx',
  '.test.js',
  '.test.jsx',
  '.spec.ts',
  '.spec.tsx',
  '.spec.js',
  '.spec.jsx',
] as const;

export const CONFIG_FILE_PATTERNS = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'next.config.js',
  'tailwind.config.js',
  'eslint.config.js',
] as const;
