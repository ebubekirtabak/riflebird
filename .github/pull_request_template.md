## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Please check the one that applies to this PR using "x". -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style update (formatting, renaming)
- [ ] ♻️ Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Build configuration change
- [ ] 🔨 Development tools change

## Related Issue

<!-- Link to the issue this PR addresses -->

Closes #(issue number)

## Changes Made

<!-- List the main changes in this PR -->

- 
- 
- 

## Testing

<!-- Describe the tests you ran to verify your changes -->

### Test Commands Run

```bash
# Add the commands you ran
pnpm lint
pnpm --filter @riflebird/core run type-check
pnpm test -- --run
pnpm build
```

### Test Coverage

- [ ] All new code is covered by tests
- [ ] All tests pass locally
- [ ] Coverage thresholds are met (70%+)

## Checklist

<!-- Please check all that apply using "x" -->

- [ ] My code follows the TypeScript conventions in CONTRIBUTING.md
  - [ ] Used `type` instead of `interface`
  - [ ] All types are exported
  - [ ] No `any` types used
  - [ ] Used domain-specific import aliases (@models, @helpers, etc.)
- [ ] I have followed TDD principles (tests written first)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)

<!-- Add screenshots to help explain your changes -->

## Additional Notes

<!-- Add any other context about the PR here -->
