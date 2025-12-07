<p align="center">
  <img src=".github/riflebird-logo.svg" alt="Riflebird Logo" width="200" height="200">
</p>

<h1 align="center">Riflebird</h1>

<p align="center">
  <a href="https://github.com/ebubekirtabak/riflebird/actions/workflows/test.yml">
    <img src="https://github.com/ebubekirtabak/riflebird/actions/workflows/test.yml/badge.svg" alt="Test">
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

Quick overview of current capabilities and roadmap status:

| Test Type | Status | Success Rate | Notes |
|---|:---:|:---:|---|
| Unit Testing | ⚠️ Beta | ~70% | Integrated (beta). Needs improved selector robustness and assertion coverage. |
| Integration Testing | ❌ Planned | N/A | Planned — working on test harness and mocks. |
| End-to-end (E2E) | ❌ Planned | N/A | Playwright/Cypress adapters exist; end-to-end automation improvements planned. |
| Performance Testing | ❌ Planned | N/A | Performance harness integration (e.g., Artillery/JMeter) is on the roadmap. |
| Accessibility Testing | ❌ Planned | N/A | Axe/pa11y integration planned for automated accessibility checks. |
| Visual Testing | ❌ Planned | N/A | AI-powered visual regression prototypes exist; improving heuristics and thresholds. |

Legend: ✅ Supported · ⚠️ Beta/Experimental/In progress · ❌ Planned



## Installation

```bash
npm install -g riflebird
# or
pnpm add -g riflebird
```

### Tested LLM Models (example results)

These are internal, approximate success rates for Riflebird's test-generation tasks on a small benchmark (your mileage may vary). Percentages measure how often generated tests compile and run with correct assertions on our validation set.

| Model | Provider | Tested For | Success Rate | Notes |
|---|---|---:|---:|---|
| Gemini 3 Pro | Google | Test generation (unit / e2e) | N/A | 
| GPT-4 | OpenAI | Test generation (unit / e2e) | N/A | 
| GPT-4o | OpenAI | Test generation | N/A | |
| gpt-3.5-turbo | OpenAI | Test generation | N/A |  |
| Claude 2 | Anthropic | Test generation | N/A | |
| Llama 2 (qwen3-coder:480b-cloud) | Planned | Test generation | 50% | Unit test may generate for small non-complex components. |
| Mistral Large | Mistral | Test generation | N/A |  |

Notes:
- Success rates are approximate and reflect internal validation on representative snippets.
- We'll add reproducible benchmarks and links as we expand the test-suite and CI-run data.


## Quick Start

1. Initialize Riflebird in your project:
```bash
riflebird init
```

2. Generate a test for all files:
```bash
riflebird fire --all
```

or Generate a test for single file:
```bash
riflebird fire ./src/components/card/PeopleCard/PeopleCard.component.tsx
```

## Features

- 🎯 **AI-Powered Test Generation** - Describe tests in natural language
- 🔄 **Self-Healing** - Automatically fix broken tests
- 🎨 **Visual Testing** - AI-powered visual regression testing
- 🧠 **Smart Selectors** - Intelligent element targeting
- 🚀 **Multi-Framework** - Supports Playwright, Cypress, Puppeteer, WebdriverIO

## Commands

- `riflebird init` - Initialize configuration
- `riflebird fire [path]` - Generate test from description

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
