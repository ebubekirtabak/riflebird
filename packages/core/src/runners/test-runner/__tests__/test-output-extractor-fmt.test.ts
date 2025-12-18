import { describe, it, expect } from 'vitest';
import { getFailingTestsDetail } from '../test-output-extractor';
import { UnitTestErrorContext } from '../types';

// Mock formatFailingTestsForPrompt since it's an internal helper we also export for testing/internal use
// However, since we are testing test-output-extractor, we probably want to test the real integration or mocking
// In the original test it was mocking @runners/test-runner.
// Since formatFailingTestsForPrompt is in the SAME file we are testing, we might not want to mock it if possible,
// OR if we want to isolate getFailingTestsDetail we can mock it.
// Given the original test mocked it, let's keep mocking it to isolate `getFailingTestsDetail` logic.
// We can use vi.spyOn to mock exports from the same module if we were using a different structure,
// but since they are in the same file and one calls the other directly, mocking might be tricky without re-importing.
//
// Actually, `getFailingTestsDetail` calls `formatFailingTestsForPrompt` which is in the same file.
// In ESM/TS, standard `vi.mock` on the module itself works for external consumers, but internal calls
// might not be intercepted unless we structure it carefully.
//
// Let's try importing all from the module to spy on it, or just test the behavior including formatting.
// Testing including formatting is likely safer and less brittle.
//
// Let's NOT mock formatFailingTestsForPrompt and instead verify the output contains what we expect.

describe('getFailingTestsDetail', () => {
  it('should return formatted failing tests when failingTests are present', () => {
    const mockFailingTests = [{
      testName: 'test1',
      fullName: 'suite > test1',
      ancestorTitles: ['suite'],
      errorMessage: 'error1',
      renderedHTML: ''
    }];
    const mockErrorContext: UnitTestErrorContext = {
      failingTests: mockFailingTests,
      fullTestOutput: 'some output',
    };

    const result = getFailingTestsDetail(mockErrorContext);

    // Instead of checking if a mock was called, checking the result string contains expected parts
    expect(result).toContain('Failed Tests (1)');
    expect(result).toContain('test1');
    expect(result).toContain('error1');
  });

  it('should return raw output when failingTests are empty but output exists', () => {
    const mockErrorContext: UnitTestErrorContext = {
      failingTests: [],
      fullTestOutput: 'raw test output',
    };

    const result = getFailingTestsDetail(mockErrorContext);

    expect(result).toContain('No specific failing test information extracted');
    expect(result).toContain('raw test output');
  });

  it('should return truncated raw output when failingTests are empty and output is long', () => {
    const longOutput = 'a'.repeat(6000);
    const mockErrorContext: UnitTestErrorContext = {
      failingTests: [],
      fullTestOutput: longOutput,
    };

    const result = getFailingTestsDetail(mockErrorContext);

    expect(result).toContain('No specific failing test information extracted');
    expect(result.length).toBeLessThan(6000);
    // Check if it's sliced
    expect(result).toContain(longOutput.slice(0, 5000));
  });

  it('should return default message when no information available', () => {
    const mockErrorContext: UnitTestErrorContext = {
      failingTests: [],
      fullTestOutput: '',
    };

    const result = getFailingTestsDetail(mockErrorContext);

    expect(result).toBe('No specific failing test information available');
  });

  it('should return default message when errorContext is undefined', () => {
    const result = getFailingTestsDetail(undefined);

    expect(result).toBe('No specific failing test information available');
  });
});
