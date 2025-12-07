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
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
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
    },
  },
});
