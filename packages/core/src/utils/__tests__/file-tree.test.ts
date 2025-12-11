import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  getFileTree,
  flattenFileTree,
  formatFileTree,
  findFilesByPatternByFileTree,
} from '../file-tree';
import type { FileNode } from '@models/file-tree';

describe('file-tree utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'riflebird-test-'));

    // Create test file structure
    await fs.mkdir(path.join(tempDir, 'src'));
    await fs.mkdir(path.join(tempDir, 'src/components'));
    await fs.mkdir(path.join(tempDir, 'src/utils'));
    await fs.mkdir(path.join(tempDir, 'node_modules'));
    await fs.mkdir(path.join(tempDir, 'dist'));

    // Create test files
    await fs.writeFile(path.join(tempDir, 'src/index.ts'), '');
    await fs.writeFile(path.join(tempDir, 'src/components/Button.tsx'), '');
    await fs.writeFile(path.join(tempDir, 'src/components/Input.tsx'), '');
    await fs.writeFile(path.join(tempDir, 'src/utils/helpers.ts'), '');
    await fs.writeFile(path.join(tempDir, 'src/styles.css'), '');
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    await fs.writeFile(path.join(tempDir, 'node_modules/dep.js'), '');
    await fs.writeFile(path.join(tempDir, 'dist/output.js'), '');
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getFileTree', () => {
    it('should return complete file tree structure', async () => {
      const tree = await getFileTree(tempDir);

      expect(tree).toBeDefined();
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);

      // Find src directory
      const srcDir = tree.find((node) => node.name === 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir?.type).toBe('directory');
      expect(srcDir?.children).toBeDefined();
      expect(srcDir?.children?.length).toBeGreaterThan(0);
    });

    it('should exclude node_modules and dist by default', async () => {
      const tree = await getFileTree(tempDir);

      const nodeModules = tree.find((node) => node.name === 'node_modules');
      const dist = tree.find((node) => node.name === 'dist');

      expect(nodeModules).toBeUndefined();
      expect(dist).toBeUndefined();
    });

    it('should filter by file extensions when specified', async () => {
      const tree = await getFileTree(tempDir, {
        includeExtensions: ['.tsx'],
      });

      const flattenedFiles = flattenTree(tree);
      const allFiles = flattenedFiles.filter((node) => node.type === 'file');

      expect(allFiles.length).toBeGreaterThan(0);
      allFiles.forEach((file) => {
        expect(file.extension).toBe('.tsx');
      });
    });

    it('should respect custom exclude directories', async () => {
      const tree = await getFileTree(tempDir, {
        excludeDirs: ['src'],
      });

      const srcDir = tree.find((node) => node.name === 'src');
      expect(srcDir).toBeUndefined();
    });

    it('should respect maxDepth option', async () => {
      const tree = await getFileTree(tempDir, {
        maxDepth: 1,
      });

      // Should have top-level directories
      expect(tree.length).toBeGreaterThan(0);

      // But nested directories should not have deeply nested children
      const srcDir = tree.find((node) => node.name === 'src');
      if (srcDir?.children) {
        const componentsDir = srcDir.children.find(
          (node) => node.name === 'components'
        );
        // Components dir exists but shouldn't have deep nesting
        expect(componentsDir).toBeDefined();
      }
    });

    it('should handle empty directories', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.mkdir(emptyDir);

      const tree = await getFileTree(tempDir);
      const emptyNode = tree.find((node) => node.name === 'empty');

      expect(emptyNode).toBeDefined();
      expect(emptyNode?.type).toBe('directory');
      expect(emptyNode?.children).toEqual([]);
    });

    it('should throw error for non-existent directory', async () => {
      await expect(
        getFileTree('/non/existent/path')
      ).rejects.toThrow();
    });
  });

  describe('flattenFileTree', () => {
    it('should flatten nested file tree', async () => {
      const tree = await getFileTree(tempDir);
      const flattened = flattenFileTree(tree);

      expect(flattened.length).toBeGreaterThan(0);

      // Should contain only files
      flattened.forEach((node) => {
        expect(node.type).toBe('file');
      });
    });

    it('should preserve file information when flattening', async () => {
      const tree = await getFileTree(tempDir);
      const flattened = flattenFileTree(tree);

      const button = flattened.find((c) => c.name === 'Button.tsx');
      expect(button).toBeDefined();
      expect(button?.path).toContain('src');
      expect(button?.path).toContain('components');
      expect(button?.extension).toBe('.tsx');
    });
  });

  describe('formatFileTree', () => {
    it('should format tree as readable string', () => {
      const mockTree: FileNode[] = [
        {
          name: 'src',
          path: 'src',
          type: 'directory',
          children: [
            {
              name: 'index.ts',
              path: 'src/index.ts',
              type: 'file',
              extension: '.ts',
            },
          ],
        },
        {
          name: 'package.json',
          path: 'package.json',
          type: 'file',
          extension: '.json',
        },
      ];

      const formatted = formatFileTree(mockTree);

      expect(formatted).toContain('src');
      expect(formatted).toContain('index.ts');
      expect(formatted).toContain('package.json');
      expect(formatted).toContain('├──');
      expect(formatted).toContain('└──');
    });

    it('should show file extensions in output', () => {
      const mockTree: FileNode[] = [
        {
          name: 'test.ts',
          path: 'test.ts',
          type: 'file',
          extension: '.ts',
        },
      ];

      const formatted = formatFileTree(mockTree);
      expect(formatted).toContain('(.ts)');
    });

    it('should handle nested structure with proper indentation', () => {
      const mockTree: FileNode[] = [
        {
          name: 'parent',
          path: 'parent',
          type: 'directory',
          children: [
            {
              name: 'child',
              path: 'parent/child',
              type: 'directory',
              children: [
                {
                  name: 'file.ts',
                  path: 'parent/child/file.ts',
                  type: 'file',
                  extension: '.ts',
                },
              ],
            },
          ],
        },
      ];

      const formatted = formatFileTree(mockTree);

      // Check for proper tree structure characters
      expect(formatted).toContain('└──');
      expect(formatted).toContain('parent');
      expect(formatted).toContain('child');
      expect(formatted).toContain('file.ts');
    });

    it('should return empty string for empty tree', () => {
      const formatted = formatFileTree([]);
      expect(formatted).toBe('');
    });
  });

  describe('findFilesByPatternByFileTree', () => {
    const mockFileTree: FileNode[] = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          {
            name: 'components',
            path: 'src/components',
            type: 'directory',
            children: [
              {
                name: 'Button.tsx',
                path: 'src/components/Button.tsx',
                type: 'file',
                extension: '.tsx',
              },
              {
                name: 'Button.test.tsx',
                path: 'src/components/Button.test.tsx',
                type: 'file',
                extension: '.tsx',
              },
              {
                name: 'Input.jsx',
                path: 'src/components/Input.jsx',
                type: 'file',
                extension: '.jsx',
              },
            ],
          },
          {
            name: 'utils',
            path: 'src/utils',
            type: 'directory',
            children: [
              {
                name: 'helpers.ts',
                path: 'src/utils/helpers.ts',
                type: 'file',
                extension: '.ts',
              },
              {
                name: 'helpers.test.ts',
                path: 'src/utils/helpers.test.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
          {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file',
            extension: '.ts',
          },
          {
            name: 'styles.css',
            path: 'src/styles.css',
            type: 'file',
            extension: '.css',
          },
        ],
      },
      {
        name: 'package.json',
        path: 'package.json',
        type: 'file',
        extension: '.json',
      },
    ];

    it('should find all TypeScript files with *.ts pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '*.ts');

      expect(matches).toHaveLength(0); // No files at root level match
    });

    it('should find all TypeScript files with **/*.ts pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '**/*.ts');

      expect(matches).toHaveLength(3);
      expect(matches.map(f => f.name)).toContain('index.ts');
      expect(matches.map(f => f.name)).toContain('helpers.ts');
      expect(matches.map(f => f.name)).toContain('helpers.test.ts');
    });

    it('should find test files with **/*.test.ts pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '**/*.test.ts');

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('helpers.test.ts');
    });

    it('should find test files with **/*.test.{ts,tsx} pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '**/*.test.{ts,tsx}');

      expect(matches).toHaveLength(2);
      expect(matches.map(f => f.name)).toContain('helpers.test.ts');
      expect(matches.map(f => f.name)).toContain('Button.test.tsx');
    });

    it('should find React components with **/*.{tsx,jsx} pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '**/*.{tsx,jsx}');

      expect(matches).toHaveLength(3);
      expect(matches.map(f => f.name)).toContain('Button.tsx');
      expect(matches.map(f => f.name)).toContain('Button.test.tsx');
      expect(matches.map(f => f.name)).toContain('Input.jsx');
    });

    it('should find files in specific directory with src/components/* pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, 'src/components/*');

      expect(matches).toHaveLength(3);
      expect(matches.every(f => f.path.startsWith('src/components/'))).toBe(true);
    });

    it('should find files with ? wildcard matching single character', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, 'src/utils/helper?.ts');

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('helpers.ts');
    });

    it('should find specific file with exact path', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, 'src/index.ts');

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('index.ts');
      expect(matches[0].path).toBe('src/index.ts');
    });

    it('should find files with src/** pattern', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, 'src/**');

      expect(matches).toHaveLength(7); // All files under src
    });

    it('should return empty array when no matches found', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '**/*.py');

      expect(matches).toHaveLength(0);
    });

    it('should handle empty file tree', () => {
      const matches = findFilesByPatternByFileTree([], '**/*.ts');

      expect(matches).toHaveLength(0);
    });

    it('should match CSS files', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '**/*.css');

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('styles.css');
    });

    it('should match JSON files at root', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, '*.json');

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('package.json');
    });

    it('should handle patterns with multiple directory levels', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, 'src/*/Button.tsx');

      expect(matches).toHaveLength(1);
      expect(matches[0].path).toBe('src/components/Button.tsx');
    });

    it('should distinguish between files and only return files', () => {
      const matches = findFilesByPatternByFileTree(mockFileTree, 'src/**');

      // All matches should be files, not directories
      expect(matches.every(node => node.type === 'file')).toBe(true);
    });
  });
});

// Helper function to flatten tree for testing
function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];

  for (const node of nodes) {
    result.push(node);
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children));
    }
  }

  return result;
}
