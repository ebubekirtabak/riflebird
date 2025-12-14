<p align="center">
  <img src=".github/riflebird-logo.png" alt="Riflebird Logo" width="200" height="200">
</p>

<h1 align="center">Riflebird</h1>

<p align="center">
  <a href="https://github.com/ebubekirtabak/riflebird/actions/workflows/test.yml">
    <img src="https://github.com/ebubekirtabak/riflebird/actions/workflows/test.yml/badge.svg" alt="Test">
  </a>
  <a href="https://codecov.io/gh/ebubekirtabak/riflebird">
    <img src="https://codecov.io/gh/ebubekirtabak/riflebird/branch/master/graph/badge.svg" alt="Coverage">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
  <a href="https://www.npmjs.com/package/riflebird">
    <img src="https://img.shields.io/npm/v/riflebird.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/riflebird">
    <img src="https://img.shields.io/npm/dm/riflebird.svg" alt="npm downloads">
  </a>
</p>

<p align="center">
  AI-driven test generation and execution platform — automatically produces
  unit, integration, end-to-end (E2E), performance, accessibility, and visual
  tests. Built with self-healing selectors, semantic element targeting,
  multi-framework execution (Playwright, Cypress, Puppeteer, WebdriverIO),
  and CI-friendly outputs to integrate easily into your pipelines.
</p>


## Project Status

For a detailed roadmap including planned features, timelines, and success metrics, see [ROADMAP.md](./ROADMAP.md).

**Current Status Summary**:
- ✅ **Unit Testing**: Beta (90% success rate) - Core functionality working, quality improvements ongoing
- ⚠️ **E2E Testing**: In Progress - Adapters exist, full implementation in progress
- ⚠️ **Visual Testing**: In Progress - AI-powered regression detection in development
- ❌ **Performance Testing**: Planned for v2.0 - Architecture design phase
- ❌ **Accessibility Testing**: Planned for v2.0 - Axe/pa11y integration planned



## Installation

```bash
npm install -g riflebird
# or
pnpm add -g riflebird
```

### LLM Model Performance

Benchmark results from internal testing. Success rate = percentage of generated tests that compile and pass with correct assertions.

| Model | Provider | Test Type | Success Rate | Notes |
|---|---|---:|---:|---|
| claude-sonnet-4.5 (Copilot CLI) | Anthropic | Unit | 99% | Excellent for complex test cases |
| Kimi-k2:1t | Moonshot AI | Unit | 99% | Excellent for complex test cases |
| Devstral 2 | Frontier AI | Unit | 99% | Excellent for complex test cases |
| gpt-5-mini (Copilot CLI) | OpenAI | Unit | 90% | Handles complex components well |
| qwen3-coder:480b-cloud | Alibaba | Unit | 50% | Best for simple components |
| Gemini 3 Pro | Google | Unit / E2E | N/A | Testing in progress |
| GPT-4 | OpenAI | Unit / E2E | N/A | Testing in progress |
| GPT-4o | OpenAI | Unit | N/A | Testing in progress |

*Results based on internal validation; performance may vary by use case.*


## Quick Start

1. Initialize Riflebird in your project:
```bash
riflebird init
```

2. Generate tests for all files:
```bash
riflebird fire --all
```

3. Generate a test for a single file:
```bash
riflebird fire ./src/components/cards/PeopleCard/PeopleCard.component.tsx
```

4. Use scope filtering to target specific file types:
```bash
riflebird fire --all --scope component --unit
```

For more advanced usage including glob patterns, test type filtering, and scope options, see the [Fire Command Documentation](docs/FIRE_COMMAND.md).

## Features

- 🎯 **AI-Powered Test Generation** - Describe tests in natural language
- 🔄 **Self-Healing** - Automatically fix broken tests
- 🎨 **Visual Testing** - AI-powered visual regression testing
- 🧠 **Smart Selectors** - Intelligent element targeting
- 🚀 **Multi-Framework** - Supports Playwright, Cypress, Puppeteer, WebdriverIO
- 🔒 **Secret Sanitization** - Automatically detects and redacts API keys, tokens, and credentials before sending code to LLM providers ([learn more](packages/core/src/security/README.md))

## Commands

- `riflebird init` - Initialize configuration
- `riflebird fire [path]` - Generate and execute tests with flexible filtering options ([detailed documentation](docs/FIRE_COMMAND.md))

