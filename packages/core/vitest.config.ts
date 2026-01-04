import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import pkg from './package.json';

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
        lines: 85,
        functions: 78,
        branches: 85,
        statements: 85,
      },
    },
    env: {
      RIFLEBIRD_VERSION: pkg.version,
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
      '@commons': resolve(__dirname, './src/commons'),
      '@prompts': resolve(__dirname, './src/prompts'),
      '@providers': resolve(__dirname, './src/providers'),
      '@security': resolve(__dirname, './src/security'),
      '@runners': resolve(__dirname, './src/runners'),
      '@types': resolve(__dirname, './src/types'),
      '@agentic': resolve(__dirname, './src/agentic'),
      '@handlers': resolve(__dirname, './src/handlers'),
      '@services': resolve(__dirname, './src/services'),
    },
  },
});
