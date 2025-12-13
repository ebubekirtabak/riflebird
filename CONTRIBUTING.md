# Contributing to Riflebird

**Riflebird** is an AI-powered test generation and execution framework that supports unit, integration, E2E, visual, and performance testing across multiple testing frameworks.

Thank you for your interest in contributing to Riflebird! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+ or 20+
- pnpm 10.23.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/ebubekirtabak/riflebird.git
cd riflebird

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @riflebird/core test

# Run tests in watch mode
pnpm --filter @riflebird/core test

# Run tests with coverage
pnpm --filter @riflebird/core test -- --run --coverage
```

### Code Quality

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Run type checking
pnpm --filter @riflebird/core run type-check
```

### Building

```bash
# Build all packages
pnpm build

# Build in watch mode
pnpm dev

# Build specific package
pnpm --filter @riflebird/core build
```

## Testing Standards

We follow Test-Driven Development (TDD) practices:

1. **Write tests first**: Create failing tests before implementing features
2. **Red-Green-Refactor**: Write failing test → Make it pass → Refactor
3. **Test coverage**: Aim for 70%+ coverage (lines, functions, branches, statements)
4. **No `any` types**: Use proper TypeScript types in tests
5. **Mock external dependencies**: Use Vitest's mocking capabilities

### Test File Naming

- Unit tests: `*.spec.ts` or `*.test.ts`
- Place tests in `__tests__/` directory next to source files

### Example Test Structure

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myFunction } from '../my-module';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should return expected value', () => {
      const result = myFunction('input');
      expect(result).toBe('expected');
    });

    it('should throw error on invalid input', () => {
      expect(() => myFunction('')).toThrow('Invalid input');
    });
  });
});
```

## TypeScript Conventions

### Type Definitions (CRITICAL)

- **Always use `type` instead of `interface`**
- **Always export types** - never define internal-only types
- **No `any` types allowed** - use `unknown` for untrusted input
- **Avoid `as unknown as` casting** - use type guards instead
- **Export named types for public APIs** - no inline type literals
- Prefix unused parameters with underscore: `_param`

```typescript
// ✅ Correct
export type UserOptions = {
  name: string;
  age: number;
};

export type CommandHandler = (options: UserOptions) => Promise<void>;

// Type guard for validation
export type User = { id: string; name: string };

function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null &&
         'id' in value && typeof value.id === 'string' &&
         'name' in value && typeof value.name === 'string';
}

export function parseUser(data: unknown): User {
  if (!isUser(data)) {
    throw new Error('Invalid user data');
  }
  return data;
}

// ❌ Incorrect
interface UserOptions {  // Don't use interface
  name: string;
}

type InternalConfig = {  // Not exported
  secret: string;
};

function handler(options: any) {}  // Using any

const user = data as unknown as User;  // Unsafe casting

export function login(opts: { username: string }): Promise<void> {}  // Inline type
```

### Performance & Complexity

- **Prefer O(1) and O(log n)** algorithms over O(n) when possible
- **AVOID O(n²)** - use Maps, Sets, or proper indexing instead of nested loops
- **Use appropriate data structures**:
  - `Map` for key-value lookups (O(1)) instead of `Array.find()` (O(n))
  - `Set` for membership checks (O(1)) instead of `Array.includes()` (O(n))
- **Batch operations** - single pass instead of multiple iterations
- **Document complexity** for non-trivial algorithms: `// O(n log n) - sort + binary search`

```typescript
// ❌ O(n²) - Array.includes inside loop
for (const item of items) {
  if (existingIds.includes(item.id)) { /* ... */ }
}

// ✅ O(n) - Use Set for O(1) lookups
const existingIdsSet = new Set(existingIds);
for (const item of items) {
  if (existingIdsSet.has(item.id)) { /* ... */ }
}

// ❌ Multiple O(n) passes
const filtered = items.filter(x => x.active);
const mapped = filtered.map(x => x.value);
const sum = mapped.reduce((a, b) => a + b, 0);

// ✅ Single O(n) pass
const sum = items.reduce((acc, x) => 
  x.active ? acc + x.value : acc, 0);
```

### Import Conventions

Use domain-specific path aliases:

```typescript
import type { RiflebirdConfig } from '@config/schema';
import { createAIClient } from '@helpers/ai-client';
import type { ChatMessage } from '@models/chat';
import { findProjectRoot } from '@utils/project-paths';
import { PlaywrightAdapter } from '@adapters/playwright';
```

## CI/CD Pipeline

### Automated Checks

Every push and pull request runs:

1. **Type checking** - Ensures TypeScript compiles without errors
2. **Linting** - Checks code style and potential issues
3. **Unit tests** - Runs all tests with coverage reporting
4. **Build** - Verifies packages build successfully

Tests run on Node.js 18.x and 20.x.

### Coverage Requirements

- Minimum 70% coverage for lines, functions, branches, and statements
- Coverage reports are uploaded to Codecov
- Coverage reports are generated in `coverage/` directory (gitignored)

## Pull Request Process

1. **Create a feature branch**: `git checkout -b feat/your-feature-name`
2. **Write tests first**: Follow TDD principles
3. **Implement the feature**: Make tests pass
4. **Run all checks locally**:
   ```bash
   pnpm lint
   pnpm --filter @riflebird/core run type-check
   pnpm test -- --run
   pnpm build
   ```
5. **Commit with descriptive messages**: Follow conventional commits
6. **Push and create PR**: Provide clear description of changes
7. **Wait for CI**: All checks must pass before merge
8. **Address review feedback**: Make requested changes

## Project Structure

```
riflebird/
├── packages/
│   ├── core/               # Core framework logic
│   │   ├── src/
│   │   │   ├── models/     # Type definitions
│   │   │   ├── helpers/    # Helper functions
│   │   │   ├── utils/      # Utility functions
│   │   │   ├── config/     # Configuration handling
│   │   │   ├── adapters/   # Framework adapters
│   │   │   └── commands/   # CLI commands
│   │   └── __tests__/      # Test files
│   └── cli/                # CLI package
├── .github/
│   └── workflows/          # CI/CD workflows
└── scripts/                # Build scripts
```

## Architecture Guidelines

### Adapter Pattern

- Each testing framework has its own adapter implementing `TestFrameworkAdapter`
- Playwright: Full programmatic execution
- Cypress: Code generation only (framework limitation)

### Configuration

- Zod-first validation in `config/schema.ts`
- Runtime validation with type safety via `z.infer`
- Environment variables for sensitive data (API keys)

### AI Integration

- OpenAI SDK for OpenAI provider
- Fetch API for local/Ollama provider
- Temperature defaults to 0.2 for deterministic output

## Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check README and inline code comments

## AI Coding Assistants

If you're using AI coding assistants, refer to these configuration files:

- **`.github/copilot-instructions.md`** - GitHub Copilot specific rules
- **`.cursorrules`** - Cursor AI rules
- **`.ai/rules.md`** - Universal rules for all AI assistants (recommended)
- **`.aider.conf.yml`** - Aider AI configuration

These files contain comprehensive coding standards including TypeScript rules, performance optimization guidelines, and TDD requirements that AI assistants will follow automatically.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
