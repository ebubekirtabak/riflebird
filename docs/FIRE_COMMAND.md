# Fire Command - Multi-Type Test Execution

## Overview

The `fire` command generates and executes tests with flexible filtering options. Currently, **unit test generation is fully supported** with glob patterns, scope filtering, and batch processing. E2E, visual, and performance testing infrastructure is in place but not yet fully implemented.

The command automatically validates your AI configuration (API keys, model settings) before execution to ensure proper setup.

## Usage Examples

### Single File Test Generation

Generate unit tests for a specific file (default behavior):

```bash
riflebird fire src/utils/calculator.ts
```

Generate tests with specific type:

```bash
riflebird fire src/utils/calculator.ts --unit
riflebird fire src/components/Button.tsx --e2e --visual
```

### Glob Pattern Matching

Generate tests for multiple files using glob patterns:

```bash
# All components in a directory
riflebird fire "src/components/*" --unit

# All TypeScript files recursively
riflebird fire "src/**/*.ts" --unit --e2e

# Specific file patterns
riflebird fire "src/utils/*.helper.ts" --unit
```

### Run All Tests with Scope Filters

Execute all test types for all files:

```bash
riflebird fire --all
```

Run tests with scope filtering:

```bash
# All component files only
riflebird fire --all --scope component --unit

# All service files
riflebird fire --all --scope service --unit

# All layout files with E2E tests
riflebird fire --all --scope layout --e2e
```

Run specific test types across all files:

```bash
riflebird fire --all --unit
riflebird fire --all --e2e --unit
riflebird fire --all --visual --performance
```

### Test Type Filters

Available test type flags:

- `--unit`: Unit tests (Jest, Vitest, Mocha, AVA) ✅ **Fully Implemented**
- `--e2e`: End-to-end tests (Playwright, Cypress, Puppeteer, WebdriverIO) 🚧 **Coming Soon**
- `--visual`: Visual regression tests 🚧 **Coming Soon**
- `--performance`: Performance tests 🚧 **Coming Soon**

**Note**: When using `--e2e`, `--visual`, or `--performance` flags, the command will acknowledge them but display a "coming soon" message as these features are under development.

### Scope Filters

When using `--all`, you can filter by file scope:

- `--scope component`: React/Vue components (`*.tsx`, `*.jsx`, `*.vue`)
  - Patterns: `src/components/**`, `components/**`
- `--scope layout`: Layout files
  - Patterns: `src/layouts/**`, `layouts/**`
- `--scope page`: Page/route files
  - Patterns: `src/pages/**`, `pages/**`
- `--scope service`: Service/API files
  - Patterns: `src/services/**`, `src/api/**`
- `--scope util`: Utility/helper files
  - Patterns: `src/utils/**`, `src/helpers/**`
- `--scope hook`: React hooks/Vue composables
  - Patterns: `src/hooks/**`, `src/composables/**`
- `--scope store`: State management files
  - Patterns: `src/store/**`, `src/stores/**`, `src/state/**`

## Command Structure

```
fire [testPath] [options]
```

### Arguments

- `testPath` (optional): Path to the file to generate tests for
  - Can be absolute or relative to project root
  - Mutually exclusive with `--all` flag

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--all` | `-a` | Run all test types for all files |
| `--e2e` | - | Include E2E tests |
| `--unit` | - | Include unit tests |
| `--visual` | - | Include visual regression tests |
| `--performance` | - | Include performance tests |
| `--scope <scope>` | `-s` | Filter by scope (component, layout, page, service, util, hook, store) |
| `--headless` | `-h` | Run in headless mode |
| `--browser <browser>` | `-b` | Browser to use (chromium, firefox, webkit) |

## Resolution Logic

The command determines which test types to execute based on the following logic:

1. **`--all` with no type flags**: Runs unit tests only (currently the only fully supported type)
2. **Specific type flags**: Runs only the specified test types (note: e2e, visual, performance show "coming soon" messages)
3. **Single file with no flags**: Defaults to unit tests only
4. **`--all` + specific flags**: Runs specified types for all files
5. **`--scope` without `--all`**: Automatically enables `--all` mode

### Examples

```bash
# Single file (defaults to unit tests)
riflebird fire src/app.ts

