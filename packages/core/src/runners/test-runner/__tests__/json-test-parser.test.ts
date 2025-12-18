import { describe, it, expect } from 'vitest';
import {
  parseFailingTestsFromJson,
  formatFailingTestsForPrompt,
  type TestRunResult,
  type VitestJsonReport,
} from '../index';

describe('parseFailingTestsFromJson', () => {
  it('should return empty array for successful tests', () => {
    const result: TestRunResult = {
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      duration: 100,
      jsonReport: {
        success: true,
        numTotalTests: 5,
        numPassedTests: 5,
        numFailedTests: 0,
        testResults: [],
      } as unknown as VitestJsonReport,
    };

    const failedTests = parseFailingTestsFromJson(result);
    expect(failedTests).toEqual([]);
  });

  it('should return empty array when no JSON report available', () => {
    const result: TestRunResult = {
      success: false,
      exitCode: 1,
      stdout: 'some error',
      stderr: '',
      duration: 100,
      jsonReport: null,
    };

    const failedTests = parseFailingTestsFromJson(result);
    expect(failedTests).toEqual([]);
  });

  it('should parse failing tests from JSON report', () => {
    const result: TestRunResult = {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      duration: 100,
      jsonReport: {
        success: false,
        numTotalTests: 3,
        numPassedTests: 1,
        numFailedTests: 2,
        testResults: [
          {
            status: 'failed',
            name: '/path/to/test.tsx',
            assertionResults: [
              {
                ancestorTitles: ['MyComponent'],
                fullName: 'MyComponent renders correctly',
                status: 'failed',
                title: 'renders correctly',
                duration: 45.2,
                failureMessages: [
                  'Error: Expected element to be present\n\nExpected: <button>Click me</button>\nReceived: <button>Click</button>',
                ],
              },
              {
                ancestorTitles: ['MyComponent'],
                fullName: 'MyComponent handles click',
                status: 'failed',
                title: 'handles click',
                duration: 30.5,
                failureMessages: ['Error: Mock function was not called'],
              },
            ],
          },
        ],
      } as unknown as VitestJsonReport,
    };

    const failedTests = parseFailingTestsFromJson(result);

    expect(failedTests).toHaveLength(2);
    expect(failedTests[0].testName).toBe('renders correctly');
    expect(failedTests[0].fullName).toBe('MyComponent renders correctly');
    expect(failedTests[0].ancestorTitles).toEqual(['MyComponent']);
    expect(failedTests[0].duration).toBe(45.2);
    expect(failedTests[0].errorMessage).toContain('Expected element to be present');

    expect(failedTests[1].testName).toBe('handles click');
    expect(failedTests[1].errorMessage).toContain('Mock function was not called');
  });

  it('should extract HTML from failure messages with ANSI codes', () => {
    const result: TestRunResult = {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      duration: 100,
      jsonReport: {
        success: false,
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        testResults: [
          {
            status: 'failed',
            name: '/path/to/test.tsx',
            assertionResults: [
              {
                ancestorTitles: ['CertificateModal'],
                fullName: 'CertificateModal renders modal with title',
                status: 'failed',
                title: 'renders modal with title',
                duration: 124.7,
                failureMessages: [
                  'TestingLibraryElementError: Unable to find an element with the text: Add Certificate\n\n\u001b[36m<body>\u001b[39m\n  \u001b[36m<div\u001b[39m\n    \u001b[33maria-hidden\u001b[39m=\u001b[32m"true"\u001b[39m\n  \u001b[36m/>\u001b[39m\n\u001b[36m</body>\u001b[39m',
                ],
              },
            ],
          },
        ],
      } as unknown as VitestJsonReport,
    };

    const failedTests = parseFailingTestsFromJson(result);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].renderedHTML).toContain('<body>');
    expect(failedTests[0].renderedHTML).toContain('</body>');
    expect(failedTests[0].renderedHTML).not.toContain('\u001b[36m'); // ANSI codes stripped
    expect(failedTests[0].renderedHTML).toContain('aria-hidden');
  });

  it('should limit to 10 failing tests', () => {
    const assertionResults = Array.from({ length: 15 }, (_, i) => ({
      ancestorTitles: ['Suite'],
      fullName: `Test ${i}`,
      status: 'failed' as const,
      title: `test ${i}`,
      failureMessages: [`Error in test ${i}`],
    }));

    const result: TestRunResult = {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      duration: 100,
      jsonReport: {
        success: false,
        numTotalTests: 15,
        numPassedTests: 0,
        numFailedTests: 15,
        testResults: [
          {
            status: 'failed',
            name: '/path/to/test.tsx',
            assertionResults,
          },
        ],
      } as unknown as VitestJsonReport,
    };

    const failedTests = parseFailingTestsFromJson(result);

    expect(failedTests).toHaveLength(10);
  });

  it('should truncate very long error messages', () => {
    const longError = 'Error: ' + 'x'.repeat(3000);

    const result: TestRunResult = {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      duration: 100,
      jsonReport: {
        success: false,
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        testResults: [
          {
            status: 'failed',
            name: '/path/to/test.tsx',
            assertionResults: [
              {
                ancestorTitles: [],
                fullName: 'long error test',
                status: 'failed',
                title: 'long error test',
                failureMessages: [longError],
              },
            ],
          },
        ],
      } as unknown as VitestJsonReport,
    };

    const failedTests = parseFailingTestsFromJson(result);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].errorMessage.length).toBeLessThanOrEqual(2003); // 2000 + '...'
    expect(failedTests[0].errorMessage).toContain('...');
  });

  it('should capture file-level error when assertions are empty but file status is failed', () => {
    const result: TestRunResult = {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      duration: 100,
      jsonReport: {
        success: false,
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        testResults: [
          {
            status: 'failed',
            name: '/path/to/broken-file.ts',
            message: 'SyntaxError: Unexpected token',
            startTime: 1000,
            endTime: 1050,
            assertionResults: [],
          },
        ],
      } as unknown as VitestJsonReport,
    };

    const failedTests = parseFailingTestsFromJson(result);

    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].testName).toBe('Test File Error');
    expect(failedTests[0].fullName).toContain('broken-file.ts');
    expect(failedTests[0].errorMessage).toBe('SyntaxError: Unexpected token');
    expect(failedTests[0].duration).toBe(50);
  });
});

