import { describe, it, expect } from 'vitest';
import { getCompiledPattern } from '../file/file-patterns';

describe('getCompiledPattern', () => {
  describe('basic pattern matching', () => {
    it('should compile simple wildcard pattern', () => {
      const compiled = getCompiledPattern('*.ts', false);

      expect(compiled.isPathPattern).toBe(false);
      expect(compiled.regex.test('file.ts')).toBe(true);
      expect(compiled.regex.test('test.ts')).toBe(true);
      expect(compiled.regex.test('file.js')).toBe(false);
      expect(compiled.regex.test('dir/file.ts')).toBe(false);
    });

    it('should compile pattern with multiple wildcards', () => {
      const compiled = getCompiledPattern('*.test.ts', false);

      expect(compiled.regex.test('button.test.ts')).toBe(true);
      expect(compiled.regex.test('input.test.ts')).toBe(true);
      expect(compiled.regex.test('test.ts')).toBe(false);
      expect(compiled.regex.test('button.ts')).toBe(false);
    });

    it('should compile pattern with question mark wildcard', () => {
      const compiled = getCompiledPattern('file?.ts', false);

      expect(compiled.regex.test('file1.ts')).toBe(true);
      expect(compiled.regex.test('fileA.ts')).toBe(true);
      expect(compiled.regex.test('file.ts')).toBe(false);
      expect(compiled.regex.test('file12.ts')).toBe(false);
    });

    it('should compile pattern with brace expansion', () => {
      const compiled = getCompiledPattern('*.{ts,js}', false);

      expect(compiled.regex.test('file.ts')).toBe(true);
      expect(compiled.regex.test('file.js')).toBe(true);
      expect(compiled.regex.test('file.tsx')).toBe(false);
      expect(compiled.regex.test('file.jsx')).toBe(false);
    });

    it('should escape dots in pattern', () => {
      const compiled = getCompiledPattern('file.component.ts', false);

      expect(compiled.regex.test('file.component.ts')).toBe(true);
      expect(compiled.regex.test('fileXcomponentXts')).toBe(false);
    });
  });

  describe('path pattern matching', () => {
    it('should identify path patterns with forward slash', () => {
      const compiled = getCompiledPattern('src/*.ts', false);

      expect(compiled.isPathPattern).toBe(true);
      expect(compiled.regex.test('src/file.ts')).toBe(true);
      expect(compiled.regex.test('src/test.ts')).toBe(true);
      expect(compiled.regex.test('file.ts')).toBe(false);
      expect(compiled.regex.test('src/nested/file.ts')).toBe(false);
    });

    it('should identify path patterns with double asterisk', () => {
      const compiled = getCompiledPattern('**/*.ts', false);

      expect(compiled.isPathPattern).toBe(true);
    });

    it('should handle double asterisk for any depth', () => {
      const compiled = getCompiledPattern('src/**/*.ts', false);

      // ** matches zero or more path segments, so src/**/*.ts requires at least src/something.ts
      expect(compiled.regex.test('src/nested/file.ts')).toBe(true);
      expect(compiled.regex.test('src/deeply/nested/file.ts')).toBe(true);
      expect(compiled.regex.test('other/file.ts')).toBe(false);
    });

    it('should handle leading ./ in patterns', () => {
      const compiled = getCompiledPattern('./src/*.ts', false);

      expect(compiled.regex.test('src/file.ts')).toBe(true);
      expect(compiled.regex.test('./src/file.ts')).toBe(false);
    });

    it('should match complex path patterns', () => {
      const compiled = getCompiledPattern('src/components/**/*.component.tsx', false);

      // ** matches zero or more segments, so we need at least one more level after components/
      expect(compiled.regex.test('src/components/forms/Input.component.tsx')).toBe(true);
      expect(compiled.regex.test('src/components/forms/nested/Select.component.tsx')).toBe(true);
      expect(compiled.regex.test('src/utils/helper.ts')).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    it('should handle case-insensitive matching', () => {
      const compiled = getCompiledPattern('*.Component.tsx', false);

      // When caseSensitive=false, the pattern is lowercased
      // The caller must also lowercase the test string for proper matching
      expect(compiled.regex.test('button.component.tsx'.toLowerCase())).toBe(true);
      expect(compiled.regex.test('Button.Component.tsx'.toLowerCase())).toBe(true);
      expect(compiled.regex.test('BUTTON.COMPONENT.TSX'.toLowerCase())).toBe(true);
    });

    it('should handle case-sensitive matching', () => {
      const compiled = getCompiledPattern('*.Component.tsx', true);

      expect(compiled.regex.test('Button.Component.tsx')).toBe(true);
      expect(compiled.regex.test('button.component.tsx')).toBe(false);
      expect(compiled.regex.test('BUTTON.COMPONENT.TSX')).toBe(false);
    });

    it('should handle case-sensitive path patterns', () => {
      const compiledInsensitive = getCompiledPattern('Src/Components/*.tsx', false);
      const compiledSensitive = getCompiledPattern('Src/Components/*.tsx', true);

      expect(compiledInsensitive.regex.test('src/components/button.tsx')).toBe(true);
      expect(compiledSensitive.regex.test('src/components/button.tsx')).toBe(false);
      expect(compiledSensitive.regex.test('Src/Components/Button.tsx')).toBe(true);
    });
  });

  describe('caching behavior', () => {
    it('should cache compiled patterns', () => {
      const pattern = '*.test.ts';
      const caseSensitive = false;

      const first = getCompiledPattern(pattern, caseSensitive);
      const second = getCompiledPattern(pattern, caseSensitive);

      // Should return the exact same object (reference equality)
      expect(first).toBe(second);
    });

    it('should use different cache entries for different case sensitivity', () => {
      const pattern = '*.ts';

      const insensitive = getCompiledPattern(pattern, false);
      const sensitive = getCompiledPattern(pattern, true);

      // Should be different objects
      expect(insensitive).not.toBe(sensitive);

      // Should have different behavior
      // For case-insensitive, caller must lowercase the test string
      expect(insensitive.regex.test('File.TS'.toLowerCase())).toBe(true);
      expect(sensitive.regex.test('File.TS')).toBe(false);
      expect(sensitive.regex.test('file.ts')).toBe(true);
    });

    it('should cache different patterns separately', () => {
      const pattern1 = '*.ts';
      const pattern2 = '*.js';

      const compiled1 = getCompiledPattern(pattern1, false);
      const compiled2 = getCompiledPattern(pattern2, false);

      expect(compiled1).not.toBe(compiled2);
      expect(compiled1.regex.test('file.ts')).toBe(true);
      expect(compiled2.regex.test('file.js')).toBe(true);
    });

    it('should return cached pattern on subsequent calls', () => {
      const pattern = 'src/**/*.component.tsx';

      // First call - creates and caches
      const first = getCompiledPattern(pattern, true);

      // Second call - retrieves from cache
      const second = getCompiledPattern(pattern, true);

      // Third call - still from cache
      const third = getCompiledPattern(pattern, true);

      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe('edge cases', () => {
    it('should handle empty pattern parts', () => {
      const compiled = getCompiledPattern('*.*.ts', false);

      expect(compiled.regex.test('file.test.ts')).toBe(true);
      expect(compiled.regex.test('component.spec.ts')).toBe(true);
    });

    it('should handle pattern with only wildcards', () => {
      const compiled = getCompiledPattern('*', false);

      expect(compiled.regex.test('anything')).toBe(true);
      expect(compiled.regex.test('file.ts')).toBe(true);
      expect(compiled.regex.test('dir/file.ts')).toBe(false); // * doesn't match /
    });

    it('should handle pattern with only double asterisk', () => {
      const compiled = getCompiledPattern('**', false);

      expect(compiled.regex.test('anything')).toBe(true);
      expect(compiled.regex.test('dir/file.ts')).toBe(true);
      expect(compiled.regex.test('deeply/nested/file.ts')).toBe(true);
    });

    it('should handle multiple brace groups', () => {
      const compiled = getCompiledPattern('*.{component,view}.{ts,tsx}', false);

      expect(compiled.regex.test('button.component.ts')).toBe(true);
      expect(compiled.regex.test('input.view.tsx')).toBe(true);
      expect(compiled.regex.test('card.component.tsx')).toBe(true);
      expect(compiled.regex.test('header.view.ts')).toBe(true);
      expect(compiled.regex.test('utils.helper.ts')).toBe(false);
    });

    it('should handle patterns with special regex characters', () => {
      const compiled = getCompiledPattern('file.test.ts', false);

      // Dots should be escaped, not treated as regex wildcards
      expect(compiled.regex.test('file.test.ts')).toBe(true);
      expect(compiled.regex.test('fileXtestXts')).toBe(false);
    });

    it('should not match partial paths', () => {
      const compiled = getCompiledPattern('src/*.ts', false);

      expect(compiled.regex.test('src/file.ts')).toBe(true);
      expect(compiled.regex.test('prefix-src/file.ts')).toBe(false);
      expect(compiled.regex.test('src/file.ts-suffix')).toBe(false);
    });
  });

  describe('real-world patterns', () => {
    it('should match component patterns', () => {
      const patterns = ['*.component.tsx', '*.component.ts', '*.[Cc]omponent.tsx'];

      const compiled = patterns.map((p) => getCompiledPattern(p, false));

      const testFiles = [
        'Button.component.tsx',
        'input.Component.tsx',
        'Card.component.ts',
        'Header.tsx',
      ];

      // For case-insensitive matching, lowercase the test strings
      expect(testFiles.filter((f) => compiled.some((c) => c.regex.test(f.toLowerCase())))).toEqual([
        'Button.component.tsx',
        'input.Component.tsx',
        'Card.component.ts',
      ]);
    });

    it('should match test file patterns', () => {
      const patterns = ['*.test.ts', '*.spec.ts'];
      const compiled = patterns.map((p) => getCompiledPattern(p, false));

      const testFiles = ['button.test.ts', 'input.spec.ts', 'utils.ts', 'component.tsx'];

      expect(testFiles.filter((f) => compiled.some((c) => c.regex.test(f)))).toEqual([
        'button.test.ts',
        'input.spec.ts',
      ]);
    });

    it('should match hook patterns', () => {
      const compiled = getCompiledPattern('use*.ts', false);

      expect(compiled.regex.test('useState.ts')).toBe(true);
      expect(compiled.regex.test('useEffect.ts')).toBe(true);
      expect(compiled.regex.test('useCustomHook.ts')).toBe(true);
      expect(compiled.regex.test('utils.ts')).toBe(false);
    });

    it('should match nested component patterns', () => {
      const compiled = getCompiledPattern('src/components/**/*.component.tsx', false);

      const paths = [
        'src/components/forms/Input.component.tsx',
        'src/components/forms/fields/Select.component.tsx',
        'src/utils/helper.ts',
        'components/Card.component.tsx',
      ];

      // ** requires at least one path segment, so src/components/**/*.tsx needs
      // at least src/components/something/*.tsx
      expect(paths.filter((p) => compiled.regex.test(p.toLowerCase()))).toEqual([
        'src/components/forms/Input.component.tsx',
        'src/components/forms/fields/Select.component.tsx',
      ]);
    });
  });

  describe('security and escaping', () => {
    it('should treat regex special characters as literals', () => {
      // + is a regex special char (one or more), but should be literal here
      const compiledPlus = getCompiledPattern('file+name.ts', false);
      expect(compiledPlus.regex.test('file+name.ts')).toBe(true);
      expect(compiledPlus.regex.test('filename.ts')).toBe(false); // Currently fails (matches)
      expect(compiledPlus.regex.test('fileeeename.ts')).toBe(false); // Currently fails (matches)

      // () are regex capturing groups, but should be literal here
      const compiledParens = getCompiledPattern('(val).ts', false);
      expect(compiledParens.regex.test('(val).ts')).toBe(true);
      expect(compiledParens.regex.test('val.ts')).toBe(false); // Currently fails (matches)

      // [] are regex character classes, but should be literal here (unless supported as glob)
      // Assuming strict glob support only for *, **, ?, {}
      const compiledBrackets = getCompiledPattern('[abc].ts', false);
      expect(compiledBrackets.regex.test('[abc].ts')).toBe(true);
      expect(compiledBrackets.regex.test('a.ts')).toBe(false); // Currently fails (matches)
    });

    it('should treat backslashes as literals', () => {
      const compiled = getCompiledPattern('folder\\file.ts', false);
      // In regex string `folder\file.ts` -> `folder` + escaped `f` (f) + `ile.ts` -> `folderfile.ts`
      // OR `folder\file.ts` -> `folder` + `\f` (form feed)?
      // We want it to match literal `folder\file.ts`
      expect(compiled.regex.test('folder\\file.ts')).toBe(true);
    });
  });
});
