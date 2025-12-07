# Test Pattern Constants

Riflebird exports reusable test pattern constants to ensure consistency across your project configuration.

## Available Constants

### `DEFAULT_UNIT_TEST_PATTERNS`
Default glob patterns for unit test files:
```typescript
['**/*.test.ts', '**/*.spec.ts']
```

### `DEFAULT_E2E_TEST_PATTERNS`
Default glob patterns for E2E test files:
```typescript
['**/*.e2e.ts', '**/*.e2e-spec.ts']
```

### `DEFAULT_COVERAGE_INCLUDE`
Default patterns for files to include in coverage:
```typescript
['src/**/*.ts', 'src/**/*.tsx']
```

### `DEFAULT_COVERAGE_EXCLUDE`
Default patterns for files to exclude from coverage:
```typescript
[
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.e2e.ts',
  '**/*.e2e-spec.ts',
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/__tests__/**',
  '**/__mocks__/**',
]
```

## Usage

### In Configuration Files

```typescript
import { 
  defineConfig, 
  DEFAULT_UNIT_TEST_PATTERNS,
  DEFAULT_COVERAGE_INCLUDE,
  DEFAULT_COVERAGE_EXCLUDE 
} from '@riflebird/core';

export default defineConfig({
  ai: { /* ... */ },
  framework: 'playwright',
  
  unitTesting: {
    enabled: true,
    framework: 'vitest',
    testDir: 'tests/unit',
    
    // Use default patterns
    testMatch: [...DEFAULT_UNIT_TEST_PATTERNS],
    
    coverage: {
      enabled: true,
      provider: 'v8',
      
      // Use default include/exclude patterns
      include: [...DEFAULT_COVERAGE_INCLUDE],
      exclude: [...DEFAULT_COVERAGE_EXCLUDE],
      
      reporter: ['text', 'html'],
    },
  },
});
```

### Custom Patterns

You can extend or override the defaults:

```typescript
import { 
  defineConfig, 
  DEFAULT_UNIT_TEST_PATTERNS,
  DEFAULT_COVERAGE_EXCLUDE 
} from '@riflebird/core';

export default defineConfig({
  // ...
  unitTesting: {
    enabled: true,
    
    // Extend with custom patterns
    testMatch: [
      ...DEFAULT_UNIT_TEST_PATTERNS,
      '**/*.unit.ts',  // Add custom pattern
    ],
    
    coverage: {
      enabled: true,
      
      // Custom include (override completely)
      include: ['lib/**/*.ts', 'app/**/*.tsx'],
      
      // Extend exclusions
      exclude: [
        ...DEFAULT_COVERAGE_EXCLUDE,
        '**/legacy/**',  // Add custom exclusion
        '**/*.stories.tsx',
      ],
    },
  },
});
```

### Framework-Specific Usage

Different test frameworks may have different naming conventions:

```typescript
import { 
  defineConfig, 
  DEFAULT_UNIT_TEST_PATTERNS,
  DEFAULT_E2E_TEST_PATTERNS 
} from '@riflebird/core';

export default defineConfig({
  // ...
  unitTesting: {
    enabled: true,
    framework: 'jest',
    
    // Jest convention: separate unit and integration tests
    testMatch: [
      ...DEFAULT_UNIT_TEST_PATTERNS,
      '**/*.int.test.ts',  // Integration tests
    ],
  },
});
```

## Benefits

✅ **Consistency**: Same patterns across all configurations  
✅ **Maintainability**: Update patterns in one place  
✅ **Type Safety**: TypeScript-aware readonly arrays  
✅ **Best Practices**: Pre-configured sensible defaults  
✅ **Extensibility**: Easy to extend or override

## Pattern Guarantees

The constants maintain these guarantees:

1. **Unit and E2E patterns are distinct** - No overlap between unit test and E2E test patterns
2. **All test patterns are excluded from coverage** - Test files don't count toward coverage metrics
3. **Common directories excluded** - node_modules, dist, coverage automatically excluded
4. **Test infrastructure excluded** - __tests__, __mocks__ directories excluded

## Schema Integration

These constants are used as defaults in `RiflebirdConfigSchema`:

```typescript
unitTesting: z.object({
  testMatch: z.array(z.string()).default([...DEFAULT_UNIT_TEST_PATTERNS]),
  coverage: z.object({
    include: z.array(z.string()).default([...DEFAULT_COVERAGE_INCLUDE]),
    exclude: z.array(z.string()).default([...DEFAULT_COVERAGE_EXCLUDE]),
  }),
})
```

This means when you omit these fields, the defaults are automatically applied.
