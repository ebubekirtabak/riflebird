import { FileNode, FileTreeOptions } from '@models/file-tree';
import { getFileTree } from './file-tree';

export type FilePattern = {
  /**
   * File naming patterns to match
   * Examples: ['*.component.tsx', '*.test.ts', '*.spec.ts']
   */
  patterns: string[];
  /**
   * File extensions to include
   * Examples: ['.tsx', '.ts', '.jsx', '.js']
   */
  extensions?: string[];
  /**
   * Description of the file type
   */
  description?: string;
};

export type FileType =
  | 'component'
  | 'test'
  | 'model'
  | 'util'
  | 'config'
  | 'hook'
  | 'page'
  | 'api'
  | 'style'
  | 'custom';

/**
 * Predefined file patterns for common file types
 */
export const FILE_PATTERNS: Record<FileType, FilePattern> = {
  component: {
    patterns: [
      '*.component.tsx',
      '*.component.ts',
      '*.component.jsx',
      '*.component.js',
      '*.[Cc]omponent.tsx',
      '*.[Cc]omponent.jsx',
    ],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    description: 'React/Vue/Angular components',
  },
  test: {
    patterns: [
      '*.test.ts',
      '*.test.tsx',
      '*.test.js',
      '*.test.jsx',
      '*.spec.ts',
      '*.spec.tsx',
      '*.spec.js',
      '*.spec.jsx',
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    description: 'Test files',
  },
  model: {
    patterns: ['*.model.ts', '*.model.js', '*.entity.ts', '*.schema.ts'],
    extensions: ['.ts', '.js'],
    description: 'Data models and entities',
  },
  util: {
    patterns: ['*.util.ts', '*.util.js', '*.helper.ts', '*.helper.js'],
    extensions: ['.ts', '.js'],
    description: 'Utility and helper functions',
  },
  config: {
    patterns: [
      '*.config.ts',
      '*.config.js',
      '*.config.mjs',
      '*.config.json',
      'tsconfig.json',
      'package.json',
    ],
    extensions: ['.ts', '.js', '.mjs', '.json'],
    description: 'Configuration files',
  },
  hook: {
    patterns: ['use*.ts', 'use*.tsx', 'use*.js', 'use*.jsx'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    description: 'React hooks',
  },
  page: {
    patterns: [
      '*.page.tsx',
      '*.page.ts',
      '*.page.jsx',
      '*.page.js',
      'page.tsx',
      'page.ts',
    ],
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    description: 'Page components',
  },
  api: {
    patterns: ['*.api.ts', '*.api.js', '*.service.ts', '*.service.js'],
    extensions: ['.ts', '.js'],
    description: 'API and service files',
  },
  style: {
    patterns: [
      '*.css',
      '*.scss',
      '*.sass',
      '*.less',
      '*.module.css',
      '*.module.scss',
    ],
    extensions: ['.css', '.scss', '.sass', '.less'],
    description: 'Style files',
  },
  custom: {
    patterns: [],
    extensions: [],
    description: 'Custom pattern',
  },
};

export type FindFilesByPatternOptions = FileTreeOptions & {
  /**
   * Case-sensitive pattern matching
   * @default false
   */
  caseSensitive?: boolean;
  /**
   * Include full file path in results
   * @default true
   */
  includeFullPath?: boolean;
  /**
   * Patterns to exclude
   * Examples: ['*.test.ts', 'dist/**']
   */
  excludePatterns?: string[];
};

/**
 * Check if a filename or path matches any of the given patterns
 * Supports both filename patterns (*.component.tsx) and path patterns (src/**\/*.tsx)
 */
export function matchesPattern(
  filename: string,
  filePath: string,
  patterns: string[],
  caseSensitive = false
): boolean {
  const name = caseSensitive ? filename : filename.toLowerCase();
  const path = caseSensitive ? filePath : filePath.toLowerCase();

  return patterns.some((pattern) => {
    const pat = caseSensitive ? pattern : pattern.toLowerCase();

    // Check if pattern contains path separators (/) or directory wildcards (**)
    const isPathPattern = pat.includes('/') || pat.includes('**');
    const targetString = isPathPattern ? path : name;

    // Convert glob pattern to regex
    let regexPattern = pat
      .replace(/\./g, '\\.')     // Escape dots
      .replace(/\*\*/g, '@@DOUBLESTAR@@')  // Temporarily replace **
      .replace(/\*/g, '[^/]*')   // * matches anything except /
      .replace(/@@DOUBLESTAR@@/g, '.*')   // ** matches any depth
      .replace(/\?/g, '[^/]')    // ? matches single char except /
      .replace(/\{([^}]+)\}/g, (_, group) => `(${group.replace(/,/g, '|')})`); // Handle {a,b} -> (a|b)

    // Remove leading ./ if present
    regexPattern = regexPattern.replace(/^\\.\//, '');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(targetString);
  });
}

/**
 * Find files by predefined file type
 */
export async function findFilesByType(
  rootPath: string,
  fileType: FileType,
  options: FindFilesByPatternOptions = {}
): Promise<FileNode[]> {
  const pattern = FILE_PATTERNS[fileType];

  if (!pattern || pattern.patterns.length === 0) {
    throw new Error(`No patterns defined for file type: ${fileType}`);
  }

  return await findFilesByPattern(rootPath, pattern, options);
}

/**
 * wrap string pattern to FilePattern and find files
 */
export async function findFilesByStringPattern(
  rootPath: string,
  pattern: string,
  options: FindFilesByPatternOptions = {}
): Promise<FileNode[]> {
  const filePattern: FilePattern = {
    patterns: [pattern],  // Array of string patterns
    description: 'User-provided pattern'
  };

  return await findFilesByPattern(rootPath, filePattern, options);
}

/**
 * Find files matching custom patterns
 */
export async function findFilesByPattern(
  rootPath: string,
  pattern: FilePattern,
  options: FindFilesByPatternOptions = {}
): Promise<FileNode[]> {
  const { caseSensitive = false, ...treeOptions } = options;

  // Merge extensions from pattern and options
  const extensions = pattern.extensions || treeOptions.includeExtensions;

  const tree = await getFileTree(rootPath, {
    ...treeOptions,
    includeExtensions: extensions,
  });

  return flattenAndFilterFiles(tree, pattern.patterns, caseSensitive, options.excludePatterns);
}

/**
 * Find files matching multiple file types
 */
export async function findFilesByTypes(
  rootPath: string,
  fileTypes: FileType[],
  options: FindFilesByPatternOptions = {}
): Promise<Record<FileType, FileNode[]>> {
  const results: Record<string, FileNode[]> = {};

  for (const fileType of fileTypes) {
    results[fileType] = await findFilesByType(rootPath, fileType, options);
  }

  return results as Record<FileType, FileNode[]>;
}

/**
 * Flatten file tree and filter by patterns
 */
function flattenAndFilterFiles(
  nodes: FileNode[],
  patterns: string[],
  caseSensitive: boolean,
  excludePatterns: string[] = []
): FileNode[] {
  const result: FileNode[] = [];

  for (const node of nodes) {
    const matches = matchesPattern(node.name, node.path, patterns, caseSensitive);
    const excluded = excludePatterns.length > 0 && matchesPattern(node.name, node.path, excludePatterns, caseSensitive);

    if (node.type === 'file' && matches && !excluded) {
      result.push(node);
    }

    if (node.children && node.children.length > 0) {
      result.push(...flattenAndFilterFiles(node.children, patterns, caseSensitive, excludePatterns));
    }
  }

  return result;
}

/**
 * Get statistics about found files
 */
export type FileStats = {
  total: number;
  byExtension: Record<string, number>;
  byType?: Record<FileType, number>;
};

export function getFileStats(files: FileNode[]): FileStats {
  const stats: FileStats = {
    total: files.length,
    byExtension: {},
  };

  for (const file of files) {
    if (file.extension) {
      stats.byExtension[file.extension] = (stats.byExtension[file.extension] || 0) + 1;
    }
  }

  return stats;
}
