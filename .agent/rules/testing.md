# Testing Strategy

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

## Quick Commands

```bash
# Run core package tests
pnpm --filter @riflebird/core test

# Run type-checks
pnpm --filter @riflebird/core run type-check
```
