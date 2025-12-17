import path from 'node:path';
import { TestRunResult, FailedTestDetail, FailedTest, VitestAssertionResult, VitestTestResult } from './types';

// ============================================================================
// Constants & Regex Patterns
// ============================================================================

const PATTERNS = {
  // eslint-disable-next-line no-control-regex
  ANSI_CODES: /\x1b\[[0-9;]*[a-zA-Z]/g,
  HTML_BODY: /<body[^>]*>[\s\S]*?<\/body>/i,
  ACCESSIBLE_TREE: /Here is the accessible tree of your document[\s\S]*?<body[^>]*>[\s\S]*?<\/body>/i,
  SCREEN_DEBUG: /console\.log\s*<body[^>]*>[\s\S]*?<\/body>/i,
  GENERIC_HTML: /<[a-z]+[^>]*>[\s\S]{20,1000}<\/[a-z]+>/i,

  // Test failure headers
  VITEST_FAIL: /❯\s+(.+?)\s*\n([\s\S]*?)(?=❯|Test Files|$)/g,
  JEST_FAIL: /●\s+(.+?)\s*\n([\s\S]*?)(?=●|Test Suites|$)/g,
  SIMPLE_FAIL: /FAIL/i,

  // Failure output analysis
  FAILED_TEST_MATCH: /(?:✗|FAIL).*?$/gm,
  ERROR_DETAILS: /(?:Error:|Expected.*but received|AssertionError:).*$/gm,
  SYNTAX_ERROR: /SyntaxError:.*$/gm,
  STACK_TRACE: /^\s*at\s+.+$/gm,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove ANSI color codes and control characters from string
 */
export function stripAnsiCodes(str: string): string {
  return str.replace(PATTERNS.ANSI_CODES, '');
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract HTML/DOM output from any string (test output or error message)
 */
function extractHtmlContent(text: string): string {
  const patterns = [
    PATTERNS.HTML_BODY,
    PATTERNS.ACCESSIBLE_TREE,
    PATTERNS.SCREEN_DEBUG,
    PATTERNS.GENERIC_HTML
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return '';
}

// ============================================================================
// Main Exported Functions
// ============================================================================

/**
 * Extract relevant error information from test output
 * @returns Extracted error message for AI context (cleaned and concise)
 */
export function extractTestErrors(result: TestRunResult): string {
  if (result.success) return '';

  const errors: string[] = [];
  if (result.error) errors.push(result.error);

  const output = result.stderr || result.stdout;

  // 1. Failed tests list
  const failedTestMatches = output.match(PATTERNS.FAILED_TEST_MATCH);
  if (failedTestMatches) {
    const uniqueTests = [...new Set(failedTestMatches)].slice(0, 10);
    errors.push('Failed tests:', ...uniqueTests);

    if (failedTestMatches.length > 10) {
      errors.push(`... and ${failedTestMatches.length - 10} more failing tests`);
    }
  }

  // 2. Specific error details
  const errorMatches = output.match(PATTERNS.ERROR_DETAILS);
  if (errorMatches) {
    const uniqueErrors = [...new Set(errorMatches)].slice(0, 3);
    errors.push('Error details:', ...uniqueErrors);
  }

  // 3. Syntax errors (critical)
  const syntaxMatches = output.match(PATTERNS.SYNTAX_ERROR);
  if (syntaxMatches) {
    errors.push('Syntax errors:', ...syntaxMatches);
  }

  return errors.length > 0 ? errors.join('\n') : output.slice(0, 1000);
}

/**
 * Extract rendered HTML/DOM output from testing library errors
 */
export function extractRenderedHTML(result: TestRunResult): string {
  if (result.success) return '';
  return extractHtmlContent(result.stderr || result.stdout);
}

/**
 * Parse failing tests from Vitest/Jest JSON report
 */
export function parseFailingTestsFromJson(result: TestRunResult): FailedTestDetail[] {
  if (result.success || !result.jsonReport) return [];

  const failedTests: FailedTestDetail[] = [];

  for (const testFile of result.jsonReport.testResults) {
    if (testFile.status !== 'failed') continue;

    const fileFailures = parseTestFileFailures(testFile);
    failedTests.push(...fileFailures);
  }

  return failedTests.slice(0, 10);
}

/**
 * Parse failing tests from raw string output (stdout/stderr)
 * Strategy: Try Vitest pattern -> Jest pattern -> Fallback
 */
export function parseFailingTests(result: TestRunResult, testFileContent: string): FailedTest[] {
  if (result.success) return [];

  const output = result.stderr || result.stdout;

  // Try parsing with specific framework patterns
  const vitestTests = parseOutputWithPattern(output, PATTERNS.VITEST_FAIL, testFileContent);
  if (vitestTests.length > 0) return vitestTests;

  const jestTests = parseOutputWithPattern(output, PATTERNS.JEST_FAIL, testFileContent);
  if (jestTests.length > 0) return jestTests;

  // Fallback: Check for general failure and return suite-level error
  if (PATTERNS.SIMPLE_FAIL.test(output)) {
    return [{
      testName: 'Test Suite Failure',
      errorMessage: extractTestErrors(result),
      renderedHTML: extractRenderedHTML(result),
    }];
  }

  return [];
}

/**
 * Format failing tests into a readable markdown string for LLM consumption
 */
export function formatFailingTestsForPrompt(failedTests: FailedTestDetail[]): string {
  if (failedTests.length === 0) return '';

  return [
    `## Failed Tests (${failedTests.length})\n`,
    ...failedTests.map((test, i) => formatSingleFailedTest(test, i + 1))
  ].join('\n');
}

// ============================================================================
// Internal Helpers
// ============================================================================

function parseTestFileFailures(testFile: VitestTestResult): FailedTestDetail[] {
  const failures: FailedTestDetail[] = [];
  let fileHasFailedAssertions = false;

  // Check specific assertions
  for (const assertion of testFile.assertionResults) {
    if (assertion.status === 'failed') {
      fileHasFailedAssertions = true;
      failures.push(createFailedAssertionDetail(assertion));
    }
  }

  // Handle generalized file error (e.g. syntax error)
  if (!fileHasFailedAssertions) {
    failures.push(createFileErrorDetail(testFile));
  }

  return failures;
}

function createFailedAssertionDetail(assertion: VitestAssertionResult): FailedTestDetail {
  // Extract rendered HTML from failure messages
  let renderedHTML = '';
  const cleanedErrors = assertion.failureMessages.map((msg) => {
    const clean = stripAnsiCodes(msg);
    if (!renderedHTML) {
      renderedHTML = extractHtmlContent(clean);
    }
    return clean.length > 2000 ? clean.slice(0, 2000) + '...' : clean;
  });

  return {
    testName: assertion.title,
    fullName: assertion.fullName,
    ancestorTitles: assertion.ancestorTitles,
    errorMessage: cleanedErrors.join('\n\n---\n\n'),
    renderedHTML,
    duration: assertion.duration,
  };
}

function createFileErrorDetail(testFile: VitestTestResult): FailedTestDetail {
  return {
    testName: 'Test File Error',
    fullName: `${path.basename(testFile.name)} (File Error)`,
    ancestorTitles: [path.basename(testFile.name)],
    errorMessage: stripAnsiCodes(testFile.message || 'Unknown test file error'),
    renderedHTML: '',
    duration: testFile.endTime - testFile.startTime,
  };
}

function parseOutputWithPattern(output: string, pattern: RegExp, testFileContent: string): FailedTest[] {
  const failedTests: FailedTest[] = [];
  let match = pattern.exec(output);

  while (match) {
    const testName = match[1].trim();
    const testOutput = match[2];

    failedTests.push({
      testName,
      testCode: extractTestCodeFromFile(testFileContent, testName),
      errorMessage: extractErrorMessage(testOutput),
      stackTrace: extractStackTrace(testOutput),
      renderedHTML: extractHtmlContent(testOutput),
    });

    match = pattern.exec(output);
  }

  return failedTests;
}

function extractErrorMessage(testOutput: string): string {
  const errorMatch = testOutput.match(/Error:\s*(.+?)(?:\n|$)/);
  const assertionMatch = testOutput.match(/AssertionError:\s*(.+?)(?:\n|$)/);
  const expectedMatch = testOutput.match(/(Expected|Received)[\s\S]*?(?=\n\n|\n❯|$)/);

  return errorMatch?.[1] || assertionMatch?.[1] || expectedMatch?.[0] || 'Test failed';
}

function extractStackTrace(testOutput: string): string | undefined {
  const stackLines = testOutput.match(PATTERNS.STACK_TRACE);
  return stackLines?.slice(0, 5).join('\n');
}

function formatSingleFailedTest(test: FailedTestDetail, index: number): string {
  const sections = [`### Test ${index}: ${test.testName}`];

  if (test.ancestorTitles.length > 0) {
    sections.push(`**Suite:** ${test.ancestorTitles.join(' > ')}`);
  }

  if (test.duration !== undefined) {
    sections.push(`**Duration:** ${test.duration.toFixed(2)}ms`);
  }

  sections.push(`\n**Error:**\n\`\`\`\n${test.errorMessage}\n\`\`\``);

  if (test.renderedHTML) {
    sections.push(`\n**Rendered HTML:**\n\`\`\`html\n${test.renderedHTML}\n\`\`\``);
  }

  sections.push(''); // Empty line
  return sections.join('\n');
}

function extractTestCodeFromFile(fileContent: string, testName: string): string | undefined {
  const parts = testName.split(/\s+›\s+/).map(p => p.trim());
  const testTitle = parts[parts.length - 1];

  // Arrow function pattern
  const arrowPattern = new RegExp(
    `(it|test)\\s*\\(['\`"]${escapeRegExp(testTitle)}['\`"]\\s*,\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\s*\\)`,
    'i'
  );
  const arrowMatch = fileContent.match(arrowPattern);
  if (arrowMatch) {
    return `${arrowMatch[1]}('${testTitle}', ${arrowMatch[0].split(',').slice(1).join(',')}`;
  }

  // Classic function pattern
  const functionPattern = new RegExp(
    `(it|test)\\s*\\(['\`"]${escapeRegExp(testTitle)}['\`"]\\s*,\\s*(?:async\\s+)?function\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\s*\\)`,
    'i'
  );
  const functionMatch = fileContent.match(functionPattern);
  if (functionMatch) {
    return functionMatch[0];
  }

  return undefined;
}
