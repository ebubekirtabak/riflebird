# Key Workflows

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
