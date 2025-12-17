import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        '**/types/**',
      ],
      thresholds: {
        // @todo: Increase thresholds as test coverage improves
        // Current coverage: ~85% lines/statements, ~84% branches, ~67% functions
        // Target: 80% for all metrics. Priority: add tests for commands/ and file-tree-walker.ts
        lines: 65,
        functions: 65,
        branches: 65,
        statements: 65,
      },
    },
  },
  resolve: {
    alias: {
      '@riflebird/core': resolve(__dirname, 'index.ts'),
      '@': resolve(__dirname, './src'),
      '@models': resolve(__dirname, './src/models'),
      '@helpers': resolve(__dirname, './src/helpers'),
      '@utils': resolve(__dirname, './src/utils'),
      '@config': resolve(__dirname, './src/config'),
      '@adapters': resolve(__dirname, './src/adapters'),
      '@commands': resolve(__dirname, './src/commands'),
      '@prompts': resolve(__dirname, './src/prompts'),
      '@providers': resolve(__dirname, './src/providers'),
      '@security': resolve(__dirname, './src/security'),
      '@runners': resolve(__dirname, './src/runners'),
    },
  },
});
