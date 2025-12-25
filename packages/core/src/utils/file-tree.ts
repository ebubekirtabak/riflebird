import fs from 'fs/promises';
import path from 'path';
import { COMMON_EXCLUDE_DIRS } from './constants';
import { FileNode, FileTreeOptions } from '@models/file-tree';

export async function getFileTree(
  rootPath: string,
  options: FileTreeOptions = {}
): Promise<FileNode[]> {
  const { includeExtensions, excludeDirs = [...COMMON_EXCLUDE_DIRS], maxDepth = 10 } = options;

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
 * Find files in a file tree that match one or more glob patterns
 * Efficiently handles both single and multiple patterns with a single tree traversal
 *
 * @param fileTree - Array of FileNode to search
 * @param patterns - Single glob pattern or array of glob patterns (supports *, **, ?, [abc], {a,b})
 * @returns Array of matching FileNode objects (deduplicated when multiple patterns match the same file)
 *
 * @example
 * ```ts
 * // Find all TypeScript files
 * findFilesByPatternInFileTree(tree, '**\/*.ts')
 *
 * // Find test files in src directory
 * findFilesByPatternInFileTree(tree, 'src/**\/*.test.ts')
 *
 * // Find all TypeScript and JavaScript files in one pass
 * findFilesByPatternInFileTree(tree, ['**\/*.ts', '**\/*.js'])
 *
 * // Find source files across multiple directories
 * findFilesByPatternInFileTree(tree, ['src/**\/*.{ts,tsx}', 'lib/**\/*.{ts,tsx}'])
 * ```
 */
export function findFilesByPatternInFileTree(
  fileTree: FileNode[],
  patterns: string | string[]
): FileNode[] {
  // Normalize to array
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  const matchedFilesMap = new Map<string, FileNode>();

  // Convert all patterns to regex once
  const regexPatterns = patternArray.map((pattern) => globToRegex(pattern));

  function searchTree(nodes: FileNode[]): void {
    for (const node of nodes) {
      if (node.type === 'file') {
        // Test against all patterns
        for (const regexPattern of regexPatterns) {
          if (regexPattern.test(node.path)) {
            matchedFilesMap.set(node.path, node);
            break;
          }
        }
      }

      if (node.children && node.children.length > 0) {
        searchTree(node.children);
      }
    }
  }

  searchTree(fileTree);
  return Array.from(matchedFilesMap.values());
}

/**
 * Convert glob pattern to regex
 * Supports: *, **, ?, [abc], {a,b}
 * More robust version that handles `**/ ` and `; /**` patterns correctly
 */
export function globToRegex(pattern: string): RegExp {
  let regex = pattern;

  // Handle brace expansion {a,b} -> (a|b) FIRST before escaping braces
  // Uses [^{}] to avoid matching nested braces which causes ReDoS
  regex = regex.replace(/\{([^{}]+)\}/g, (_match: string, contents: string) => {
    const options = contents.split(',').map((s: string) => s.trim());
    return `@@BRACE_START@@${options.join('@@BRACE_OR@@')}@@BRACE_END@@`;
  });

  // Now escape special regex characters except glob wildcards
  regex = regex
    .replace(/\\/g, '\\\\') // Escape backslash first
    .replace(/\|/g, '\\|') // Escape pipe
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\+/g, '\\+') // Escape plus
    .replace(/\^/g, '\\^') // Escape caret
    .replace(/\$/g, '\\$') // Escape dollar
    .replace(/\(/g, '\\(') // Escape parentheses
    .replace(/\)/g, '\\)') // Escape parentheses
    .replace(/\[/g, '\\[') // Escape brackets
    .replace(/\]/g, '\\]') // Escape brackets
    .replace(/\{/g, '\\{') // Escape braces
    .replace(/\}/g, '\\}'); // Escape braces

  // Restore brace expansion as regex groups
  regex = regex.replace(/@@BRACE_START@@/g, '(');
  regex = regex.replace(/@@BRACE_OR@@/g, '|');
  regex = regex.replace(/@@BRACE_END@@/g, ')');

  // Handle ** (match any directory depth including zero)
  // Replace **/ with (.*/)? to match zero or more directories
  // Replace /** with (/.*) to match slash and any content after
  regex = regex.replace(/\*\*\//g, '@@DOUBLESTAR_SLASH@@');
  regex = regex.replace(/\/\*\*/g, '@@SLASH_DOUBLESTAR@@');
  regex = regex.replace(/\*\*/g, '@@DOUBLESTAR@@');

  // Handle ? (match single character except /) BEFORE we add regex quantifiers
  regex = regex.replace(/\?/g, '[^/]');

  // Handle * (match anything except /)
  regex = regex.replace(/\*/g, '[^/]*');

  // Restore ** patterns
  regex = regex.replace(/@@DOUBLESTAR_SLASH@@/g, '(.*/)?'); // **/ matches zero or more dirs
  regex = regex.replace(/@@SLASH_DOUBLESTAR@@/g, '/.*'); // /** matches slash and everything after
  regex = regex.replace(/@@DOUBLESTAR@@/g, '.*'); // ** alone matches everything

  // Anchor the pattern
  regex = `^${regex}$`;

  return new RegExp(regex);
}