# Pattern matching
riflebird fire "src/components/*" --unit
riflebird fire "src/**/*.service.ts" --unit --e2e

# All files, unit tests (currently only fully supported type)
riflebird fire --all

# All files, unit tests (explicit)
riflebird fire --all --unit

# All files, multiple types (e2e/visual/performance show "coming soon")
riflebird fire --all --unit --e2e --visual

# Scope filtering (only with --all)
riflebird fire --all --scope component --unit
riflebird fire --all --scope service --unit --e2e
riflebird fire --all --scope hook --unit

# Multiple test types for specific file
riflebird fire src/app.ts --unit --e2e

# Complex combinations
riflebird fire --all --scope component --unit --visual
```

## Validation Rules

The command enforces the following validation:

1. **Must provide either a path/pattern or `--all` flag**
   ```bash
   # ❌ Invalid
   riflebird fire
   
   # ✅ Valid
   riflebird fire src/app.ts
   riflebird fire "src/**/*.ts"
   riflebird fire --all
   ```

2. **Scope automatically enables `--all` mode**
   ```bash
   # ✅ Valid - scope auto-enables --all
   riflebird fire --scope component
   
   # ✅ Also valid - explicit --all
   riflebird fire --all --scope component
   
   # ❌ Invalid - scope cannot be used with specific file paths
   riflebird fire src/app.ts --scope component
   ```

3. **Test type flags must be valid**
   - Valid: `e2e`, `unit`, `visual`, `performance`
   - Invalid flags throw an error

4. **Scope values must be valid**
   - Valid: `component`, `layout`, `page`, `service`, `util`, `hook`, `store`
   - Invalid scopes throw an error

## Current Implementation Status

### ✅ Fully Implemented

- [x] Test type filtering infrastructure
- [x] CLI flag parsing (`--all`, `--unit`, `--e2e`, `--visual`, `--performance`)
- [x] Input validation and resolution logic
- [x] Single file unit test generation
- [x] Glob pattern matching for file discovery
- [x] Batch test generation for `--all` flag
- [x] Scope-based file discovery (component, layout, page, service, util, hook, store)
- [x] Progress reporting for bulk operations
- [x] AI configuration validation (checks API keys before execution)
- [x] Error handling and failure collection
- [x] Type safety with TypeScript

### 🚧 Coming Soon (Stubs in Place)

- [ ] E2E test execution (shows "coming soon" message)
- [ ] Visual regression testing (shows "coming soon" message)
- [ ] Performance testing (shows "coming soon" message)
- [ ] Parallel test generation optimization
- [ ] Test coverage analytics

## Configuration

Test framework and AI configuration are defined in `riflebird.config.ts`:

```typescript
export default defineConfig({
  // AI Configuration (validated before command execution)
  ai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY, // Or set directly
    model: 'gpt-4o-mini',
    temperature: 0.2,
  },
  
  // Unit Testing (fully supported)
  unitTesting: {
    enabled: true,
    framework: 'vitest',
    testOutputDir: 'tests/unit', // Directory where generated unit tests will be written
    // testOutputStrategy auto-detected: 'tests/unit' = root, '__tests__' = colocated
    testMatch: ['**/*.test.ts', '**/*.spec.ts'], // Patterns to discover existing tests
  },
  
  // E2E Testing (coming soon)
  e2e: {
    framework: 'playwright',
    playwright: {
      browser: 'chromium',
      headless: false,
    },
  },
  
  // Visual Testing (coming soon)
  visual: {
    enabled: true,
    threshold: 0.1,
  },
});
```

### Test Output Strategies

The strategy is **auto-detected** from `testOutputDir` path:

**Root Strategy** (auto-detected for paths like `tests/unit`, `spec/unit`):
```typescript
{
  testOutputDir: 'tests/unit'
}
// src/components/form/component.tsx → tests/unit/src/components/form/component.test.tsx
```

**Colocated Strategy** (auto-detected for `__tests__`, `__test__`, or paths starting with `./`):
```typescript
{
  testOutputDir: '__tests__'
}
// src/components/form/component.tsx → src/components/form/__tests__/component.test.tsx
```

```typescript
{
  testOutputDir: './__tests__'
}
// src/components/form/component.tsx → src/components/form/__tests__/component.test.tsx
```

**Manual Override** (optional):
```typescript
{
  testOutputDir: 'tests/unit',
  testOutputStrategy: 'colocated' // Explicitly override auto-detection
}
```

### AI Configuration Validation

Before executing any command, Riflebird validates:
- **API Key presence**: Checks config or environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- **API Key format**: OpenAI keys must start with `sk-`
- **Model configuration**: Ensures model name is specified
- **Provider-specific requirements**: URL for local providers, etc.
- **Temperature range**: Must be between 0 and 2

## Error Handling

The command provides clear error messages for common issues:

```bash
# Missing API key
Error: Invalid AI configuration:
  - apiKey: OpenAI API key is required. Set it in config or OPENAI_API_KEY environment variable.
