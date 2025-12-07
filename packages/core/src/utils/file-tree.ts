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

export async function buildFlattenFileTree(
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
  const files: FileNode[] = [];

  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(entry.name)) {
          continue;
        }

        // Recursively collect files from subdirectories
        const childFiles = await buildFlattenFileTree(
          rootPath,
          entryRelativePath,
          excludeDirs,
          includeExtensions,
          depth + 1,
          maxDepth
        );

        files.push(...childFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);

        // Filter by extensions if specified
        if (includeExtensions && !includeExtensions.includes(ext)) {
          continue;
        }

        files.push({
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

  return files;
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
