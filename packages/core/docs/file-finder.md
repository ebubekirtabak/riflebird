# File Finder Utility

A flexible utility for finding files by type and pattern in the Riflebird project.

## Features

- **Predefined file types**: component, test, model, util, config, hook, page, api, style
- **Custom patterns**: Define your own glob patterns
- **Multiple file types**: Search for multiple types at once
- **Case sensitivity**: Optional case-sensitive matching
- **Statistics**: Get file counts by extension

## Usage

### Find Files by Type

```typescript
import { findFilesByType } from '@riflebird/core';

// Find all component files
const components = await findFilesByType('/path/to/project', 'component');
// Matches: Button.component.tsx, Input.Component.jsx, etc.

// Find all test files
const tests = await findFilesByType('/path/to/project', 'test');
// Matches: button.test.ts, input.spec.tsx, etc.

// Find all React hooks
const hooks = await findFilesByType('/path/to/project', 'hook');
// Matches: useAuth.ts, useState.tsx, etc.
```

### Find Files with Custom Patterns

```typescript
import { findFilesByPattern, type FilePattern } from '@riflebird/core';

const customPattern: FilePattern = {
  patterns: ['*.view.tsx', '*.container.tsx'],
  extensions: ['.tsx'],
  description: 'View and container components',
};

const files = await findFilesByPattern('/path/to/project', customPattern);
```

### Find Multiple File Types

```typescript
import { findFilesByTypes } from '@riflebird/core';

const results = await findFilesByTypes('/path/to/project', [
  'component',
  'test',
  'model',
]);

console.log(`Found ${results.component.length} components`);
console.log(`Found ${results.test.length} tests`);
console.log(`Found ${results.model.length} models`);
```

### Get File Statistics

```typescript
import { findFilesByType, getFileStats } from '@riflebird/core';

const components = await findFilesByType('/path/to/project', 'component');
const stats = getFileStats(components);

console.log(`Total: ${stats.total}`);
console.log(`By extension:`, stats.byExtension);
// { '.tsx': 10, '.jsx': 5, '.ts': 2 }
```

## Options

### FindFilesByPatternOptions

```typescript
type FindFilesByPatternOptions = {
  // Case-sensitive pattern matching (default: false)
  caseSensitive?: boolean;
  
  // File extensions to include
  includeExtensions?: string[];
  
  // Directories to exclude (default: node_modules, .git, dist, build, coverage)
  excludeDirs?: string[];
  
  // Maximum depth to traverse (default: 10)
  maxDepth?: number;
};
```

Example with options:

```typescript
const components = await findFilesByType('/path/to/project', 'component', {
  caseSensitive: true,
  excludeDirs: ['node_modules', 'dist', 'test'],
  maxDepth: 5,
});
```

## Predefined File Patterns

### Component Files
- `*.component.tsx`, `*.component.ts`, `*.component.jsx`, `*.component.js`
- `*.[Cc]omponent.tsx`, `*.[Cc]omponent.jsx`
- Extensions: `.tsx`, `.jsx`, `.ts`, `.js`

### Test Files
- `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx`
- `*.spec.ts`, `*.spec.tsx`, `*.spec.js`, `*.spec.jsx`
- Extensions: `.ts`, `.tsx`, `.js`, `.jsx`

### Model Files
- `*.model.ts`, `*.model.js`
- `*.entity.ts`, `*.schema.ts`
- Extensions: `.ts`, `.js`

### Utility Files
- `*.util.ts`, `*.util.js`
- `*.helper.ts`, `*.helper.js`
- Extensions: `.ts`, `.js`

### Config Files
- `*.config.ts`, `*.config.js`, `*.config.mjs`, `*.config.json`
- `tsconfig.json`, `package.json`
- Extensions: `.ts`, `.js`, `.mjs`, `.json`

### Hook Files (React)
- `use*.ts`, `use*.tsx`, `use*.js`, `use*.jsx`
- Extensions: `.ts`, `.tsx`, `.js`, `.jsx`

### Page Files
- `*.page.tsx`, `*.page.ts`, `*.page.jsx`, `*.page.js`
- `page.tsx`, `page.ts`
- Extensions: `.tsx`, `.ts`, `.jsx`, `.js`

### API Files
- `*.api.ts`, `*.api.js`
- `*.service.ts`, `*.service.js`
- Extensions: `.ts`, `.js`

### Style Files
- `*.css`, `*.scss`, `*.sass`, `*.less`
- `*.module.css`, `*.module.scss`
- Extensions: `.css`, `.scss`, `.sass`, `.less`

## Custom File Type

You can define completely custom patterns:

```typescript
import { FILE_PATTERNS } from '@riflebird/core';

// Access predefined patterns
console.log(FILE_PATTERNS.component);

// Or use the 'custom' type with your own pattern
const myPattern = {
  patterns: ['*.custom.tsx'],
  extensions: ['.tsx'],
  description: 'My custom files',
};
```

## Return Type

All functions return an array of `FileNode` objects:

```typescript
type FileNode = {
  name: string;        // File name (e.g., 'Button.tsx')
  path: string;        // Relative path (e.g., 'src/components/Button.tsx')
  type: 'file' | 'directory';
  extension?: string;  // File extension (e.g., '.tsx')
  children?: FileNode[]; // For directory nodes
};
```

## Examples

### Find all TypeScript files

```typescript
const tsFiles = await findFilesByPattern('/path/to/project', {
  patterns: ['*.ts', '*.tsx'],
  extensions: ['.ts', '.tsx'],
});
```

### Find files with specific naming convention

```typescript
const actionFiles = await findFilesByPattern('/path/to/project', {
  patterns: ['*Action.ts', '*Actions.ts'],
  extensions: ['.ts'],
  description: 'Redux action files',
});
```

### Get statistics for multiple file types

```typescript
const allFiles = await findFilesByTypes('/path/to/project', [
  'component',
  'test',
  'model',
  'hook',
]);

for (const [type, files] of Object.entries(allFiles)) {
  const stats = getFileStats(files);
  console.log(`${type}: ${stats.total} files`);
  console.log(`  Extensions:`, stats.byExtension);
}
```
