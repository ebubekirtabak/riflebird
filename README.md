# Riflebird

AI-powered E2E testing framework with precision and self-healing capabilities.

## Installation

```bash
npm install -g riflebird
# or
pnpm add -g riflebird
```

## Quick Start

1. Initialize Riflebird in your project:
```bash
riflebird init
```

2. Generate a test from natural language:
```bash
riflebird aim "Test user login with valid credentials"
```

3. Run the generated test:
```bash
riflebird fire
```

## Features

- 🎯 **AI-Powered Test Generation** - Describe tests in natural language
- 🔄 **Self-Healing** - Automatically fix broken tests
- 🎨 **Visual Testing** - AI-powered visual regression testing
- 🧠 **Smart Selectors** - Intelligent element targeting
- 🚀 **Multi-Framework** - Supports Playwright, Cypress, Puppeteer, WebdriverIO

## Commands

- `riflebird init` - Initialize configuration
- `riflebird aim <description>` - Generate test from description
- `riflebird fire [path]` - Execute tests
- `riflebird target <description>` - Find element selector
- `riflebird reload <test>` - Auto-heal broken test

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev

# Run tests
pnpm test
```

## License

MIT
