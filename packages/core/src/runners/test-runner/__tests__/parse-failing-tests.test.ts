import { describe, it, expect } from 'vitest';
import { parseFailingTests } from '../index';
import type { TestRunResult } from '../index';

describe('parseFailingTests', () => {
  const sampleTestFile = `
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('should render username', async () => {
    render(<UserProfile user={{ name: 'John' }} />);
    expect(screen.getByRole('heading')).toHaveTextContent('John');
  });

  it('should show email', async () => {
    render(<UserProfile user={{ email: 'john@example.com' }} />);
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });
});
  `.trim();

  it('should parse Vitest format failing tests', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
❯ UserProfile › should render username
  AssertionError: expected 'Welcome' to have text 'John'

  at packages/core/src/components/UserProfile.test.ts:8:5
  at processTicksAndRejections (node:internal/process/task_queues:95:5)

❯ UserProfile › should show email
  Error: Unable to find an element with the text: john@example.com

  <body>
    <div>
      <h1>Welcome</h1>
      <p>No email provided</p>
    </div>
  </body>

  at screen.getByText (node_modules/@testing-library/dom/dist/index.js:123:12)
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(2);

    // First failing test
    expect(failedTests[0].testName).toBe('UserProfile › should render username');
    expect(failedTests[0].errorMessage).toContain("expected 'Welcome' to have text 'John'");
    expect(failedTests[0].stackTrace).toContain('UserProfile.test.ts:8:5');
    expect(failedTests[0].testCode).toContain("it('should render username'");

    // Second failing test
    expect(failedTests[1].testName).toBe('UserProfile › should show email');
    expect(failedTests[1].errorMessage).toContain('Unable to find an element with the text');
    expect(failedTests[1].renderedHTML).toContain('<h1>Welcome</h1>');
    expect(failedTests[1].renderedHTML).toContain('<p>No email provided</p>');
  });

  it('should parse Jest format failing tests', () => {
    const result: TestRunResult = {
      success: false,
      stdout: `
● UserProfile › should render username

  Error: expected 'Welcome' to have text 'John'

    at Object.<anonymous> (src/UserProfile.test.ts:8:5)

● UserProfile › should show email

  Error: Unable to find element

    at Object.<anonymous> (src/UserProfile.test.ts:13:5)
`,
      stderr: '',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(2);
    expect(failedTests[0].testName).toBe('UserProfile › should render username');
    expect(failedTests[1].testName).toBe('UserProfile › should show email');
  });

  it('should extract test code from file', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
❯ UserProfile › should render username
  AssertionError: test failed
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].testCode).toBeDefined();
    expect(failedTests[0].testCode).toContain('should render username');
    expect(failedTests[0].testCode).toContain('screen.getByRole');
  });

  it('should handle test without extractable code', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
❯ NonExistentTest › some test
  Error: test failed
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].testName).toBe('NonExistentTest › some test');
    expect(failedTests[0].testCode).toBeUndefined();
  });

  it('should extract HTML from test output', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
❯ UserProfile › should render username
  Error: Unable to find element

  <body>
    <div class="container">
      <h1 data-testid="title">Hello World</h1>
      <button>Click me</button>
    </div>
  </body>
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].renderedHTML).toContain('<body>');
    expect(failedTests[0].renderedHTML).toContain('data-testid="title"');
    expect(failedTests[0].renderedHTML).toContain('<button>Click me</button>');
  });

  it('should handle multiple stack trace lines', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
❯ UserProfile › should render username
  Error: test failed

  at packages/core/src/test.ts:10:5
  at processTicksAndRejections (node:internal/process/task_queues:95:5)
  at async runTest (packages/core/src/runner.ts:20:3)
  at async Suite.run (node_modules/vitest/dist/suite.js:45:7)
  at async runSuite (node_modules/vitest/dist/run.js:12:5)
  at async runFiles (node_modules/vitest/dist/run.js:30:3)
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].stackTrace).toBeDefined();
    const lines = failedTests[0].stackTrace!.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(6); // Should limit to ~5 lines (may have 6 due to splitting)
    expect(failedTests[0].stackTrace).toContain('test.ts:10:5');
  });

  it('should fallback to simple FAIL pattern', () => {
    const result: TestRunResult = {
      success: false,
      stdout: 'FAIL src/test.ts',
      stderr: 'SyntaxError: Unexpected token',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].testName).toBe('Test Suite Failure');
    expect(failedTests[0].errorMessage).toContain('SyntaxError');
  });

  it('should return empty array for successful tests', () => {
    const result: TestRunResult = {
      success: true,
      stdout: 'Test passed',
      stderr: '',
      exitCode: 0,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, sampleTestFile);

    expect(failedTests).toHaveLength(0);
  });

  it('should handle test with async function syntax', () => {
    const testFile = `
describe('AsyncTest', () => {
  it('should work', async function() {
    await something();
    expect(result).toBe(true);
  });
});
    `.trim();

    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
❯ AsyncTest › should work
  Error: test failed
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const failedTests = parseFailingTests(result, testFile);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].testCode).toBeDefined();
    expect(failedTests[0].testCode).toContain('should work');
  });
});