Please check your riflebird.config.ts file or environment variables.

# Invalid API key format
Error: Invalid AI configuration:
  - apiKey: OpenAI API key must start with "sk-".
Please check your riflebird.config.ts file or environment variables.

# Missing both path and --all flag
Error: Either provide a test path/pattern or use --all flag

# Using scope with specific file path
Error: Scope filters (component, layout, etc.) can only be used with --all flag

# Invalid test type
Error: Invalid test type: invalid. Valid types are: e2e, unit, visual, performance

# Invalid scope
Error: Invalid scope: invalid. Valid scopes are: component, layout, page, service, util, hook, store
```

## Architecture

### Type Definitions

```typescript
export type TestType = 'e2e' | 'unit' | 'visual' | 'performance';

export type TestScope = 'component' | 'layout' | 'page' | 'service' | 'util' | 'hook' | 'store';

export type FireInput = {
  testPath?: string;      // File path or glob pattern
  all?: boolean;          // Run all files
  testTypes?: TestType[]; // Filter by test types
  scope?: TestScope;      // Filter by file scope (only with --all)
};
```

### Command Flow

1. **CLI receives command** → `packages/cli/src/commands/fire.ts`
2. **AI config validation** → `validateAIConfigOrThrow()` checks API keys and configuration
3. **Flags parsed to FireInput** → Build test types array
4. **Core executes command** → `packages/core/src/commands/fire-command.ts`
5. **Input validation** → Check path/all constraints, scope validity
6. **Resolution** → Determine active test types (defaults to unit tests)
7. **Execution** → Run tests for each type with progress tracking

### Key Files

- `packages/core/src/commands/fire-command.ts` - Core command logic and validation
- `packages/core/src/commands/fire/fire-command-helpers.ts` - Helper functions for resolution and patterns
- `packages/core/src/commands/fire/constants.ts` - Test type and scope constants
- `packages/core/src/commands/fire/unit-test-writer.ts` - Unit test generation implementation
- `packages/core/src/config/ai-config-validator.ts` - AI configuration validation
- `packages/core/src/riflebird.ts` - Main API interface
- `packages/cli/src/commands/fire.ts` - CLI command handler
- `packages/cli/src/index.ts` - CLI flag definitions

## Testing

All existing tests pass (194/194). The changes maintain backward compatibility while adding new functionality.

Run tests:

```bash
pnpm test -- -- --run
```

## Future Enhancements

### Planned Features

1. **Smart Test Selection**
   - Analyze file changes and generate only relevant tests
   - Use git diff to determine which files need testing

2. **Batch Processing**
   - Parallel test generation for multiple files
   - Progress bars and ETAs for large operations

3. **Test Discovery**
   - Automatically find files without tests
   - Suggest test coverage improvements

4. **Custom Filters**
   - File pattern matching: `fire --all --pattern="src/**/*.service.ts"`
   - Exclude patterns: `fire --all --exclude="**/*.mock.ts"`

5. **Interactive Mode**
   - Prompt for test types when using `--all`
   - Review and approve generated tests before writing

## Contributing

When adding new test types:

1. Add the type to `TestType` union in `fire-command.ts`
2. Update `resolveTestTypes()` to include it in `--all` mode
3. Add CLI flag in `packages/cli/src/index.ts`
4. Implement execution logic in `FireCommand.execute()`
5. Update documentation

## Support

For issues or questions about the fire command:
- GitHub Issues: [riflebird/issues](https://github.com/ebubekirtabak/riflebird/issues)
- Discussions: [riflebird/discussions](https://github.com/ebubekirtabak/riflebird/discussions)
