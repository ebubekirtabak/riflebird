---
name: Test generation failure
about: Report problems with AI-generated test code (compilation/runtime failures, incorrect assertions)
title: '[TEST-GEN] '
labels: test-generation, bug
assignees: ''
---

**Summary**
Short description of the failure (compilation error, runtime error, incorrect assertion, flaky test, etc.).

**Input / Trigger**
- Description used to generate the test or the example project/files used.
- Config (attach `riflebird.config.ts` or paste relevant parts).
- LLM model and provider used (e.g., `gpt-4`, `gpt-3.5-turbo`, `claude-2`, local/ollama):

**Generated test code**
Paste the generated test file(s) or include a link to a gist. Mark code blocks.

**Error / Failure**
Include compiler errors, runtime stack traces, failing assertion output, or screenshots for visual failures.

**Expected behavior**
What the test should have done or asserted instead.

**Reproduction steps**
1. Command used to generate the test
2. Command used to run the test
3. Any platform-specific instructions

**Temporary workaround**
If you patched the test manually, paste the fixed test (helps us pinpoint the root cause).

**Attachments**
Logs, screenshots, and sample repositories are extremely helpful.
