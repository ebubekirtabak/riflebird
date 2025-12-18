import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { generateJsonReportPath } from '../index';

describe('generateJsonReportPath', () => {
  it('should generate a path within the cwd', () => {
    const cwd = '/tmp';
    const result = generateJsonReportPath(cwd, 'vitest');
    expect(result.startsWith(cwd)).toBe(true);
  });

  it('should include the framework name in the filename', () => {
    const result = generateJsonReportPath('/tmp', 'vitest');
    expect(result).toContain('.vitest-report-');
  });

  it('should default to unit-test if framework is not provided', () => {
    const result = generateJsonReportPath('/tmp');
    expect(result).toContain('.unit-test-report-');
  });

  it('should sanitize invalid characters in framework name', () => {
    const result = generateJsonReportPath('/tmp', 'my/framework@scope');
    const basename = path.basename(result);
    // "my/framework@scope" -> "my-framework-scope"
    // The regex is /[^a-z0-9-]/gi, replacing with -
    expect(basename).toContain('.my-framework-scope-report-');
    expect(basename).not.toContain('/');
    expect(basename).not.toContain('@');
  });

  it('should utilize unique identifiers (timestamp and uuid)', () => {
    const result1 = generateJsonReportPath('/tmp', 'vitest');
    const result2 = generateJsonReportPath('/tmp', 'vitest');
    expect(result1).not.toBe(result2);
  });

  it('should produce a valid file path format with correct structure', () => {
    const result = generateJsonReportPath('/tmp', 'jest');
    // expected format: /tmp/.jest-report-<timestamp>-<uuid>.json
    const basename = path.basename(result);
    // UUID regex: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
    // But generic hex+dashes is enough for this check
    expect(basename).toMatch(/^\.jest-report-\d+-[a-f0-9-]+\.json$/);
  });
});
