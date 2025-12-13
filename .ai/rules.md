# AI Coding Rules for Riflebird

> **Universal rules for all AI coding assistants**
> Compatible with: GitHub Copilot, Cursor, Cody, Continue, Aider, and others

## Project Context

Riflebird is an AI-powered test generation and execution framework that supports:
- **Unit Testing**: Vitest, Jest, Mocha, AVA
- **Integration Testing**: (Planned)
- **E2E Testing**: Playwright, Cypress, Puppeteer, WebdriverIO
- **Visual Testing**: AI-powered visual regression (Planned)
- **Performance Testing**: Performance harness integration (Planned)

**Architecture**: Adapter-based framework abstraction with Zod validation
**Build System**: pnpm workspace + Turborepo
**Language**: TypeScript (strict mode)
**Testing**: Vitest with TDD approach

---

## 🚨 Critical TypeScript Rules

### 1. Type vs Interface
```typescript
// ✅ ALWAYS use type
export type User = { id: string; name: string };

// ❌ NEVER use interface
interface User { id: string; name: string; }
```

### 2. Export All Types
```typescript
// ✅ CORRECT - exported type
export type Options = { enabled: boolean };

// ❌ INCORRECT - internal type
type Options = { enabled: boolean };
```

### 3. No `any` Types
```typescript
// ✅ CORRECT - use unknown with type guards
export function handle(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Expected string');
  }
  return input;
}

// ❌ INCORRECT - any bypasses type safety
function handle(input: any): string {
  return input;
}
```

### 4. No Unsafe Type Casting
```typescript
// ✅ CORRECT - type guard validation
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null &&
         'id' in value && typeof value.id === 'string';
}

export function parseUser(data: unknown): User {
  if (!isUser(data)) throw new Error('Invalid user');
  return data;
}

// ❌ INCORRECT - unsafe casting
const user = data as unknown as User;
```

### 5. Named Exported Types
```typescript
// ✅ CORRECT - named exported type
export type LoginOptions = { username: string; password: string };
export function login(opts: LoginOptions): Promise<void> {}

// ❌ INCORRECT - inline type literal
export function login(opts: { username: string; password: string }): Promise<void> {}
```

---

## ⚡ Performance & Complexity Rules

### Algorithm Complexity Guidelines

**Priority**: O(1) > O(log n) > O(n) > O(n log n) > **AVOID O(n²)**

### 1. Use Appropriate Data Structures

```typescript
// ❌ O(n²) - Nested loop with Array.includes
for (const item of items) {
  if (existingIds.includes(item.id)) {
    // ...
  }
}

// ✅ O(n) - Use Set for O(1) lookups
const existingIdsSet = new Set(existingIds);
for (const item of items) {
  if (existingIdsSet.has(item.id)) {
    // ...
  }
}
```

### 2. Batch Operations - Single Pass

```typescript
// ❌ Multiple O(n) passes (O(3n) → O(n) but inefficient)
const filtered = items.filter(x => x.active);
const mapped = filtered.map(x => x.value);
const sum = mapped.reduce((a, b) => a + b, 0);

// ✅ Single O(n) pass
const sum = items.reduce((acc, x) =>
  x.active ? acc + x.value : acc, 0);
```

### 3. Early Termination

```typescript
// ❌ Processes entire array even after finding result
const hasActive = items.filter(x => x.active).length > 0;

// ✅ Stops at first match
const hasActive = items.some(x => x.active);
```

### 4. Cache Expensive Computations

```typescript
// ❌ Recalculates on every access
get fullName() {
  return this.calculateExpensiveFullName();
}

// ✅ Cache result
private _fullName?: string;
get fullName() {
  if (!this._fullName) {
    this._fullName = this.calculateExpensiveFullName();
  }
  return this._fullName;
}
```

### 5. Document Complexity

```typescript
// ✅ Document non-trivial complexity
// O(n log n) - Sort entries then binary search for duplicates
export function findDuplicates(items: string[]): string[] {
  const sorted = items.sort(); // O(n log n)
  // Binary search logic...
}
```

### Data Structure Quick Reference

| Operation | Bad (O(n)) | Good (O(1) or O(log n)) |
|-----------|------------|-------------------------|
| Lookup | `array.find()` | `map.get()` |
| Membership | `array.includes()` | `set.has()` |
| Insert/Delete | Array splice | Map/Set |
| Search sorted | Linear search | Binary search O(log n) |

---

