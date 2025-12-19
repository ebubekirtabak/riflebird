# Architecture Overview

**Core Design Pattern: Adapter-Based Framework Abstraction**

- `packages/core/src/riflebird.ts` - Main orchestrator class that coordinates AI, config, and framework adapters
- `packages/core/src/adapters/` - Framework-specific implementations (Playwright, Cypress) implementing `TestFrameworkAdapter` interface
- **Key Distinction**: Playwright adapter executes tests programmatically; Cypress adapter generates test code (Cypress doesn't support programmatic execution)

**Configuration Flow**:

1. `riflebird.config.ts` (root) → User-facing config with AI settings, framework selection, test generation options
2. `packages/core/src/config/loader.ts` → Dynamically imports config via `pathToFileURL`, validates with Zod schema
3. `packages/core/src/config/schema.ts` → Single source of truth for all config validation using Zod schemas

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

## Extension Points

**Adding New Adapters**:

1. Create `packages/core/src/adapters/your-framework.ts`
2. Implement `TestFrameworkAdapter` interface
3. Add framework to `FrameworkSchema` enum in `schema.ts`
4. Add case in `Riflebird.createAdapter()`

**Self-Healing Strategy** (planned):

- `healing.strategy`: 'smart' | 'visual' | 'text' | 'hybrid'
- Hook into `Riflebird.reload()` method (currently stub)
