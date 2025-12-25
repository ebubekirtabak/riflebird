import { describe, it, expect } from 'vitest';
import { globToRegex } from '../file-tree';

describe('globToRegex ReDoS', () => {
  it('should not take exponential time for nested braces', () => {
    const start = globalThis.performance.now();

    // Create a string with many open braces: {{{{{...
    // With N=50000, O(N^2) should be noticeable if present.
    const n = 50000;
    const maliciousInput = '{'.repeat(n);

    try {
      globToRegex(maliciousInput);
    } catch {
      // Ignore errors, we care about performance
    }

    const end = globalThis.performance.now();
    const duration = end - start;

    console.log(`Duration for N=${n}: ${duration}ms`);

    // If it's O(N^2), 50k might ensure a few seconds or more.
    // If it's O(N), it should be < 100ms.
    // We'll assert it's fast enough (e.g., under 1s).
    // Note: If this fails (times out), it confirms the vulnerability.
    expect(duration).toBeLessThan(1000);
  });

  it('should handle brace expansion correctly', () => {
    // Ensure we don't break valid cases
    const regex = globToRegex('src/*.{ts,tsx}');
    expect(regex.test('src/index.ts')).toBe(true);
    expect(regex.test('src/index.tsx')).toBe(true);
    expect(regex.test('src/index.js')).toBe(false);
  });
});