### Copilot CLI provider

You can use the GitHub Copilot CLI as an AI provider by setting the AI provider to `copilot-cli`.
Configure the CLI command and any static arguments in your `riflebird.config.ts` under `ai.copilotCli`:

```ts
export default defineConfig({
  ai: {
    provider: 'copilot-cli',
    model: 'gpt-5-mini',
    copilotCli: {
      // `cmd` is fixed to the official `copilot` executable. Configure any
      // static subcommands / flags here.
      args: ['query'], // optional static args
    },
  },
});
```

The CLI provider will feed the chat messages to the command's stdin and interpret stdout as the assistant response. This is useful for local/offline workflows where an external CLI provides AI completions.

## Security

### Automatic Secret Sanitization 🔒

**Humans make mistakes. We've got you covered.**

Riflebird includes a built-in security layer that automatically detects and redacts sensitive data before sending code to AI providers. Even if secrets accidentally end up in your code (we know it happens!), they won't reach the LLM.

#### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR PROJECT FILES                       │
│  📄 api-client.ts                                           │
│     const apiKey = "sk-1234567890abcdef..."                 │
│     const awsKey = "AKIAIOSFODNN7PRODXYZ"                   │
│  📄 config.json                                             │
│     { "githubToken": "ghp_abc123xyz..." }                   │
│  📄 .env                                                    │
│     DATABASE_URL=postgres://user:pass@host/db              │
└────────────┬────────────────────────────────────────────────┘
             │
             │ riflebird fire --all
             ▼
    ┌────────────────────────────────────┐
    │   1. Read Files                    │
    │   ProjectFileWalker                │
    └────────┬───────────────────────────┘
             │
             │ 🔍 Scan for patterns
             ▼
    ┌────────────────────────────────────┐
    │   2. Detect Secrets                │
    │   • API keys (sk-, AKIA...)        │
    │   • Tokens (ghp_, jwt...)          │
    │   • Passwords, DB URLs             │
    │   • SSH keys                       │
    └────────┬───────────────────────────┘
             │
             │ ✂️ Redact values
             ▼
    ┌────────────────────────────────────────────┐
    │   3. Sanitized Code                        │
    │   apiKey = "[REDACTED_API_KEY_3f810a]"     │
    │   awsKey = "[REDACTED_AWS_KEY_f8a2b1]"     │
    │   token = "[REDACTED_GITHUB_TOKEN_4b9d2e]" │
    └────────┬───────────────────────────────────┘
             │
             │ 🔒 Safe to analyze
             ▼
    ┌────────────────────────────────────┐
    │   4. Send to LLM                   │
    │   OpenAI / Anthropic / Local       │
    └────────────────────────────────────┘

             ✅ Your secrets never leave your machine in plaintext
             📊 Only detection stats logged: "Sanitized 3 secrets from api-client.ts"

             NOTE: Sanitization previously performed inside the `ai-client` helper was removed to avoid double-sanitization. Riflebird performs sanitization at a single entry point: `ProjectFileWalker.readFileFromProject()` — all code is sanitized there before being passed to downstream components.
```

**Protected secret types:**
- API Keys (OpenAI, Anthropic, generic)
- AWS Access Keys & Secret Keys
- GitHub Tokens
- SSH Private Keys
- Database URLs (PostgreSQL, MySQL, MongoDB, Redis)
- JWT Tokens
- OAuth Tokens
- Passwords & Environment Variables

**Why this matters:**
- 🔴 Developers accidentally commit secrets (it happens to everyone!)
- 🔴 Test files sometimes contain real credentials during development
- 🔴 Config files may have production passwords temporarily
- 🛡️ **Riflebird protects you automatically** - no configuration needed

**Key features:**
- ✅ Secrets never leave your machine in plaintext
- ✅ Automatic detection with smart false-positive filtering
- ✅ Safe logging (only counts, never actual values)
- ✅ Original files unchanged on disk
- ✅ **Always active** - protection you can forget about

[→ Read full security documentation](packages/core/src/security/README.md)

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development guidelines.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev

# Run tests with coverage
pnpm test -- --run --coverage
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:
- Development setup
- Testing standards (TDD approach)
- Code quality requirements
- TypeScript conventions
- Pull request process

## License

MIT
