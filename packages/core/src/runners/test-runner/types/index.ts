/**
 * Vitest JSON test result types
 */
export type VitestAssertionResult = {
    ancestorTitles: string[];
    fullName: string;
    status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
    title: string;
    duration?: number;
    failureMessages: string[];
    meta?: Record<string, unknown>;
};

export type VitestTestResult = {
    assertionResults: VitestAssertionResult[];
    startTime: number;
    endTime: number;
    status: 'passed' | 'failed';
    message: string;
    name: string;
};

export type VitestJsonReport = {
    numTotalTestSuites: number;
    numPassedTestSuites: number;
    numFailedTestSuites: number;
    numPendingTestSuites: number;
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    numPendingTests: number;
    numTodoTests: number;
    startTime: number;
    success: boolean;
    testResults: VitestTestResult[];
};

/**
 * Parsed failing test with clean, structured data
 */
export type FailedTestDetail = {
    testName: string;
    fullName: string;
    ancestorTitles: string[];
    errorMessage: string;
    renderedHTML: string;
    duration?: number;
};

export type TestRunResult = {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    jsonReport: VitestJsonReport | null;
    error?: string;
};

export type TestRunOptions = {
    cwd: string;
    testFilePath: string;
    timeout?: number;
    framework?: 'vitest' | 'jest' | 'mocha' | 'ava';
};

export type FailedTest = {
    testName: string;
    testCode?: string;
    errorMessage: string;
    stackTrace?: string;
    renderedHTML?: string;
};

export type ReporterArgsParams = {
  jsonReportPath: string;
};

export type UnitTestErrorContext = {
  failingTests: FailedTestDetail[];
  fullTestOutput: string;
};
