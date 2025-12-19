# Build & Development

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
