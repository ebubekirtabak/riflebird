# AI Coding Rules for Riflebird

**Riflebird**: AI-powered test generation and execution framework for unit, integration, E2E, visual, and performance testing.

This directory contains standardized AI coding rules that work across different AI-powered IDEs and coding assistants.

## Supported AI Assistants

- **GitHub Copilot**: Uses `../.github/copilot-instructions.md`
- **Cursor**: Uses `../.cursorrules`
- **Cody (Sourcegraph)**: Uses `.cody/config.yaml`
- **Continue**: Uses `.continue/config.json`
- **Aider**: Uses `../.aider.conf.yml`
- **All others**: Use `rules.md` (universal format)

## Files Overview

### Universal Rules
- **`rules.md`** - Comprehensive coding standards in markdown format
  - Works with: Any AI assistant that reads markdown context
  - Content: TypeScript rules, performance optimization, TDD guidelines
  - Format: Human-readable markdown with code examples

### AI-Specific Configurations

#### GitHub Copilot
- **File**: `../.github/copilot-instructions.md`
- **Format**: Markdown instructions
- **Loaded**: Automatically by GitHub Copilot in VS Code
- **Scope**: Repository-wide

#### Cursor
- **File**: `../.cursorrules`
- **Format**: Plain text with markdown-style formatting
- **Loaded**: Automatically by Cursor IDE
- **Scope**: Project-wide

#### Cody (Sourcegraph)
- **File**: `.cody/config.yaml`
- **Format**: YAML configuration
- **Features**: Context files, enhanced context, ignore patterns
- **Loaded**: Automatically by Cody extension

#### Continue
- **File**: `.continue/config.json`
- **Format**: JSON configuration
- **Features**: Pattern-based rules, context files, commands
- **Loaded**: Automatically by Continue extension

#### Aider
- **File**: `../.aider.conf.yml`
- **Format**: YAML configuration
- **Features**: Model selection, git integration, test/lint commands
- **Usage**: Command-line AI coding assistant

## Key Rules Summary

### 🚨 Critical TypeScript Rules
1. **Use `type` not `interface`** - Always
2. **Export all types** - No internal-only types
3. **No `any` types** - Use `unknown` with type guards
4. **Avoid unsafe casting** - No `as unknown as`
5. **Export named types** - No inline type literals for public APIs

### ⚡ Performance Rules
1. **Prefer O(1) and O(log n)** over O(n)
2. **Avoid O(n²)** - Use Maps/Sets instead of nested loops
3. **Use Set** for membership checks (O(1)) vs `Array.includes()` (O(n))
4. **Use Map** for lookups (O(1)) vs `Array.find()` (O(n))
5. **Batch operations** - Single pass instead of multiple iterations

### 🧪 Testing Rules
1. **TDD Required** - Write tests before implementation
2. **Red-Green-Refactor** - Failing test → pass → refactor
3. **One concept per test** - Single assertion focus
4. **Fast tests** - Unit tests in milliseconds
5. **Mock dependencies** - No external I/O in unit tests

## Usage Examples

### For Contributors
When contributing to Riflebird, your AI assistant will automatically use these rules:

```bash
# GitHub Copilot: Just open the project in VS Code
# Cursor: Open the project, rules auto-loaded
# Cody: Install Cody extension, rules auto-applied
# Continue: Install Continue extension, rules auto-applied
# Aider: Run from project directory
aider --config .aider.conf.yml
```

### For Maintainers
To update rules across all AI assistants:

1. Update `rules.md` (universal rules)
2. Update AI-specific configs if needed:
   - GitHub Copilot: `../.github/copilot-instructions.md`
   - Cursor: `../.cursorrules`
   - Cody: `.cody/config.yaml`
   - Continue: `.continue/config.json`
   - Aider: `../.aider.conf.yml`

## Testing AI Rules

To verify AI assistants are following rules:

1. **Type Safety**: Ask AI to create a new type
   - ✅ Should use `export type` not `interface`
   - ✅ Should export the type
   - ❌ Should never use `any`

2. **Performance**: Ask AI to filter an array in a loop
   - ✅ Should suggest using `Set` for lookups
   - ❌ Should not create O(n²) solutions

3. **TDD**: Ask AI to add a new feature
   - ✅ Should write test first
   - ✅ Should follow Red-Green-Refactor
   - ✅ Should mock dependencies

## Additional Resources

- **Main Documentation**: `../README.md`
- **Contributing Guide**: `../CONTRIBUTING.md`
- **Fire Command Docs**: `../docs/FIRE_COMMAND.md`
- **Security Guide**: `../packages/core/src/security/README.md`

## Maintenance

These rules should be reviewed and updated when:
- TypeScript conventions change
- Performance requirements evolve
- Testing strategies improve
- New AI assistants are adopted
- Project architecture changes

Last updated: December 2025
