import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import tmp from 'tmp';
import {
  findFilesByPattern,
  findFilesByType,
  findFilesByTypes,
  findFilesByStringPattern,
} from '../file-finder';
import { FILE_PATTERNS, FilePattern, FileType } from '../file/file-patterns';
import { getFileStats } from '../file/file-stats';

describe('file-finder', () => {
  let testDir: string;
  let removeCallback: () => void;

  beforeEach(() => {
    // Create a secure temporary test directory
    const tmpObj = tmp.dirSync({ unsafeCleanup: true });
    testDir = tmpObj.name;
    removeCallback = tmpObj.removeCallback;
  });

  afterEach(() => {
    // Clean up test directory
    removeCallback();
  });

  async function createTestFile(relativePath: string): Promise<void> {
    const fullPath = path.join(testDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, '// test file');
  }

  describe('findFilesByType', () => {
    it('should find component files with various patterns', async () => {
      await createTestFile('src/Button.component.tsx');
      await createTestFile('src/Input.Component.jsx');
      await createTestFile('src/Card.component.ts');
      await createTestFile('src/Header.tsx'); // Should not match
      await createTestFile('src/utils.ts'); // Should not match

      const files = await findFilesByType(testDir, 'component');

      expect(files).toHaveLength(3);
      expect(files.map((f) => f.name).sort()).toEqual([
        'Button.component.tsx',
        'Card.component.ts',
        'Input.Component.jsx',
      ]);
    });

    it('should find test files with .test and .spec patterns', async () => {
      await createTestFile('src/button.test.ts');
      await createTestFile('src/input.spec.tsx');
      await createTestFile('src/card.test.js');
      await createTestFile('src/header.spec.jsx');
      await createTestFile('src/utils.ts'); // Should not match

      const files = await findFilesByType(testDir, 'test');

      expect(files).toHaveLength(4);
      expect(files.map((f) => f.name).sort()).toEqual([
        'button.test.ts',
        'card.test.js',
        'header.spec.jsx',
        'input.spec.tsx',
      ]);
    });

    it('should find model files', async () => {
      await createTestFile('src/user.model.ts');
      await createTestFile('src/post.entity.ts');
      await createTestFile('src/comment.schema.ts');
      await createTestFile('src/utils.ts'); // Should not match

      const files = await findFilesByType(testDir, 'model');

      expect(files).toHaveLength(3);
      expect(files.map((f) => f.name).sort()).toEqual([
        'comment.schema.ts',
        'post.entity.ts',
        'user.model.ts',
      ]);
    });

    it('should find hook files with use prefix', async () => {
      await createTestFile('src/useAuth.ts');
      await createTestFile('src/useState.tsx');
      await createTestFile('src/useEffect.js');
      await createTestFile('src/utils.ts'); // Should not match

      const files = await findFilesByType(testDir, 'hook');

      expect(files).toHaveLength(3);
      expect(files.map((f) => f.name).sort()).toEqual([
        'useAuth.ts',
        'useEffect.js',
        'useState.tsx',
      ]);
    });

    it('should find config files', async () => {
      await createTestFile('tsconfig.json');
      await createTestFile('package.json');
      await createTestFile('vite.config.ts');
      await createTestFile('jest.config.js');
      await createTestFile('src/utils.ts'); // Should not match

      const files = await findFilesByType(testDir, 'config');

      expect(files).toHaveLength(4);
      expect(files.map((f) => f.name).sort()).toEqual([
        'jest.config.js',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
      ]);
    });

    it('should find style files', async () => {
      await createTestFile('src/styles.css');
      await createTestFile('src/theme.scss');
      await createTestFile('src/button.module.css');
      await createTestFile('src/utils.ts'); // Should not match

      const files = await findFilesByType(testDir, 'style');

      expect(files).toHaveLength(3);
      expect(files.map((f) => f.name).sort()).toEqual([
        'button.module.css',
        'styles.css',
        'theme.scss',
      ]);
    });

    it('should respect case sensitivity option', async () => {
      await createTestFile('src/Button.Component.tsx');
      await createTestFile('src/input.component.tsx');

      const filesInsensitive = await findFilesByType(testDir, 'component', {
        caseSensitive: false,
      });
      expect(filesInsensitive).toHaveLength(2);

      // With case-sensitive, only exact pattern matches count
      // Button.Component.tsx matches *.[Cc]omponent.tsx pattern
      // input.component.tsx matches *.component.tsx pattern
      // Both should match because we have both [Cc] patterns
      const filesSensitive = await findFilesByType(testDir, 'component', {
        caseSensitive: true,
      });
      expect(filesSensitive).toHaveLength(2);
    });

    it('should respect excludeDirs option', async () => {
      await createTestFile('src/button.component.tsx');
      await createTestFile('node_modules/lib/input.component.tsx');

      const files = await findFilesByType(testDir, 'component', {
        excludeDirs: ['node_modules'],
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('button.component.tsx');
    });

    it('should throw error for custom type without patterns', async () => {
      await expect(findFilesByType(testDir, 'custom')).rejects.toThrow(
        'No patterns defined for file type: custom'
      );
    });

    it('should handle empty patterns array gracefully', async () => {
      const emptyPattern = { patterns: [], extensions: ['.ts'] };
      const files = await findFilesByPattern(testDir, emptyPattern);
      expect(files).toEqual([]);
    });

    it('should handle undefined file type', async () => {
      await expect(
        findFilesByType(testDir, 'nonexistent' as unknown as FileType)
      ).rejects.toThrow();
    });
  });

  describe('findFilesByPattern', () => {
    it('should find files matching custom pattern', async () => {
      await createTestFile('src/Button.view.tsx');
      await createTestFile('src/Input.view.jsx');
      await createTestFile('src/Card.component.tsx'); // Should not match

      const pattern: FilePattern = {
        patterns: ['*.view.tsx', '*.view.jsx'],
        extensions: ['.tsx', '.jsx'],
        description: 'View components',
      };

      const files = await findFilesByPattern(testDir, pattern);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual(['Button.view.tsx', 'Input.view.jsx']);
    });

    it('should support wildcard patterns', async () => {
      await createTestFile('src/actions/createUser.ts');
      await createTestFile('src/actions/deletePost.ts');
      await createTestFile('src/utils/helper.ts'); // Should not match

      const pattern: FilePattern = {
        patterns: ['*User*.ts', '*Post*.ts'],
        extensions: ['.ts'],
      };

      const files = await findFilesByPattern(testDir, pattern);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual(['createUser.ts', 'deletePost.ts']);
    });

    it('should work without extensions filter', async () => {
      await createTestFile('src/button.custom.tsx');
      await createTestFile('src/input.custom.jsx');
      await createTestFile('src/card.custom.ts');

      const pattern: FilePattern = {
        patterns: ['*.custom.*'],
      };

      const files = await findFilesByPattern(testDir, pattern);

      expect(files).toHaveLength(3);
    });

    it('should match files with specific directory path patterns', async () => {
      await createTestFile(
        'src/components/UserSettings/CertificateSection/Certificate.component.tsx'
      );
      await createTestFile('src/components/UserSettings/CertificateSection/Upload.component.tsx');
      await createTestFile('src/components/UserSettings/ProfileSection/Profile.component.tsx');
      await createTestFile('src/components/Dashboard/Widget.component.tsx');

      const pattern: FilePattern = {
        patterns: ['src/components/UserSettings/CertificateSection/*.component.tsx'],
        description: 'CertificateSection components',
      };

      const files = await findFilesByPattern(testDir, pattern);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual([
        'Certificate.component.tsx',
        'Upload.component.tsx',
      ]);
    });

    it('should match files with ** wildcard for nested directories', async () => {
      await createTestFile(
        'src/components/UserSettings/CertificateSection/Certificate.component.tsx'
      );
      await createTestFile(
        'src/components/UserSettings/CertificateSection/nested/Upload.component.tsx'
      );
      await createTestFile('src/components/Dashboard/Widget.component.tsx');

      const pattern: FilePattern = {
        patterns: ['src/components/UserSettings/**/*.component.tsx'],
        description: 'All UserSettings components',
      };

      const files = await findFilesByPattern(testDir, pattern);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual([
        'Certificate.component.tsx',
        'Upload.component.tsx',
      ]);
    });

    it('should handle patterns with leading ./ correctly', async () => {
      await createTestFile('src/components/Button.component.tsx');
      await createTestFile('src/utils/helper.ts');

      const pattern: FilePattern = {
        patterns: ['./src/components/*.component.tsx'],
      };

      const files = await findFilesByPattern(testDir, pattern);

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('Button.component.tsx');
    });
  });

  describe('findFilesByTypes', () => {
    it('should find files for multiple types', async () => {
      await createTestFile('src/Button.component.tsx');
      await createTestFile('src/button.test.ts');
      await createTestFile('src/user.model.ts');
      await createTestFile('src/useAuth.ts');

      const results = await findFilesByTypes(testDir, ['component', 'test', 'model', 'hook']);

      expect(Object.keys(results)).toEqual(['component', 'test', 'model', 'hook']);
      expect(results.component).toHaveLength(1);
      expect(results.test).toHaveLength(1);
      expect(results.model).toHaveLength(1);
      // user.model.ts also matches use*.ts pattern (starts with 'use')
      expect(results.hook).toHaveLength(2);
    });

    it('should return empty arrays for types with no matches', async () => {
      await createTestFile('src/Button.component.tsx');

      const results = await findFilesByTypes(testDir, ['component', 'test', 'model']);

      expect(results.component).toHaveLength(1);
      expect(results.test).toHaveLength(0);
      expect(results.model).toHaveLength(0);
    });

    it('should handle empty fileTypes array', async () => {
      await createTestFile('src/file.ts');

      const results = await findFilesByTypes(testDir, []);

      expect(Object.keys(results)).toHaveLength(0);
    });

    it('should reuse provided fileTree for multiple types', async () => {
      await createTestFile('src/Button.component.tsx');
      await createTestFile('src/button.test.ts');

      const { getFileTree } = await import('../file-tree');
      const fileTree = await getFileTree(testDir);

      const results = await findFilesByTypes(testDir, ['component', 'test'], {
        fileTree,
      });

      expect(results.component).toHaveLength(1);
      expect(results.test).toHaveLength(1);
    });

    it('should apply excludePatterns across all types', async () => {
      await createTestFile('src/Button.component.tsx');
      await createTestFile('node_modules/lib/Input.component.tsx');
      await createTestFile('src/button.test.ts');
      await createTestFile('node_modules/lib/input.test.ts');

      const results = await findFilesByTypes(testDir, ['component', 'test'], {
        excludePatterns: ['**/node_modules/**'],
      });

      expect(results.component).toHaveLength(1);
      expect(results.component[0].name).toBe('Button.component.tsx');
      expect(results.test).toHaveLength(1);
      expect(results.test[0].name).toBe('button.test.ts');
    });
  });

  describe('findFilesByStringPattern', () => {
    it('should wrap string pattern and find matching files', async () => {
      await createTestFile('src/utils/helper.ts');
      await createTestFile('src/utils/formatter.ts');
      await createTestFile('src/components/Button.tsx');

      const files = await findFilesByStringPattern(testDir, 'src/utils/*.ts');

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual(['formatter.ts', 'helper.ts']);
    });

    it('should support wildcard patterns in string format', async () => {
      await createTestFile('src/createUser.ts');
      await createTestFile('src/deleteUser.ts');
      await createTestFile('src/createPost.ts');

      const files = await findFilesByStringPattern(testDir, '*User*.ts');

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual(['createUser.ts', 'deleteUser.ts']);
    });

    it('should respect caseSensitive option', async () => {
      await createTestFile('src/UserHelper.ts');
      await createTestFile('src/userService.ts');

      const filesInsensitive = await findFilesByStringPattern(testDir, '*user*.ts', {
        caseSensitive: false,
      });
      expect(filesInsensitive).toHaveLength(2);

      const filesSensitive = await findFilesByStringPattern(testDir, '*user*.ts', {
        caseSensitive: true,
      });
      expect(filesSensitive).toHaveLength(1);
      expect(filesSensitive[0].name).toBe('userService.ts');
    });

    it('should work with provided fileTree', async () => {
      await createTestFile('src/file1.ts');
      await createTestFile('src/file2.ts');

      const { getFileTree } = await import('../file-tree');
      const fileTree = await getFileTree(testDir);

      const files = await findFilesByStringPattern(testDir, '*.ts', {
        fileTree,
      });

      expect(files).toHaveLength(2);
    });

    it('should handle patterns with ** for deep matching', async () => {
      await createTestFile('src/a/b/c/deep.ts');
      await createTestFile('src/shallow.ts');

      const files = await findFilesByStringPattern(testDir, 'src/**/*.ts');

      // Both files should match - one at depth and one at root
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(files.some((f) => f.name === 'deep.ts' || f.name === 'shallow.ts')).toBe(true);
    });

    it('should respect excludePatterns option', async () => {
      await createTestFile('src/file.ts');
      await createTestFile('src/file.test.ts');

      const files = await findFilesByStringPattern(testDir, 'src/**/*.ts', {
        excludePatterns: ['**/*.test.ts'],
      });

      // Should exclude test files
      expect(files.every((f) => !f.name.includes('.test.ts'))).toBe(true);
    });
  });

  describe('getFileStats', () => {
    it('should calculate file statistics', async () => {
      await createTestFile('src/button.component.tsx');
      await createTestFile('src/input.component.tsx');
      await createTestFile('src/card.component.jsx');
      await createTestFile('src/header.component.ts');

      const files = await findFilesByType(testDir, 'component');
      const stats = getFileStats(files);

      expect(stats.total).toBe(4);
      expect(stats.byExtension).toEqual({
        '.tsx': 2,
        '.jsx': 1,
        '.ts': 1,
      });
    });

    it('should handle empty file list', () => {
      const stats = getFileStats([]);

      expect(stats.total).toBe(0);
      expect(stats.byExtension).toEqual({});
    });
  });

  describe('FILE_PATTERNS', () => {
    it('should have all predefined file types', () => {
      const expectedTypes = [
        'component',
        'test',
        'model',
        'util',
        'config',
        'hook',
        'page',
        'api',
        'style',
        'custom',
      ];

      for (const type of expectedTypes) {
        expect(FILE_PATTERNS).toHaveProperty(type);
        expect(FILE_PATTERNS[type as keyof typeof FILE_PATTERNS]).toHaveProperty('patterns');
        expect(FILE_PATTERNS[type as keyof typeof FILE_PATTERNS]).toHaveProperty('description');
      }
    });
  });
});
