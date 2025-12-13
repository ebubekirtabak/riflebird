import { describe, it, expect } from 'vitest';
import { getFileStats } from '../file/file-stats';
import type { FileNode } from '@models/file-tree';

describe('file-stats', () => {
    describe('getFileStats', () => {
        it('should return correct total count for files', () => {
            const files: FileNode[] = [
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'utils.ts',
                    path: 'src/utils.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'Button.tsx',
                    path: 'src/components/Button.tsx',
                    type: 'file',
                    extension: '.tsx',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(3);
        });

        it('should count files by extension correctly', () => {
            const files: FileNode[] = [
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'utils.ts',
                    path: 'src/utils.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'Button.tsx',
                    path: 'src/components/Button.tsx',
                    type: 'file',
                    extension: '.tsx',
                },
                {
                    name: 'styles.css',
                    path: 'src/styles.css',
                    type: 'file',
                    extension: '.css',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.byExtension['.ts']).toBe(2);
            expect(stats.byExtension['.tsx']).toBe(1);
            expect(stats.byExtension['.css']).toBe(1);
        });

        it('should handle empty file array', () => {
            const files: FileNode[] = [];

            const stats = getFileStats(files);

            expect(stats.total).toBe(0);
            expect(stats.byExtension).toEqual({});
        });

        it('should handle files without extensions', () => {
            const files: FileNode[] = [
                {
                    name: 'Dockerfile',
                    path: 'Dockerfile',
                    type: 'file',
                },
                {
                    name: 'Makefile',
                    path: 'Makefile',
                    type: 'file',
                },
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(3);
            expect(stats.byExtension['.ts']).toBe(1);
            // Files without extensions should not be counted in byExtension
            expect(Object.keys(stats.byExtension)).toHaveLength(1);
        });

        it('should handle multiple files with same extension', () => {
            const files: FileNode[] = [
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'utils.ts',
                    path: 'src/utils.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'helpers.ts',
                    path: 'src/helpers.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'constants.ts',
                    path: 'src/constants.ts',
                    type: 'file',
                    extension: '.ts',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(4);
            expect(stats.byExtension['.ts']).toBe(4);
            expect(Object.keys(stats.byExtension)).toHaveLength(1);
        });

        it('should handle diverse file extensions', () => {
            const files: FileNode[] = [
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'Button.tsx',
                    path: 'src/components/Button.tsx',
                    type: 'file',
                    extension: '.tsx',
                },
                {
                    name: 'Input.jsx',
                    path: 'src/components/Input.jsx',
                    type: 'file',
                    extension: '.jsx',
                },
                {
                    name: 'App.js',
                    path: 'src/App.js',
                    type: 'file',
                    extension: '.js',
                },
                {
                    name: 'styles.css',
                    path: 'src/styles.css',
                    type: 'file',
                    extension: '.css',
                },
                {
                    name: 'styles.scss',
                    path: 'src/styles.scss',
                    type: 'file',
                    extension: '.scss',
                },
                {
                    name: 'config.json',
                    path: 'config.json',
                    type: 'file',
                    extension: '.json',
                },
                {
                    name: 'README.md',
                    path: 'README.md',
                    type: 'file',
                    extension: '.md',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(8);
            expect(stats.byExtension['.ts']).toBe(1);
            expect(stats.byExtension['.tsx']).toBe(1);
            expect(stats.byExtension['.jsx']).toBe(1);
            expect(stats.byExtension['.js']).toBe(1);
            expect(stats.byExtension['.css']).toBe(1);
            expect(stats.byExtension['.scss']).toBe(1);
            expect(stats.byExtension['.json']).toBe(1);
            expect(stats.byExtension['.md']).toBe(1);
            expect(Object.keys(stats.byExtension)).toHaveLength(8);
        });

        it('should not count directories', () => {
            const files: FileNode[] = [
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'utils.ts',
                    path: 'src/utils.ts',
                    type: 'file',
                    extension: '.ts',
                },
            ];

            const stats = getFileStats(files);

            // Only files should be counted
            expect(stats.total).toBe(2);
            expect(stats.byExtension['.ts']).toBe(2);
        });

        it('should handle case-sensitive extensions', () => {
            const files: FileNode[] = [
                {
                    name: 'file1.ts',
                    path: 'src/file1.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'file2.TS',
                    path: 'src/file2.TS',
                    type: 'file',
                    extension: '.TS',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(2);
            // Extensions are case-sensitive
            expect(stats.byExtension['.ts']).toBe(1);
            expect(stats.byExtension['.TS']).toBe(1);
        });

        it('should return stats object with correct structure', () => {
            const files: FileNode[] = [
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
            ];

            const stats = getFileStats(files);

            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('byExtension');
            expect(typeof stats.total).toBe('number');
            expect(typeof stats.byExtension).toBe('object');
        });

        it('should handle large number of files efficiently', () => {
            const files: FileNode[] = Array.from({ length: 1000 }, (_, i) => ({
                name: `file${i}.ts`,
                path: `src/file${i}.ts`,
                type: 'file' as const,
                extension: i % 2 === 0 ? '.ts' : '.tsx',
            }));

            const stats = getFileStats(files);

            expect(stats.total).toBe(1000);
            expect(stats.byExtension['.ts']).toBe(500);
            expect(stats.byExtension['.tsx']).toBe(500);
        });

        it('should handle files with dot in name but no extension', () => {
            const files: FileNode[] = [
                {
                    name: '.gitignore',
                    path: '.gitignore',
                    type: 'file',
                    extension: '.gitignore',
                },
                {
                    name: '.env',
                    path: '.env',
                    type: 'file',
                    extension: '.env',
                },
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(3);
            expect(stats.byExtension['.gitignore']).toBe(1);
            expect(stats.byExtension['.env']).toBe(1);
            expect(stats.byExtension['.ts']).toBe(1);
        });

        it('should handle mixed files with and without extensions', () => {
            const files: FileNode[] = [
                {
                    name: 'Dockerfile',
                    path: 'Dockerfile',
                    type: 'file',
                },
                {
                    name: 'index.ts',
                    path: 'src/index.ts',
                    type: 'file',
                    extension: '.ts',
                },
                {
                    name: 'Makefile',
                    path: 'Makefile',
                    type: 'file',
                },
                {
                    name: 'README.md',
                    path: 'README.md',
                    type: 'file',
                    extension: '.md',
                },
            ];

            const stats = getFileStats(files);

            expect(stats.total).toBe(4);
            expect(stats.byExtension['.ts']).toBe(1);
            expect(stats.byExtension['.md']).toBe(1);
            // Files without extensions should not appear in byExtension
            expect(Object.keys(stats.byExtension)).toHaveLength(2);
        });
    });
});
