# Caching Strategy

Riflebird uses a smart caching system to improve performance by avoiding unnecessary file parsing and analysis. This document explains how the cache works, what is stored, and how to manage it.

## What is cached?

The cache is stored in `.riflebird/cache.json` within your project root. It contains the following information:

- **Project Context**: Information about your project setup, including the root directory.
- **Framework Configurations**: Parsed configurations for:
  - Language (e.g., `tsconfig.json`)
  - Linter (e.g., `.eslintrc.json`, `eslint.config.js`)
  - Formatter (e.g., `.prettierrc`)
  - Test Frameworks (e.g., `jest.config.js`, `vitest.config.ts`)
- **Package Manager**: Details about the detected package manager (npm, yarn, pnpm, bun) and parsed `package.json` content.


## Cache Validation Strategy

Riflebird employs a validation strategy to ensure the cache is always up-to-date while minimizing unnecessary work:

1.  **File Existence**: The system checks if the cached configuration files still exist on disk.
2.  **Content Comparison (Repair Path)**:
    - If a file is present, its content is read from disk and compared with the cached content.
      - If the content has changed, the cache is updated with the new content.
      - If the content is effectively the same (e.g., the file was "touched" but content didn't change), the cache entry is kept as-is to avoid redundant work on subsequent runs.
## Automatic Invalidation

The cache is automatically invalidated or updated in the following scenarios:

- **Missing Files**: If a configuration file referenced in the cache is deleted, the cache for that specific item is marked as invalid or removed.
- **Modified Files**: If a configuration file is modified (detected via `mtime` change), the system automatically re-reads the file and updates the cache.
- **Corrupt Cache**: If `cache.json` is malformed or unreadable, it is discarded, and a new project analysis is triggered.

## Manual Cache Clearing

You can manually clear the cache using the items described below. This forces a complete re-analysis of your project on the next run.

### Using the CLI

Run the clean command from your project root:

```bash
riflebird clean
```

### Manual Deletion

Simply delete the `.riflebird` directory:

```bash
rm -rf .riflebird
```

## Performance Benefits

- **Reduced I/O**: drastically reduces the amount of data read from disk on startup, especially for large projects.
- **Faster Startup**: "Warm" starts (with valid cache) are significantly faster than "cold" starts because expensive parsing steps are skipped.
- **Self-Healing**: The cache automatically corrects itself if files are modified externally, ensuring you always work with the latest configuration.
