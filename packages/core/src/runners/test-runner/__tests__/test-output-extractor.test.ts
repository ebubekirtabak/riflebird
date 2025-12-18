import { describe, it, expect } from 'vitest';
import {
  extractTestErrors,
  extractRenderedHTML,
  parseFailingTestsFromJson,
  formatFailingTestsForPrompt,
  getFailingTestsDetail,
  extractTestCodeFromFile,
} from '../test-output-extractor';
import { TestRunResult, VitestJsonReport, UnitTestErrorContext, FailedTestDetail } from '../types';

describe('extractTestErrors', () => {
  it('should return empty string for successful test', () => {
    const result: TestRunResult = {
      success: true,
      stdout: 'PASS',
      stderr: '',
      exitCode: 0,
      duration: 100,
      jsonReport: null,
    };
    expect(extractTestErrors(result)).toBe('');
  });

  it('should extract explicit error from result object', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 1,
      duration: 100,
      jsonReport: null,
      error: 'Process timed out',
    };
    expect(extractTestErrors(result)).toBe('Process timed out');
  });

  it('should extract failing tests from stdout/stderr', () => {
    const output = `
FAIL src/test.spec.ts
  ✗ should fail
    Error: Expected 1 to be 2
  ✗ should also fail
    AssertionError: expected 'a' to be 'b'
`;
    const result: TestRunResult = {
      success: false,
      stdout: output,
      stderr: '',
      exitCode: 1,
      duration: 100,
      jsonReport: null,
    };

    const errors = extractTestErrors(result);
    // Should match "FAIL ..." lines inside regex in output extractor
    // FAILED_TEST_MATCH regex is /(?:✗|FAIL).*?$/gm
    expect(errors).toContain('Failed tests:');
    // Depending on regex (FAIL src/test.spec.ts matches FAIL..., ✗ matches ✗...)
  });

  it('should extract syntax errors', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
src/file.ts:10
    const a = ;
              ^
SyntaxError: Unexpected token ';'
`,
      exitCode: 1,
      duration: 100,
      jsonReport: null,
    };

    const errors = extractTestErrors(result);
    expect(errors).toContain('Syntax errors:');
    expect(errors).toContain("SyntaxError: Unexpected token ';'");
  });
});

describe('extractRenderedHTML', () => {
  it('should return empty string for successful tests', () => {
    const result: TestRunResult = {
      success: true,
      stdout: '<body>some html</body>',
      stderr: '',
      exitCode: 0,
      duration: 0,
      jsonReport: null,
    };

    expect(extractRenderedHTML(result)).toBe('');
  });

  it('should extract HTML from body tags in stderr', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: 'Error: Unable to find element\n\n<body><div>Hello World</div></body>',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    expect(extractRenderedHTML(result)).toBe('<body><div>Hello World</div></body>');
  });

  it('should extract HTML from accessible tree output', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
TestingLibraryElementError: Unable to find an accessible element with the role "button"

Here is the accessible tree of your document:

<body>
  <div>
    <span>Click me</span>
  </div>
</body>
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<body>');
    expect(html).toContain('<span>Click me</span>');
  });

  it('should extract HTML from screen.debug() output', () => {
    const result: TestRunResult = {
      success: false,
      stdout: `
console.log
  <body>
    <div data-testid="container">
      <button>Submit</button>
    </div>
  </body>
`,
      stderr: '',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<body>');
    expect(html).toContain('<button>Submit</button>');
  });
});

describe('parseFailingTestsFromJson', () => {
  it('should return empty array if success', () => {
    const result: TestRunResult = {
      success: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
      duration: 0,
      jsonReport: { numTotalTestSuites: 0, testResults: [], success: true } as unknown as VitestJsonReport,
    };
    expect(parseFailingTestsFromJson(result)).toEqual([]);
  });

  it('should parse failed assertions from JSON report', () => {
    const jsonReport: VitestJsonReport = {
      numTotalTestSuites: 1,
      startTime: 0,
      success: false,
      testResults: [
        {
          name: '/path/to/test.spec.ts',
          status: 'failed',
          startTime: 0,
          endTime: 100,
          assertionResults: [
            {
              ancestorTitles: ['suite'],
              fullName: 'suite > test case',
              status: 'failed',
              title: 'test case',
              duration: 10,
              failureMessages: ['Error: Expected 1 to be 2'],
            },
          ],
        },
      ],
    } as unknown as VitestJsonReport;

    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 1,
      duration: 0,
      jsonReport,
    };

    const failures = parseFailingTestsFromJson(result);
    expect(failures).toHaveLength(1);
    expect(failures[0].testName).toBe('test case');
    expect(failures[0].errorMessage).toBe('Error: Expected 1 to be 2');
  });

  it('should handle file-level errors (no assertion failures but file failed)', () => {
      const jsonReport: VitestJsonReport = {
      numTotalTestSuites: 1,
      startTime: 0,
      success: false,
      testResults: [
        {
          name: '/path/to/error.spec.ts',
          status: 'failed',
          startTime: 0,
          endTime: 100,
          message: 'SyntaxError: Unexpected token',
          assertionResults: [], // No individual assertions ran
        },
      ],
    } as unknown as VitestJsonReport;

    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 1,
      duration: 0,
      jsonReport,
    };

    const failures = parseFailingTestsFromJson(result);
    expect(failures).toHaveLength(1);
    expect(failures[0].testName).toBe('Test File Error');
    expect(failures[0].errorMessage).toBe('SyntaxError: Unexpected token');
  });
});

describe('formatFailingTestsForPrompt', () => {
  it('should return empty string for empty input', () => {
    expect(formatFailingTestsForPrompt([])).toBe('');
  });

  it('should format failing tests into markdown', () => {
    const failedTests: FailedTestDetail[] = [
      {
        testName: 'test 1',
        fullName: 'suite > test 1',
        ancestorTitles: ['suite'],
        errorMessage: 'Error: failed 1',
        duration: 20,
        renderedHTML: '',
      },
    ];

    const markdown = formatFailingTestsForPrompt(failedTests);
    expect(markdown).toContain('## Failed Tests (1)');
    expect(markdown).toContain('### Test 1: test 1');
    expect(markdown).toContain('**Suite:** suite');
    expect(markdown).toContain('Error: failed 1');
  });

  it('should include rendered HTML if present', () => {
     const failedTests: FailedTestDetail[] = [
      {
        testName: 'ui test',
        fullName: 'ui test',
        ancestorTitles: [],
        errorMessage: 'Element not found',
        duration: 20,
        renderedHTML: '<div></div>',
      },
    ];

    const markdown = formatFailingTestsForPrompt(failedTests);
    expect(markdown).toContain('**Rendered HTML:**');
    expect(markdown).toContain('```html');
    expect(markdown).toContain('<div></div>');
  });
});

