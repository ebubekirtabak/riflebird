
import { describe, it, expect } from 'vitest';
import { resolveTestTypes, getScopePatterns, getFileExcludePatterns, shouldExcludeFile } from '../fire-command-helpers';
import { SUPPORTED_TEST_TYPES } from '../constants';
import type { TestScope } from '../../fire-command';

describe('fire-command-helpers', () => {
    describe('resolveTestTypes', () => {
        it('should return all supported test types when `all` is true and `testTypes` is empty', () => {
            const result = resolveTestTypes(true, []);
            expect(result).toEqual(SUPPORTED_TEST_TYPES);
        });

        it('should return provided test types check if `testTypes` is not empty', () => {
            const result = resolveTestTypes(false, ['e2e']);
            expect(result).toEqual(['e2e']);
        });

        it('should return default ["unit"] when `all` is false/undefined and `testTypes` is empty', () => {
            expect(resolveTestTypes(false, [])).toEqual(['unit']);
            expect(resolveTestTypes(undefined, [])).toEqual(['unit']);
        });

        it('should prioritize provided test types over `all` flag', () => {
            const result = resolveTestTypes(true, ['e2e']);
            expect(result).toEqual(['e2e']);
        });
    });

    describe('getScopePatterns', () => {
        it('should return correct patterns for "component"', () => {
            const patterns = getScopePatterns('component');
            expect(patterns).toContain('**/src/components/**/*.{tsx,jsx,vue}');
            expect(patterns).toContain('**/components/**/*.{tsx,jsx,vue}');
            expect(patterns).toContain('**/src/app/components/**/*.{tsx,jsx,vue}');
        });

        it('should return correct patterns for "layout"', () => {
            const patterns = getScopePatterns('layout');
            expect(patterns).toEqual([
                '**/src/layouts/**/*.{tsx,jsx,vue,ts,js}',
                '**/layouts/**/*.{tsx,jsx,vue,ts,js}',
                '**/src/app/layouts/**/*.{tsx,jsx,vue,ts,js}',
            ]);
        });

        it('should return correct patterns for "page"', () => {
            const patterns = getScopePatterns('page');
            expect(patterns).toEqual([
                '**/src/pages/**/*.{tsx,jsx,vue,ts,js}',
                '**/pages/**/*.{tsx,jsx,vue,ts,js}',
                '**/src/app/**/(page|route).{tsx,jsx,ts,js}',
            ]);
        });

        it('should return correct patterns for "service"', () => {
            const patterns = getScopePatterns('service');
            expect(patterns).toEqual([
                '**/src/services/**/*.{ts,js}',
                '**/services/**/*.{ts,js}',
                '**/src/api/**/*.{ts,js}',
                '**/api/**/*.{ts,js}',
            ]);
        });

        it('should return correct patterns for "util"', () => {
            const patterns = getScopePatterns('util');
            expect(patterns).toEqual([
                '**/src/utils/**/*.{ts,js}',
                '**/utils/**/*.{ts,js}',
                '**/src/helpers/**/*.{ts,js}',
                '**/helpers/**/*.{ts,js}',
            ]);
        });

        it('should return correct patterns for "hook"', () => {
            const patterns = getScopePatterns('hook');
            expect(patterns).toEqual([
                '**/src/hooks/**/*.{ts,tsx,js,jsx}',
                '**/hooks/**/*.{ts,tsx,js,jsx}',
                '**/src/composables/**/*.{ts,js}',
            ]);
        });

        it('should return correct patterns for "store"', () => {
            const patterns = getScopePatterns('store');
            expect(patterns).toEqual([
                '**/src/store/**/*.{ts,js}',
                '**/store/**/*.{ts,js}',
                '**/src/stores/**/*.{ts,js}',
                '**/stores/**/*.{ts,js}',
                '**/src/state/**/*.{ts,js}',
            ]);
        });

        it('should return empty array for invalid scope', () => {
            const patterns = getScopePatterns('invalid' as TestScope);
            expect(patterns).toEqual([]);
        });
    });

    describe('getFileExcludePatterns', () => {
        it('should return default exclusion patterns', () => {
            const patterns = getFileExcludePatterns();
            expect(patterns).toBeInstanceOf(Array);
            expect(patterns.length).toBeGreaterThan(0);
        });

        it('should include test file patterns', () => {
            const patterns = getFileExcludePatterns();
            expect(patterns).toContain('**/*.test.{ts,tsx,js,jsx}');
            expect(patterns).toContain('**/*.spec.{ts,tsx,js,jsx}');
            expect(patterns).toContain('**/__tests__/**');
        });

        it('should include Storybook patterns', () => {
            const patterns = getFileExcludePatterns();
            expect(patterns).toContain('**/*.stories.{ts,tsx,js,jsx}');
            expect(patterns).toContain('**/*.story.{ts,tsx,js,jsx}');
            expect(patterns).toContain('**/.storybook/**');
        });

        it('should include build output patterns', () => {
            const patterns = getFileExcludePatterns();
            expect(patterns).toContain('**/dist/**');
            expect(patterns).toContain('**/build/**');
            expect(patterns).toContain('**/coverage/**');
        });

        it('should include config file patterns', () => {
            const patterns = getFileExcludePatterns();
            expect(patterns).toContain('**/*.config.{ts,js}');
            expect(patterns).toContain('**/*.d.ts');
        });
    });

    describe('shouldExcludeFile', () => {
        it('should exclude test files', () => {
            expect(shouldExcludeFile('src/components/Button.test.tsx')).toBe(true);
            expect(shouldExcludeFile('src/utils/helper.spec.ts')).toBe(true);
            expect(shouldExcludeFile('src/__tests__/setup.ts')).toBe(true);
        });

        it('should exclude Storybook files', () => {
            expect(shouldExcludeFile('src/components/Button.stories.tsx')).toBe(true);
            expect(shouldExcludeFile('src/components/Card.story.jsx')).toBe(true);
            expect(shouldExcludeFile('.storybook/main.js')).toBe(true);
        });

        it('should exclude build output directories', () => {
            expect(shouldExcludeFile('dist/index.js')).toBe(true);
            expect(shouldExcludeFile('build/components/Button.js')).toBe(true);
            expect(shouldExcludeFile('coverage/lcov.info')).toBe(true);
            expect(shouldExcludeFile('.next/static/chunks/main.js')).toBe(true);
        });

        it('should exclude config files', () => {
            expect(shouldExcludeFile('vite.config.ts')).toBe(true);
            expect(shouldExcludeFile('src/utils/jest.setup.js')).toBe(true);
            expect(shouldExcludeFile('src/types.d.ts')).toBe(true);
        });

        it('should exclude node_modules', () => {
            expect(shouldExcludeFile('node_modules/react/index.js')).toBe(true);
        });

        it('should NOT exclude regular component files', () => {
            expect(shouldExcludeFile('src/components/Button.tsx')).toBe(false);
            expect(shouldExcludeFile('src/pages/Home.jsx')).toBe(false);
            expect(shouldExcludeFile('src/utils/helper.ts')).toBe(false);
        });

        it('should support custom exclusion patterns', () => {
            const customPatterns = ['**/*.custom.ts', '**/temp/**'];
            expect(shouldExcludeFile('src/file.custom.ts', customPatterns)).toBe(true);
            expect(shouldExcludeFile('temp/data.json', customPatterns)).toBe(true);
            expect(shouldExcludeFile('src/component.tsx', customPatterns)).toBe(false);
        });

        it('should handle nested paths correctly', () => {
            expect(shouldExcludeFile('src/features/user/components/Avatar.test.tsx')).toBe(true);
            expect(shouldExcludeFile('src/features/user/components/Avatar.tsx')).toBe(false);
        });

        it('should handle e2e test files', () => {
            expect(shouldExcludeFile('src/pages/Login.e2e.ts')).toBe(true);
            expect(shouldExcludeFile('tests/e2e/login.e2e.tsx')).toBe(true);
        });
    });
});