describe('formatFailingTestsForPrompt', () => {
  it('should return empty string for no failures', () => {
    const formatted = formatFailingTestsForPrompt([]);
    expect(formatted).toBe('');
  });

  it('should format single failing test', () => {
    const failedTests = [
      {
        testName: 'renders button',
        fullName: 'Button renders button',
        ancestorTitles: ['Button'],
        errorMessage: 'Expected button text to be "Click" but got "Submit"',
        renderedHTML: '<body><button>Submit</button></body>',
        duration: 45.7,
      },
    ];

    const formatted = formatFailingTestsForPrompt(failedTests);

    expect(formatted).toContain('## Failed Tests (1)');
    expect(formatted).toContain('### Test 1: renders button');
    expect(formatted).toContain('**Suite:** Button');
    expect(formatted).toContain('**Duration:** 45.70ms');
    expect(formatted).toContain('**Error:**');
    expect(formatted).toContain('Expected button text');
    expect(formatted).toContain('**Rendered HTML:**');
    expect(formatted).toContain('<button>Submit</button>');
  });

  it('should format multiple failing tests', () => {
    const failedTests = [
      {
        testName: 'test 1',
        fullName: 'Suite test 1',
        ancestorTitles: ['Suite'],
        errorMessage: 'Error 1',
        renderedHTML: '',
      },
      {
        testName: 'test 2',
        fullName: 'Suite test 2',
        ancestorTitles: ['Suite'],
        errorMessage: 'Error 2',
        renderedHTML: '<div>HTML</div>',
        duration: 120.5,
      },
    ];

    const formatted = formatFailingTestsForPrompt(failedTests);

    expect(formatted).toContain('## Failed Tests (2)');
    expect(formatted).toContain('### Test 1: test 1');
    expect(formatted).toContain('### Test 2: test 2');
    expect(formatted).toContain('Error 1');
    expect(formatted).toContain('Error 2');
    expect(formatted).toContain('<div>HTML</div>');
    expect(formatted).toContain('**Duration:** 120.50ms');
  });

  it('should handle nested suite titles', () => {
    const failedTests = [
      {
        testName: 'inner test',
        fullName: 'Outer Suite > Inner Suite inner test',
        ancestorTitles: ['Outer Suite', 'Inner Suite'],
        errorMessage: 'Error',
        renderedHTML: '',
      },
    ];

    const formatted = formatFailingTestsForPrompt(failedTests);

    expect(formatted).toContain('**Suite:** Outer Suite > Inner Suite');
  });

  it('should handle missing duration', () => {
    const failedTests = [
      {
        testName: 'test without duration',
        fullName: 'test without duration',
        ancestorTitles: [],
        errorMessage: 'Error',
        renderedHTML: '',
      },
    ];

    const formatted = formatFailingTestsForPrompt(failedTests);

    expect(formatted).not.toContain('**Duration:**');
  });

  it('should handle missing HTML', () => {
    const failedTests = [
      {
        testName: 'test without HTML',
        fullName: 'test without HTML',
        ancestorTitles: [],
        errorMessage: 'Error',
        renderedHTML: '',
      },
    ];

    const formatted = formatFailingTestsForPrompt(failedTests);

    expect(formatted).not.toContain('**Rendered HTML:**');
  });
});