describe('getFailingTestsDetail', () => {
  it('should return formatted failing tests if present', () => {
    const ctx: UnitTestErrorContext = {
      failingTests: [
         {
            testName: 'test',
            fullName: 'test',
            ancestorTitles: [],
            errorMessage: 'err',
            duration: 1,
            renderedHTML: ''
         }
      ],
      fullTestOutput: 'output',
      testFilePath: 'file.ts'
    };

    const detail = getFailingTestsDetail(ctx);
    expect(detail).toContain('## Failed Tests');
    expect(detail).toContain('### Test 1: test');
  });

  it('should return raw output fallback', () => {
     const ctx: UnitTestErrorContext = {
      failingTests: [],
      fullTestOutput: 'Some raw error output',
      testFilePath: 'file.ts'
    };

    const detail = getFailingTestsDetail(ctx);
    expect(detail).toContain('No specific failing test information extracted');
    expect(detail).toContain('Some raw error output');
  });

  it('should return generic message if no info', () => {
      const detail = getFailingTestsDetail({} as UnitTestErrorContext);
      expect(detail).toBe('No specific failing test information available');
  });
});

describe('extractTestCodeFromFile', () => {
  it('should extract simple arrow function test', () => {
    const code = `
      test('simple test', () => {
        expect(1).toBe(1);
      });
    `;
    const extracted = extractTestCodeFromFile(code, 'simple test');
    expect(extracted).toBeDefined();
    expect(extracted).toContain("expect(1).toBe(1);");
  });

  it('should extract simple function test', () => {
    const code = `
      test('function test', function() {
        expect(1).toBe(1);
      });
    `;
    const extracted = extractTestCodeFromFile(code, 'function test');
    expect(extracted).toBeDefined();
    expect(extracted).toContain("expect(1).toBe(1);");
  });

  it('should handle nested function calls correctly', () => {
    // This was failing with the old regex
    const code = `
      test('nested calls', () => {
        someFn(() => {
           return true;
        });
        expect(true).toBe(true);
      });
    `;
    const extracted = extractTestCodeFromFile(code, 'nested calls');
    expect(extracted).toContain('expect(true).toBe(true);');
  });

  it('should handle strings containing braces', () => {
     // This requires string state awareness
     const code = `
       test('strings with braces', () => {
         const s = "}";
         const s2 = '{';
         expect(s).toBe("}");
       });
     `;
     const extracted = extractTestCodeFromFile(code, 'strings with braces');
     expect(extracted).toContain('expect(s).toBe("}");');
  });

  it('should handle comments containing braces', () => {
    // This requires comment state awareness
    const code = `
      test('comments with braces', () => {
        // }
        /* { */
        expect(true).toBe(true);
      });
    `;
    const extracted = extractTestCodeFromFile(code, 'comments with braces');
    expect(extracted).toContain('expect(true).toBe(true);');
  });

  it('should handle async tests', () => {
    const code = `
      test('async test', async () => {
        await val;
      });
    `;
    const extracted = extractTestCodeFromFile(code, 'async test');
    expect(extracted).toContain('await val;');
  });

  it('should handle tests with complex structure', () => {
    const code = `
      test('complex', () => {
        if (true) {
           console.log('nested');
        }
      });
    `;
    const extracted = extractTestCodeFromFile(code, 'complex');
    expect(extracted).toContain("console.log('nested');");
  });
});
