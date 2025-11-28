# Riflebird AI Agent Instructions

Riflebird is an AI-powered E2E testing framework that generates, executes, and heals tests across multiple testing frameworks (Playwright, Cypress, Puppeteer, WebdriverIO).

## Architecture Overview

**Core Design Pattern: Adapter-Based Framework Abstraction**
- `packages/core/src/riflebird.ts` - Main orchestrator class that coordinates AI, config, and framework adapters
- `packages/core/src/adapters/` - Framework-specific implementations (Playwright, Cypress) implementing `TestFrameworkAdapter` interface
- **Key Distinction**: Playwright adapter executes tests programmatically; Cypress adapter generates test code (Cypress doesn't support programmatic execution)

**Configuration Flow**:
1. `riflebird.config.ts` (root) → User-facing config with AI settings, framework selection, test generation options
2. `packages/core/src/config/loader.ts` → Dynamically imports config via `pathToFileURL`, validates with Zod schema
3. `packages/core/src/config/schema.ts` → Single source of truth for all config validation using Zod schemas

## Key Workflows

**Test Generation (`aim` command)**:
```typescript
// Flow: User description → AI test plan → Framework-specific code
Riflebird.aim(description) → generateTestPlan() → adapter.generateTestCode()
```
- AI generates structured `TestPlan` (steps + assertions) via OpenAI/Anthropic
- Adapter transforms plan into framework syntax (see `PlaywrightAdapter.generateTestCode()`)
- Output saved to `generation.outputDir` (default: `tests/e2e/`)

**Adapter Implementation Rules**:
- Playwright: Implements all methods (actual browser automation)
- Cypress: Throws errors for action methods, only implements `generateTestCode()` (code generation only)
- See `packages/core/src/adapters/base.ts` for required `TestFrameworkAdapter` interface

## Build & Development

**Monorepo Structure** (pnpm workspace):
- Use `pnpm` (version 10.23.0) - specified in `packageManager` field
- Turborepo for task orchestration: `pnpm dev`, `pnpm build`, `pnpm test`
- Single package currently: `packages/core/` (extensible for CLI, plugins)

**No turbo.json**: Turbo uses default conventions. Add `turbo.json` if custom pipeline needed.

## Configuration Patterns

**Zod-First Validation**:
- All config in `schema.ts` uses Zod for runtime validation
- Type safety via `z.infer<typeof RiflebirdConfigSchema>`
- Optional sections (per-framework configs) validated only when framework is selected

**Environment Variables**:
- API keys loaded from env: `process.env.OPENAI_API_KEY`, `process.env.ANTHROPIC_API_KEY`
- Never hardcode API keys in config files

## Critical Integration Points

**AI Provider Integration** (`riflebird.ts`):
- OpenAI SDK initialized in `Riflebird.init()`
- Temperature defaults to 0.2 for deterministic test generation
- System prompt includes framework name for context-aware code generation

**Adapter Selection** (runtime):
```typescript
// Framework chosen at runtime via config.framework
this.adapter = this.createAdapter(); // Returns PlaywrightAdapter | CypressAdapter
```

## Naming & Code Conventions

- **File naming**: kebab-case for files (`rifle-bird-config.ts`)
- **Test naming**: Configurable via `generation.naming` (kebab-case | camelCase | PascalCase)
- **Imports**: Use TypeScript path aliases from `@riflebird/core`
- **Error handling**: Throw descriptive errors (see adapter methods for examples)

## TypeScript Conventions

**Type Definitions**:
- **Always use `type` instead of `interface`** for all type definitions
- **Always export types** - never define internal-only types
- Prefix unused parameters with underscore: `_param`
- **No `any` types allowed** - ESLint enforces `@typescript-eslint/no-explicit-any: error`

Additional strict TypeScript rules
- **Avoid `any` entirely**: Prefer `unknown` for external/untrusted input and narrow it with type guards.
  - Use explicit types, generics, or union types instead of `any`.
  - When interacting with third-party libraries that expose `any`, wrap or adapt their surface with well-typed adapters.
- **Always export named types for public-facing shapes**: Do not use inline type literals for function parameters, return values, or exported APIs.
  - Named, exported types improve discoverability, reuse, and documentation.
  - Example (preferred):
    ```ts
    export type LoginOptions = { username: string; password: string };

    export function login(opts: LoginOptions): Promise<void> { /* ... */ }
    ```
  - Example (avoid):
    ```ts
    // ❌ Avoid inline type literal
    export function login(opts: { username: string; password: string }): Promise<void> { }
    ```
- **Do not implement inline types** inside complex values (objects, arrays, or nested shapes).
  - If a type is used in more than one place or is part of the public surface, extract and export it.
  - For deeply nested shapes, define internal helper types (exported if part of public API) instead of embedding inline object types.

Type guidance and examples
- Use `unknown` in API boundaries and assert/validate before using values:
  ```ts
  export function handle(input: unknown) {
    if (typeof input === 'string') {
      // narrow to string
    }
  }
  ```
- For third-party responses, map into well-typed domain objects immediately:
  ```ts
  // map external response to exported type
  export type User = { id: string; name: string };

  function mapExternalUser(resp: unknown): User {
    // validate and return User
  }
  ```

**Examples**:
```typescript
// ✅ Correct
export type UserOptions = {
  name: string;
  age: number;
};

export type CommandHandler = (options: UserOptions) => Promise<void>;

// ❌ Incorrect - Don't use interface
interface UserOptions {
  name: string;
}

// ❌ Incorrect - Don't use unexported types
type InternalConfig = {
  secret: string;
};

// ❌ Incorrect - Don't use any
function handler(options: any) {}
```

**Error Handling**:
```typescript
// ✅ Correct - Type-safe error handling
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
}

// ❌ Incorrect - Using any
catch (error: any) {
  console.error(error.message);
}
```

## Extension Points

**Adding New Adapters**:
1. Create `packages/core/src/adapters/your-framework.ts`
2. Implement `TestFrameworkAdapter` interface
3. Add framework to `FrameworkSchema` enum in `schema.ts`
4. Add case in `Riflebird.createAdapter()`

**Self-Healing Strategy** (planned):
- `healing.strategy`: 'smart' | 'visual' | 'text' | 'hybrid'
- Hook into `Riflebird.reload()` method (currently stub)

## Testing Strategy

- Generated tests output to `generation.outputDir` (configurable)
- Playwright tests run directly via adapter
- Cypress tests require external `cypress run` command (framework limitation)

## TDD-Based Development

Adopt Test-Driven Development (TDD) as the default workflow for new features and bug fixes.
- **Red-Green-Refactor cycle:** write a failing test first (red), implement the minimal code to make it pass (green), then refactor for clarity and reuse (refactor).
- **Write tests before implementation:** every behavior or API change must begin with a test that demonstrates the expected behavior.
- **Keep tests fast and focused:** unit tests should run in milliseconds and not rely on external services. Use integration/e2e tests sparingly and run them in CI or local feature branches.
- **One assertion concept per test:** each test should assert one behavior or outcome to keep failures clear.
- **Tests are code:** follow the same quality rules as production code — readable, well-typed, and documented when non-obvious.
- **Deterministic tests:** avoid flakiness by mocking external I/O, controlling randomness, and using fixed time when needed.
- **Test interfaces not implementations:** prefer asserting the public contract/behavior rather than internal structure, which makes refactors safer.
- **Commit tests with code:** do not merge code that adds behavior without its tests. PRs should show the failing-then-passing test evolution when practical.
- **CI enforcement:** CI should run the full test suite and prevent merges if tests fail. Fast unit tests should run on every push; slower integration/e2e suites can be scheduled or gated.
- **Mock and inject dependencies:** design modules to allow dependency injection for easier testing and clearer mocks.
- **Use descriptive test names:** write test descriptions that read like behavior specs (Given/When/Then or natural-language sentences).
- **Refactor tests when APIs change:** update tests to reflect improved APIs, keeping historical intent in commit messages if behavior is intentionally changed.

Quick commands:
```bash
# Run core package tests
pnpm --filter @riflebird/core test

# Run type-checks
pnpm --filter @riflebird/core run type-check
```
