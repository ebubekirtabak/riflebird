
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

// Riflebird directory structure in user's project
export const RIFLEBIRD_DIR = '.riflebird' as const;
export const RIFLEBIRD_PROMPTS_DIR = 'prompts' as const;
export const RIFLEBIRD_TEMPLATES_DIR = 'templates' as const;
export const RIFLEBIRD_CONFIG_DIR = 'config' as const;

export const languageMap: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'py': 'python',
  'rb': 'ruby',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'c',
  'cs': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'php': 'php',
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'zsh',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'sass',
  'md': 'markdown',
  'sql': 'sql',
};
