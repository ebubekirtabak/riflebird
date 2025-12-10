
import { describe, it, expect } from 'vitest';
import { resolveTestTypes, getScopePatterns } from '../fire-command-helpers';
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
            expect(patterns).toContain('src/components/**/*.{tsx,jsx,vue}');
            expect(patterns).toContain('components/**/*.{tsx,jsx,vue}');
            expect(patterns).toContain('src/app/components/**/*.{tsx,jsx,vue}');
        });

        it('should return correct patterns for "layout"', () => {
            const patterns = getScopePatterns('layout');
            expect(patterns).toEqual([
                'src/layouts/**/*.{tsx,jsx,vue,ts,js}',
                'layouts/**/*.{tsx,jsx,vue,ts,js}',
                'src/app/layouts/**/*.{tsx,jsx,vue,ts,js}',
            ]);
        });

        it('should return correct patterns for "page"', () => {
            const patterns = getScopePatterns('page');
            expect(patterns).toEqual([
                'src/pages/**/*.{tsx,jsx,vue,ts,js}',
                'pages/**/*.{tsx,jsx,vue,ts,js}',
                'src/app/**/(page|route).{tsx,jsx,ts,js}',
            ]);
        });

        it('should return correct patterns for "service"', () => {
            const patterns = getScopePatterns('service');
            expect(patterns).toEqual([
                'src/services/**/*.{ts,js}',
                'services/**/*.{ts,js}',
                'src/api/**/*.{ts,js}',
                'api/**/*.{ts,js}',
            ]);
        });

        it('should return correct patterns for "util"', () => {
            const patterns = getScopePatterns('util');
            expect(patterns).toEqual([
                'src/utils/**/*.{ts,js}',
                'utils/**/*.{ts,js}',
                'src/helpers/**/*.{ts,js}',
                'helpers/**/*.{ts,js}',
            ]);
        });

        it('should return correct patterns for "hook"', () => {
            const patterns = getScopePatterns('hook');
            expect(patterns).toEqual([
                'src/hooks/**/*.{ts,tsx,js,jsx}',
                'hooks/**/*.{ts,tsx,js,jsx}',
                'src/composables/**/*.{ts,js}',
            ]);
        });

        it('should return correct patterns for "store"', () => {
            const patterns = getScopePatterns('store');
            expect(patterns).toEqual([
                'src/store/**/*.{ts,js}',
                'store/**/*.{ts,js}',
                'src/stores/**/*.{ts,js}',
                'stores/**/*.{ts,js}',
                'src/state/**/*.{ts,js}',
            ]);
        });

        it('should return empty array for invalid scope', () => {
            const patterns = getScopePatterns('invalid' as TestScope);
            expect(patterns).toEqual([]);
        });
    });
});
