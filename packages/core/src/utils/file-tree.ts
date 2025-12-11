import fs from 'fs/promises';
import path from 'path';
import { COMMON_EXCLUDE_DIRS } from './constants';
import { FileNode, FileTreeOptions } from '@models/file-tree';

export async function getFileTree(
  rootPath: string,
  options: FileTreeOptions = {}
): Promise<FileNode[]> {
  const {
    includeExtensions,
    excludeDirs = [...COMMON_EXCLUDE_DIRS],
    maxDepth = 10,
  } = options;

  return await buildFileTree(rootPath, '', excludeDirs, includeExtensions, 0, maxDepth);
}

async function buildFileTree(
  rootPath: string,
  relativePath: string,
  excludeDirs: string[],
  includeExtensions: string[] | undefined,
  depth: number,
  maxDepth: number
): Promise<FileNode[]> {
  if (depth > maxDepth) {
    return [];
  }

  const currentPath = path.join(rootPath, relativePath);
  const nodes: FileNode[] = [];

  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(entry.name)) {
          continue;
        }

        const children = await buildFileTree(
          rootPath,
          entryRelativePath,
          excludeDirs,
          includeExtensions,
          depth + 1,
          maxDepth
        );

        nodes.push({
          name: entry.name,
          path: entryRelativePath,
          type: 'directory',
          children,
        });
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);

        // Filter by extensions if specified
        if (includeExtensions && !includeExtensions.includes(ext)) {
          continue;
        }

        nodes.push({
          name: entry.name,
          path: entryRelativePath,
          type: 'file',
          extension: ext,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read directory ${currentPath}: ${message}`);
  }

  return nodes;
}

export function flattenFileTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];

  for (const node of nodes) {
    if (node.type === 'file') {
      result.push(node);
    }

    if (node.children && node.children.length > 0) {
      result.push(...flattenFileTree(node.children));
    }
  }

  return result;
}

export function formatFileTree(nodes: FileNode[], indent = ''): string {
  let output = '';

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const newIndent = indent + (isLast ? '    ' : '│   ');

    output += `${indent}${prefix}${node.name}`;
    if (node.type === 'file' && node.extension) {
      output += ` (${node.extension})`;
    }
    output += '\n';

    if (node.children && node.children.length > 0) {
      output += formatFileTree(node.children, newIndent);
    }
  }

  return output;
}

/**
 * Find files in a file tree that match a glob pattern
 * @param fileTree - Array of FileNode to search
 * @param pattern - Glob pattern (supports *, **, ?, [abc], {a,b})
 * @returns Array of matching FileNode objects
 *
 * @example
 * ```ts
 * // Find all TypeScript files
 * findFilesByPattern(tree, '**\/*.ts')
 *
 * // Find test files in src directory
 * findFilesByPattern(tree, 'src/**\/*.test.ts')
 *
 * // Find components
 * findFilesByPattern(tree, 'src/components/**\/*.{tsx,jsx}')
 * ```
 */
export function findFilesByPatternByFileTree(fileTree: FileNode[], pattern: string): FileNode[] {
  const matches: FileNode[] = [];

  // Convert glob pattern to regex
  const regexPattern = globToRegex(pattern);

  function searchTree(nodes: FileNode[]): void {
    for (const node of nodes) {
      if (node.type === 'file') {
        // Test against the full path
        if (regexPattern.test(node.path)) {
          matches.push(node);
        }
      }

      // Recursively search children
      if (node.children && node.children.length > 0) {
        searchTree(node.children);
      }
    }
  }

  searchTree(fileTree);
  return matches;
}

/**
 * Convert glob pattern to regex
 * Supports: *, **, ?, [abc], {a,b}
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except glob wildcards
  let regex = pattern
    .replace(/\./g, '\\.')  // Escape dots
    .replace(/\+/g, '\\+')  // Escape plus
    .replace(/\^/g, '\\^')  // Escape caret
    .replace(/\$/g, '\\$')  // Escape dollar
    .replace(/\(/g, '\\(')  // Escape parentheses
    .replace(/\)/g, '\\)'); // Escape parentheses

  // Handle brace expansion {a,b} -> (a|b)
  regex = regex.replace(/\{([^}]+)\}/g, (_, contents) => {
    const options = contents.split(',').map((s: string) => s.trim());
    return `(${options.join('|')})`;
  });

  // Handle character classes [abc]
  // Already valid in regex, no change needed

  // Handle ** (match any directory depth)
  regex = regex.replace(/\*\*/g, '@@DOUBLESTAR@@');

  // Handle * (match anything except /)
  regex = regex.replace(/\*/g, '[^/]*');

  // Restore ** to match any depth
  regex = regex.replace(/@@DOUBLESTAR@@/g, '.*');

  // Handle ? (match single character except /)
  regex = regex.replace(/\?/g, '[^/]');

  // Anchor the pattern
  regex = `^${regex}$`;

  return new RegExp(regex);
}
