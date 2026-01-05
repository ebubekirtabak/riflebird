# Riflebird Project Roadmap

**Current Version**: 0.1.5 (Pre-release)
**Next Release**: v0.1.6 (Q1 2026)
**Last Updated**: January 5, 2026

---

## 📊 Project Status

| Test Type                 | Status      | Success Rate | Notes                                                                               |
| ------------------------- | ----------- | ------------ | ----------------------------------------------------------------------------------- |
| Unit Testing              | ✅ Released | ~99%         | Test generation and healing works.                                                  |
| Documentation (Storybook) | ✅ Released | ~99%         | Works perfectly with most models. Small models may have issues. Supports Chromatic. |
| Integration Testing       | ❌ Planned  | N/A          | Planned for v0.1.7.                                                                 |
| End-to-end (E2E)          | ❌ Planned  | N/A          | Playwright/Cypress in roadmap.                                                      |
| Performance               | ❌ Planned  | N/A          | Planned for v0.1.7.                                                                 |
| Accessibility             | ❌ Planned  | N/A          | Axe/pa11y integration.                                                              |

**Legend**: ✅ Released · ⚠️ In Development · ❌ Planned

---

## 🚀 Version 0.1.5 - Pre-Release (Current)

### ✅ **Completed**

- Core test generation framework
- Unit test generation (Vitest/Jest)
- AI provider integration (OpenAI, Anthropic, Copilot CLI, Gemini CLI, Local)
- Secret sanitization system
- Configuration management (Zod validation)
- CLI interface (`fire`, `init` commands)
- Glob pattern matching for file discovery
- Scope-based filtering (component, layout, page, service, util, hook, store)
- Progress reporting for bulk operations
- Error handling and failure collection
- TypeScript strict mode support
- Comprehensive test suite (405+ tests)
- Security pipeline (CodeQL, Dependabot, Secret scanning)
- AI coding rules for multiple IDEs
- Documentation (README, CONTRIBUTING, SECURITY, Fire Command docs)
- **RF-26**: Implement auto-healing for unit tests (smart selector recovery, self-healing)
- **RF-17**: Add test file patterns (configurable naming, framework-specific patterns)
- **RF-14**: Storybook integration (auto-generate stories, visual regression testing)

### ⚠️ **In Progress**

- Unit test quality improvements (selector robustness, assertion coverage, edge cases)
- Pre-release testing & validation (real-world projects, edge cases, performance)
- CI/CD pipeline integration (planned for v0.1.6)
- Auto detect changes files in CI and generate test and document for changed parts (planned for v0.1.6)
- Auto detect changes from git status and trigger pipeline for related lines (planned for v0.1.6)

### 📦 **Required for v1.0 Release**

- Package publishing setup (npm, automated releases, changelog)
- Production-ready documentation (installation guide, tutorials, examples)

---

## 🎯 Planned Features

### **End-to-End (E2E) Testing**

- **RF-23**: Playwright integration (browser automation, network mocking, parallel execution)
- **RF-24**: Cypress integration (custom commands, component testing, time travel debugging)
- Additional framework support (Puppeteer, WebdriverIO)

### **Performance Testing**

- **RF-22**: Lighthouse integration, load testing (Artillery, K6), performance budgets

### **Accessibility Testing**

- Axe-core/pa11y integration, WCAG compliance, keyboard navigation testing

### **AI-Powered Enhancements**

- Natural language test descriptions
- Intelligent test prioritization (risk-based, impact analysis)
- Auto-generate test data (mock data, edge cases)
- Self-improving tests (learn from failures, adapt to code changes)

### **CI/CD Integration**

- GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps
- Test result publishing (Slack, email, webhooks)
- CI/CD pipeline integration (planned for v0.1.6)
- Auto detect changes files in CI and generate test and document for changed parts (planned for v0.1.6)
- Auto detect changes from git status and trigger pipeline for related lines (planned for v0.1.6)

---

## 📅 Development Timeline

### **Current Sprint (January 2026)**

- **RF-17**: Test file patterns (Completed)
- **RF-20**: Security pipeline (Completed)
- **RF-19**: Agent rules (Completed)

### **Post v1.0 - Feature Development**

Prioritization based on:

- Community feedback
- Real-world usage patterns
- Technical dependencies

**Priority Candidates**:

1. **RF-23**: Playwright E2E implementation
2. **RF-24**: Cypress E2E implementation
3. **RF-22**: Performance testing
4. **RF-29**: Implement auto healing for lint issues
5. **RF-56**: Auto detect changes files in CI and generate test and document for changed parts
6. **RF-57**: Auto detect changes from git status and trigger pipeline for related lines

## 🤝 How to Influence the Roadmap

1. **Feature Requests**: Open an issue with the `feature-request` label.
2. **Discussions**: Join [GitHub Discussions](https://github.com/ebubekirtabak/riflebird/discussions).
3. **Voting**: React to issues with 👍 to show support.
4. **Contributions**: Submit PRs for features.
5. **Sponsorship**: Sponsor the project to prioritize features.

---

**Contact**: [ebubekir.tabak@yahoo.com](mailto:ebubekir.tabak@yahoo.com)
**Discussions**: [GitHub Discussions](https://github.com/ebubekirtabak/riflebird/discussions)
