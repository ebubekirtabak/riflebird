import { describe, it, expect } from 'vitest';
import {
  generateTestFilePath,
  generateFilePathWithConfig,
  detectOutputStrategy,
  isTestFile,
  getSourceFilePath,
  getRelatedExtensions,
  generateStoryFilePath,
} from '../file-util';

describe('file-util', () => {
  describe('detectOutputStrategy', () => {
    it('should detect colocated for paths starting with ./', () => {
      expect(detectOutputStrategy('./__tests__')).toBe('colocated');
      expect(detectOutputStrategy('./__test__')).toBe('colocated');
      expect(detectOutputStrategy('./tests')).toBe('colocated');
    });

    it('should detect colocated for common test directory names without slashes', () => {
      expect(detectOutputStrategy('__tests__')).toBe('colocated');
      expect(detectOutputStrategy('__test__')).toBe('colocated');
      expect(detectOutputStrategy('tests')).toBe('colocated');
      expect(detectOutputStrategy('test')).toBe('colocated');
      expect(detectOutputStrategy('__specs__')).toBe('colocated');
      expect(detectOutputStrategy('__spec__')).toBe('colocated');
      expect(detectOutputStrategy('specs')).toBe('colocated');
      expect(detectOutputStrategy('spec')).toBe('colocated');
    });

    it('should detect root for paths with slashes', () => {
      expect(detectOutputStrategy('tests/unit')).toBe('root');
      expect(detectOutputStrategy('spec/unit')).toBe('root');
      expect(detectOutputStrategy('test/integration')).toBe('root');
      expect(detectOutputStrategy('__tests__/unit')).toBe('root');
    });

    it('should detect root for non-standard directory names', () => {
      expect(detectOutputStrategy('my-tests')).toBe('root');
      expect(detectOutputStrategy('unit')).toBe('root');
      expect(detectOutputStrategy('integration')).toBe('root');
    });
  });

  describe('generateTestFilePath', () => {
    it('should generate test file path for .tsx file', () => {
      expect(generateTestFilePath('src/component.tsx')).toBe('src/component.test.tsx');
    });

    it('should generate test file path for .ts file', () => {
      expect(generateTestFilePath('file.ts')).toBe('file.test.ts');
    });

    it('should generate test file path for .js file', () => {
      expect(generateTestFilePath('utils/helper.js')).toBe('utils/helper.test.js');
    });

    it('should generate test file path for .jsx file', () => {
      expect(generateTestFilePath('components/Button.jsx')).toBe('components/Button.test.jsx');
    });

    it('should append .test when no extension found', () => {
      expect(generateTestFilePath('script')).toBe('script.test');
    });

    it('should handle deeply nested paths', () => {
      expect(
        generateTestFilePath(
          'src/components/UserSettings/CertificateSection/CertificateModal.component.tsx'
        )
      ).toBe('src/components/UserSettings/CertificateSection/CertificateModal.component.test.tsx');
    });
  });

  describe('generateFilePathWithConfig (tests)', () => {
    it('should generate co-located test file when no outputDir specified', () => {
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          suffix: '.test',
        })
      ).toBe('src/component.test.tsx');
    });

    it('should auto-detect root strategy for tests/unit path', () => {
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          outputDir: 'tests/unit',
          suffix: '.test',
        })
      ).toBe('tests/unit/src/component.test.tsx');
    });

    it('should auto-detect colocated strategy for __tests__ path', () => {
      expect(
        generateFilePathWithConfig('src/components/form/component.tsx', {
          outputDir: '__tests__',
          suffix: '.test',
        })
      ).toBe('src/components/form/__tests__/component.test.tsx');
    });

    it('should auto-detect colocated strategy for paths starting with ./', () => {
      expect(
        generateFilePathWithConfig('src/utils/helper.ts', {
          outputDir: './__tests__',
          suffix: '.test',
        })
      ).toBe('src/utils/__tests__/helper.test.ts');
    });

    it('should respect explicit strategy when provided (override auto-detection)', () => {
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          outputDir: 'tests/unit',
          strategy: 'colocated', // Override auto-detected 'root'
          suffix: '.test',
        })
      ).toBe('src/tests/unit/component.test.tsx');
    });

    it('should use root strategy by default when outputDir is provided (deprecated test)', () => {
      // This now auto-detects to 'root' for 'tests/unit'
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          outputDir: 'tests/unit',
          strategy: 'root',
          suffix: '.test',
        })
      ).toBe('tests/unit/src/component.test.tsx');
    });

    it('should generate test file in colocated subdirectory with explicit strategy', () => {
      expect(
        generateFilePathWithConfig('src/components/form/component.tsx', {
          outputDir: '__tests__',
          strategy: 'colocated',
          suffix: '.test',
        })
      ).toBe('src/components/form/__tests__/component.test.tsx');
    });

    it('should handle root-level files with colocated strategy', () => {
      expect(
        generateFilePathWithConfig('component.tsx', {
          outputDir: '__tests__',
          suffix: '.test',
        })
      ).toBe('__tests__/component.test.tsx');
    });

    it('should handle outputDir with leading ./ in colocated strategy', () => {
      expect(
        generateFilePathWithConfig('src/utils/helper.ts', {
          outputDir: './__tests__',
          suffix: '.test',
        })
      ).toBe('src/utils/__tests__/helper.test.ts');
    });

    it('should handle absolute paths with projectRoot (root strategy)', () => {
      expect(
        generateFilePathWithConfig('/project/src/component.tsx', {
          outputDir: 'tests/unit',
          projectRoot: '/project',
          strategy: 'root',
          suffix: '.test',
        })
      ).toBe('tests/unit/src/component.test.tsx');
    });

    it('should handle absolute paths with colocated strategy (projectRoot ignored)', () => {
      expect(
        generateFilePathWithConfig('/project/src/component.tsx', {
          outputDir: '__tests__',
          projectRoot: '/project',
          suffix: '.test',
        })
      ).toBe('/project/src/__tests__/component.test.tsx');
    });

    it('should preserve deep directory structure (root strategy)', () => {
      expect(
        generateFilePathWithConfig('src/features/auth/components/LoginForm.tsx', {
          outputDir: 'tests/unit',
          strategy: 'root',
          suffix: '.test',
        })
      ).toBe('tests/unit/src/features/auth/components/LoginForm.test.tsx');
    });

    it('should preserve deep directory structure (colocated strategy)', () => {
      expect(
        generateFilePathWithConfig('src/features/auth/components/LoginForm.tsx', {
          outputDir: '__tests__',
          suffix: '.test',
        })
      ).toBe('src/features/auth/components/__tests__/LoginForm.test.tsx');
    });

    it('should work with relative paths when projectRoot not specified (root strategy)', () => {
      expect(
        generateFilePathWithConfig('components/Button.jsx', {
          outputDir: 'tests',
          strategy: 'root',
          suffix: '.test',
        })
      ).toBe('tests/components/Button.test.jsx');
    });
  });

  describe('isTestFile', () => {
    it('should return true for .test. pattern', () => {
      expect(isTestFile('component.test.tsx')).toBe(true);
      expect(isTestFile('utils.test.ts')).toBe(true);
    });

    it('should return true for .spec. pattern', () => {
      expect(isTestFile('component.spec.ts')).toBe(true);
      expect(isTestFile('service.spec.js')).toBe(true);
    });

    it('should return true for __tests__/ directory', () => {
      expect(isTestFile('__tests__/component.ts')).toBe(true);
      expect(isTestFile('src/__tests__/helper.js')).toBe(true);
    });

    it('should return true for __test__/ directory', () => {
      expect(isTestFile('__test__/component.spec.ts')).toBe(true);
      expect(isTestFile('src/__test__/utils.ts')).toBe(true);
    });

    it('should return true for tests/ directory', () => {
      expect(isTestFile('tests/component.ts')).toBe(true);
      expect(isTestFile('tests/e2e/login.spec.ts')).toBe(true);
    });

    it('should return false for regular source files', () => {
      expect(isTestFile('component.tsx')).toBe(false);
      expect(isTestFile('utils.ts')).toBe(false);
      expect(isTestFile('src/components/Button.jsx')).toBe(false);
    });

    it('should return false for files with test in name but not in pattern', () => {
      expect(isTestFile('testimony.ts')).toBe(false);
      expect(isTestFile('latest-data.ts')).toBe(false);
    });
  });

  describe('getSourceFilePath', () => {
    it('should remove .test. from file path', () => {
      expect(getSourceFilePath('component.test.tsx')).toBe('component.tsx');
      expect(getSourceFilePath('utils.test.ts')).toBe('utils.ts');
    });

    it('should remove .spec. from file path', () => {
      expect(getSourceFilePath('component.spec.ts')).toBe('component.ts');
      expect(getSourceFilePath('service.spec.js')).toBe('service.js');
    });

    it('should handle paths with directories', () => {
      expect(getSourceFilePath('src/components/Button.test.tsx')).toBe('src/components/Button.tsx');
    });

    it('should return same path if no test pattern found', () => {
      expect(getSourceFilePath('component.tsx')).toBe('component.tsx');
    });

    it('should only replace first occurrence of .test.', () => {
      expect(getSourceFilePath('test.test.ts')).toBe('test.ts');
    });
  });

  describe('getRelatedExtensions', () => {
    it('should return JS/TS family extensions for .ts', () => {
      const extensions = getRelatedExtensions('.ts');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.js');
      expect(extensions.length).toBeGreaterThan(1);
    });

    it('should return JS/TS family extensions for .js', () => {
      const extensions = getRelatedExtensions('.js');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.mjs');
    });

    it('should return Styles family extensions for .css', () => {
      const extensions = getRelatedExtensions('.css');
      expect(extensions).toContain('.css');
      expect(extensions).toContain('.scss');
      expect(extensions).toContain('.less');
      expect(extensions).toContain('.sass');
    });

    it('should return HTML family extensions for .html', () => {
      const extensions = getRelatedExtensions('.html');
      expect(extensions).toEqual(['.html', '.htm']);
    });

    it('should return JSON family extensions for .json', () => {
      const extensions = getRelatedExtensions('.json');
      expect(extensions).toContain('.json');
      expect(extensions).toContain('.json5');
      expect(extensions).toContain('.jsonc');
    });

    it('should return Markdown family extensions for .md', () => {
      const extensions = getRelatedExtensions('.md');
      expect(extensions).toEqual(['.md', '.markdown']);
    });

    it('should return input extension for unknown extension', () => {
      expect(getRelatedExtensions('.unknown')).toEqual(['.unknown']);
      expect(getRelatedExtensions('.txt')).toEqual(['.txt']);
    });

    it('should handle uppercase extensions', () => {
      const extensions = getRelatedExtensions('.TS');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.js');
    });
  });

  describe('generateStoryFilePath', () => {
    it('should generate story file path for .tsx file', () => {
      expect(generateStoryFilePath('src/component.tsx')).toBe('src/component.stories.tsx');
    });

    it('should generate story file path for .ts file', () => {
      expect(generateStoryFilePath('file.ts')).toBe('file.stories.ts');
    });

    it('should append .stories when no extension found', () => {
      expect(generateStoryFilePath('script')).toBe('script.stories');
    });
  });

  describe('generateFilePathWithConfig (stories)', () => {
    it('should generate story file path when no output dir specified', () => {
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          suffix: '.stories',
        })
      ).toBe('src/component.stories.tsx');
    });

    it('should generate colocated story file when output dir starts with ./', () => {
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          outputDir: './stories',
          suffix: '.stories',
        })
      ).toBe('src/stories/component.stories.tsx');
    });

    it('should generate root-relative story file when output dir is just a name', () => {
      expect(
        generateFilePathWithConfig('src/component.tsx', {
          outputDir: 'stories',
          suffix: '.stories',
        })
      ).toBe('stories/src/component.stories.tsx');
    });

    it('should generate root-relative story file when output dir is deeply nested', () => {
      expect(
        generateFilePathWithConfig('src/features/feature/component.tsx', {
          outputDir: 'documentation/stories',
          suffix: '.stories',
        })
      ).toBe('documentation/stories/src/features/feature/component.stories.tsx');
    });

    it('should handle absolute paths with projectRoot (root strategy)', () => {
      expect(
        generateFilePathWithConfig('/project/src/component.tsx', {
          outputDir: 'stories',
          projectRoot: '/project',
          suffix: '.stories',
        })
      ).toBe('stories/src/component.stories.tsx');
    });
  });
});