## 🧪 Test-Driven Development (TDD)

### Red-Green-Refactor Cycle

1. **Red**: Write a failing test that defines desired behavior
2. **Green**: Write minimal code to make test pass
3. **Refactor**: Improve code while keeping tests green

### TDD Requirements

```typescript
// ✅ Test BEFORE implementation
describe('UserService', () => {
  it('should throw error for invalid email', () => {
    expect(() => createUser({ email: 'invalid' }))
      .toThrow('Invalid email format');
  });
});

// Then implement
export function createUser(data: UserInput): User {
  if (!isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }
  // ...
}
```

### Test Quality Standards

- **One concept per test**: Each test asserts one behavior
- **Descriptive names**: Use Given/When/Then or natural language
- **Fast execution**: Unit tests in milliseconds (no I/O)
- **Deterministic**: No flakiness - mock time, randomness, I/O
- **Test interface, not implementation**: Assert public behavior

### Test Commands

```bash
# Run tests
pnpm --filter @riflebird/core test

# Run with coverage
pnpm test -- --run --coverage

# Type check
pnpm --filter @riflebird/core run type-check
```

---

## 📝 Code Conventions

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `rifle-bird-config.ts`)
- **Types**: `PascalCase` (e.g., `UserOptions`, `TestType`)
- **Functions/Variables**: `camelCase` (e.g., `getUserData`, `isActive`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `API_VERSION`)
- **Unused params**: Prefix with `_` (e.g., `_unusedParam`)

### Error Handling

```typescript
// ✅ CORRECT - Type-safe error handling
try {
  await riskyOperation();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Operation failed: ${message}`);
  throw error; // Re-throw with context
}

// ❌ INCORRECT - any in catch
catch (error: any) {
  console.error(error.message); // Unsafe
}
```

### Import Organization

```typescript
// 1. External dependencies
import { z } from 'zod';
import { describe, it, expect } from 'vitest';

// 2. Internal path aliases
import type { RiflebirdConfig } from '@riflebird/core';
import { loadConfig } from '@riflebird/core/config';

// 3. Relative imports
import type { TestAdapter } from './adapters/base';
import { validateInput } from './validators';
```

---

## 🏗️ Architecture Guidelines

### Adapter Pattern

- Playwright: Full programmatic execution
- Cypress: Code generation only (no programmatic API)
- All adapters implement `TestFrameworkAdapter` interface

### Configuration

- **Zod-first**: All validation uses Zod schemas
- **Type inference**: `z.infer<typeof Schema>`
- **Environment**: Never hardcode API keys - use `process.env`

### Key Files

```
packages/core/src/
├── riflebird.ts              # Main orchestrator
├── adapters/                 # Framework adapters
│   ├── base.ts              # TestFrameworkAdapter interface
│   ├── playwright.ts        # Playwright implementation
│   └── cypress.ts           # Cypress implementation
├── config/
│   ├── schema.ts            # Zod validation schemas
│   └── loader.ts            # Config loading logic
└── commands/                 # Command implementations
    └── fire-command.ts      # Test execution command
```

---

## 🔧 Development Workflow

### Build & Test

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode with watch
pnpm dev

# Run all tests
pnpm test -- --run

# Run tests with coverage
pnpm test -- --run --coverage

# Lint
pnpm lint

# Type check
pnpm type-check
```

### Pre-Commit Checklist

- [ ] All tests pass (`pnpm test -- --run`)
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] No ESLint warnings (`pnpm lint`)
- [ ] New code has tests (TDD approach)
- [ ] Types are exported and properly defined
- [ ] Performance-critical code uses optimal data structures
- [ ] Complexity documented for non-trivial algorithms

---

## 🎯 Quality Standards

### Must Pass

1. **TypeScript strict mode** - no type errors
2. **ESLint** - zero warnings or errors
3. **Tests** - 100% of new code covered
4. **Type safety** - no `any`, proper type guards
5. **Performance** - avoid O(n²), use appropriate data structures

### Code Review Focus

- Are types exported and properly defined?
- Is complexity optimal (no O(n²) when O(n) possible)?
- Are tests written before implementation?
- Is error handling type-safe?
- Are external inputs validated with type guards?

---

## 📚 Additional Resources

- [Fire Command Documentation](../docs/FIRE_COMMAND.md)
- [Security & Secret Sanitization](../packages/core/src/security/README.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

**Last Updated**: December 2025
**Maintained By**: Riflebird Team
**License**: MIT
