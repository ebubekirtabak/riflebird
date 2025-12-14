import { describe, it, expect } from 'vitest';
import { generateTestFilePath, generateTestFilePathWithConfig, detectTestOutputStrategy, isTestFile, getSourceFilePath } from '../file-util';

describe('file-util', () => {
  describe('detectTestOutputStrategy', () => {
    it('should detect colocated for paths starting with ./', () => {
      expect(detectTestOutputStrategy('./__tests__')).toBe('colocated');
      expect(detectTestOutputStrategy('./__test__')).toBe('colocated');
      expect(detectTestOutputStrategy('./tests')).toBe('colocated');
    });

    it('should detect colocated for common test directory names without slashes', () => {
      expect(detectTestOutputStrategy('__tests__')).toBe('colocated');
      expect(detectTestOutputStrategy('__test__')).toBe('colocated');
      expect(detectTestOutputStrategy('tests')).toBe('colocated');
      expect(detectTestOutputStrategy('test')).toBe('colocated');
      expect(detectTestOutputStrategy('__specs__')).toBe('colocated');
      expect(detectTestOutputStrategy('__spec__')).toBe('colocated');
      expect(detectTestOutputStrategy('specs')).toBe('colocated');
      expect(detectTestOutputStrategy('spec')).toBe('colocated');
    });

    it('should detect root for paths with slashes', () => {
      expect(detectTestOutputStrategy('tests/unit')).toBe('root');
      expect(detectTestOutputStrategy('spec/unit')).toBe('root');
      expect(detectTestOutputStrategy('test/integration')).toBe('root');
      expect(detectTestOutputStrategy('__tests__/unit')).toBe('root');
    });

    it('should detect root for non-standard directory names', () => {
      expect(detectTestOutputStrategy('my-tests')).toBe('root');
      expect(detectTestOutputStrategy('unit')).toBe('root');
      expect(detectTestOutputStrategy('integration')).toBe('root');
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
      expect(generateTestFilePath('src/components/UserSettings/CertificateSection/CertificateModal.component.tsx'))
        .toBe('src/components/UserSettings/CertificateSection/CertificateModal.component.test.tsx');
    });
  });

  describe('generateTestFilePathWithConfig', () => {
    it('should generate co-located test file when no testOutputDir specified', () => {
      expect(generateTestFilePathWithConfig('src/component.tsx'))
        .toBe('src/component.test.tsx');
    });

    it('should auto-detect root strategy for tests/unit path', () => {
      expect(generateTestFilePathWithConfig('src/component.tsx', {
        testOutputDir: 'tests/unit'
      }))
        .toBe('tests/unit/src/component.test.tsx');
    });

    it('should auto-detect colocated strategy for __tests__ path', () => {
      expect(generateTestFilePathWithConfig('src/components/form/component.tsx', {
        testOutputDir: '__tests__'
      }))
        .toBe('src/components/form/__tests__/component.test.tsx');
    });

    it('should auto-detect colocated strategy for paths starting with ./', () => {
      expect(generateTestFilePathWithConfig('src/utils/helper.ts', {
        testOutputDir: './__tests__'
      }))
        .toBe('src/utils/__tests__/helper.test.ts');
    });

    it('should respect explicit strategy when provided (override auto-detection)', () => {
      expect(generateTestFilePathWithConfig('src/component.tsx', {
        testOutputDir: 'tests/unit',
        strategy: 'colocated' // Override auto-detected 'root'
      }))
        .toBe('src/tests/unit/component.test.tsx');
    });

    it('should use root strategy by default when testOutputDir is provided (deprecated test)', () => {
      // This now auto-detects to 'root' for 'tests/unit'
      expect(generateTestFilePathWithConfig('src/component.tsx', {
        testOutputDir: 'tests/unit',
        strategy: 'root'
      }))
        .toBe('tests/unit/src/component.test.tsx');
    });

    it('should generate test file in colocated subdirectory with explicit strategy', () => {
      expect(generateTestFilePathWithConfig('src/components/form/component.tsx', {
        testOutputDir: '__tests__',
        strategy: 'colocated'
      }))
        .toBe('src/components/form/__tests__/component.test.tsx');
    });

    it('should handle root-level files with colocated strategy', () => {
      expect(generateTestFilePathWithConfig('component.tsx', {
        testOutputDir: '__tests__'
      }))
        .toBe('__tests__/component.test.tsx');
    });

    it('should handle testOutputDir with leading ./ in colocated strategy', () => {
      expect(generateTestFilePathWithConfig('src/utils/helper.ts', {
        testOutputDir: './__tests__'
      }))
        .toBe('src/utils/__tests__/helper.test.ts');
    });

    it('should handle absolute paths with projectRoot (root strategy)', () => {
      expect(generateTestFilePathWithConfig('/project/src/component.tsx', {
        testOutputDir: 'tests/unit',
        projectRoot: '/project',
        strategy: 'root'
      }))
        .toBe('tests/unit/src/component.test.tsx');
    });

    it('should handle absolute paths with colocated strategy (projectRoot ignored)', () => {
      expect(generateTestFilePathWithConfig('/project/src/component.tsx', {
        testOutputDir: '__tests__',
        projectRoot: '/project'
      }))
        .toBe('/project/src/__tests__/component.test.tsx');
    });

    it('should preserve deep directory structure (root strategy)', () => {
      expect(generateTestFilePathWithConfig('src/features/auth/components/LoginForm.tsx', {
        testOutputDir: 'tests/unit',
        strategy: 'root'
      }))
        .toBe('tests/unit/src/features/auth/components/LoginForm.test.tsx');
    });

    it('should preserve deep directory structure (colocated strategy)', () => {
      expect(generateTestFilePathWithConfig('src/features/auth/components/LoginForm.tsx', {
        testOutputDir: '__tests__'
      }))
        .toBe('src/features/auth/components/__tests__/LoginForm.test.tsx');
    });

    it('should work with relative paths when projectRoot not specified (root strategy)', () => {
      expect(generateTestFilePathWithConfig('components/Button.jsx', {
        testOutputDir: 'tests',
        strategy: 'root'
      }))
        .toBe('tests/components/Button.test.jsx');
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
});
