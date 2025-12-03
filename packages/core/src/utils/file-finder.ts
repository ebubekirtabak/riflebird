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
};

/**
 * Check if a filename matches any of the given patterns
 */
function matchesPattern(
  filename: string,
  patterns: string[],
  caseSensitive = false
): boolean {
  const name = caseSensitive ? filename : filename.toLowerCase();

  return patterns.some((pattern) => {
    const pat = caseSensitive ? pattern : pattern.toLowerCase();

    // Convert glob pattern to regex
    const regexPattern = pat
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
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

  return flattenAndFilterFiles(tree, pattern.patterns, caseSensitive);
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
  caseSensitive: boolean
): FileNode[] {
  const result: FileNode[] = [];

  for (const node of nodes) {
    if (node.type === 'file' && matchesPattern(node.name, patterns, caseSensitive)) {
      result.push(node);
    }

    if (node.children && node.children.length > 0) {
      result.push(...flattenAndFilterFiles(node.children, patterns, caseSensitive));
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
