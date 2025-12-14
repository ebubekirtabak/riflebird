# Git Hooks Configuration

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks for maintaining code quality and preventing broken code from being committed or pushed.

## Available Hooks

### 1. **pre-commit** 
Runs before each commit is created.

**What it does:**
- Runs `lint-staged` to lint and fix TypeScript/TSX files
- Automatically fixes code style issues with ESLint

**Files checked:**
- `*.ts`
- `*.tsx`

**How to bypass (not recommended):**
```bash
git commit --no-verify -m "your message"
```

### 2. **commit-msg**
Validates commit messages to follow [Conventional Commits](https://www.conventionalcommits.org/) format.

**Required format:**
```
type(scope?): subject

Examples:
✅ feat: add new test generation feature
✅ fix(core): resolve test output directory issue
✅ docs: update README with new examples
✅ test(cli): add unit tests for init command
✅ refactor: restructure file utilities

❌ added new feature (missing type)
❌ feat add feature (missing colon)
❌ FIX: bug (type must be lowercase)
```

**Allowed types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes
- `build` - Build system changes
- `revert` - Revert previous commit

**How to bypass (not recommended):**
```bash
git commit --no-verify -m "your message"
```

### 3. **pre-push** ⚡
Runs before code is pushed to remote repository.

**What it does:**
- Runs all unit tests across all packages (using Turbo)
- Prevents push if any tests fail
- Shows test results and which tests failed

**Estimated time:** ~3-5 seconds (with cache)

**Example output:**
```bash
🧪 Running unit tests before push...

@riflebird/core:test: ✓ 450 tests passed
riflebird:test: ✓ 19 tests passed

✅ All tests passed!
```

**If tests fail:**
```bash
🧪 Running unit tests before push...

@riflebird/core:test: ✗ 2 tests failed
❌ Unit tests failed. Push aborted.
```

**How to bypass (not recommended):**
```bash
git push --no-verify
```

## Setup

Hooks are automatically installed when you run:

```bash
pnpm install
```

This is handled by the `prepare` script in `package.json` which runs `husky` after installation.

## Manual Hook Installation

If hooks aren't working, you can manually reinstall them:

```bash
# Reinstall Husky hooks
pnpm run prepare

# Make hooks executable (if needed)
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
```

## Troubleshooting

### Hook not running
1. Check if hook file is executable: `ls -la .husky/`
2. Make it executable: `chmod +x .husky/<hook-name>`
3. Ensure Git hooks are enabled: `git config core.hooksPath .husky`

### Tests failing in pre-push
1. Run tests locally first: `pnpm test -- --run`
2. Fix failing tests before pushing
3. Ensure all dependencies are installed: `pnpm install`

### Commit message validation fails
Ensure your commit message follows the format:
- Must start with allowed type (feat, fix, docs, etc.)
- Include colon and space after type
- Have a meaningful subject

## Best Practices

1. **Don't bypass hooks** - They exist to maintain code quality
2. **Fix issues locally** - Don't push failing tests or linting errors
3. **Write meaningful commit messages** - Follow conventional commits
4. **Run tests before committing** - Catch issues early: `pnpm test`
5. **Keep hooks fast** - If pre-push becomes slow, optimize tests

## CI/CD Integration

These Git hooks provide a **first line of defense** before code reaches CI/CD:

- **pre-commit**: Prevents formatting/linting issues
- **commit-msg**: Ensures consistent commit history
- **pre-push**: Catches test failures before they reach CI

The CI pipeline will run these checks again, but hooks catch issues faster and save CI minutes.

## Updating Hooks

To modify hooks, edit the files in `.husky/` directory:

```bash
# Edit pre-push hook
vim .husky/pre-push

# After editing, ensure it's executable
chmod +x .husky/pre-push
```

## Dependencies

- **husky**: ^9.1.7 - Git hooks manager
- **lint-staged**: ^16.2.7 - Run linters on staged files
- **eslint**: ^9.39.1 - TypeScript/JavaScript linter
- **vitest**: ^1.6.1 - Unit test runner

## See Also

- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [lint-staged](https://github.com/okonet/lint-staged)
