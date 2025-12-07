import { describe, it, expect } from 'vitest';
import { generateTestFilePath, isTestFile, getSourceFilePath } from '../file-util';

describe('file-util', () => {
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
