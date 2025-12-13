import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error', // Enforce strict typing as per project rules
    },
  },
];
