import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ora from 'ora';
import { createProgressHandler, type ProgressState } from '../process-handler';

type MockSpinner = ReturnType<typeof ora>;

describe('createProgressHandler', () => {
  let mockSpinner: MockSpinner;
  let progressState: ProgressState;
  let timerRef: { current: NodeJS.Timeout | undefined };

  beforeEach(() => {
    vi.useFakeTimers();
    mockSpinner = { text: '' } as MockSpinner;
    progressState = {
      current: 0,
      total: 0,
      file: '',
      startTime: Date.now(),
    };
    timerRef = { current: undefined };
  });

  afterEach(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    vi.useRealTimers();
  });

  it('should update progress state when called', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'test-file.ts', 1000);

    expect(progressState.current).toBe(1);
    expect(progressState.total).toBe(5);
    expect(progressState.file).toBe('test-file.ts');
    expect(progressState.startTime).toBeLessThanOrEqual(Date.now() - 1000);
  });

  it('should update spinner text with progress information', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(2, 10, 'component.tsx', 5000);

    expect(mockSpinner.text).toBe('🔥 Generating tests... (2/10) [5.0s] component.tsx \n');
  });

  it('should format elapsed time in milliseconds for values < 1000ms', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 500);

    expect(mockSpinner.text).toContain('[500ms]');
  });

  it('should format elapsed time in seconds for values >= 1000ms', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 3500);

    expect(mockSpinner.text).toContain('[3.5s]');
  });

  it('should start live timer on first progress update when total > 0', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 1000);

    expect(timerRef.current).toBeDefined();
  });

  it('should not start timer if total is 0', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(0, 0, 'file.ts', 1000);

    expect(timerRef.current).toBeUndefined();
  });

  it('should only start timer once on subsequent calls', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file1.ts', 1000);
    const firstTimer = timerRef.current;

    handler(2, 5, 'file2.ts', 2000);
    const secondTimer = timerRef.current;

    expect(firstTimer).toBe(secondTimer);
  });

  it('should update spinner text via live timer with increasing elapsed time', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 0);

    // Initial update
    expect(mockSpinner.text).toBe('🔥 Generating tests... (1/5) [0ms] file.ts \n');

    // Advance time by 500ms and trigger timer
    vi.advanceTimersByTime(100);
    expect(mockSpinner.text).toContain(`(1/5)`);
    expect(mockSpinner.text).toContain('file.ts');

    // Advance time by another 400ms (total 500ms)
    vi.advanceTimersByTime(400);
    const elapsed = mockSpinner.text.match(/\[(\d+(?:\.\d+)?(?:ms|s))\]/);
    expect(elapsed).toBeTruthy();
  });

  it('should handle multiple files in sequence', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 3, 'file1.ts', 1000);
    expect(mockSpinner.text).toContain('file1.ts');
    expect(mockSpinner.text).toContain('(1/3)');

    handler(2, 3, 'file2.tsx', 3000);
    expect(mockSpinner.text).toContain('file2.tsx');
    expect(mockSpinner.text).toContain('(2/3)');

    handler(3, 3, 'file3.js', 5000);
    expect(mockSpinner.text).toContain('file3.js');
    expect(mockSpinner.text).toContain('(3/3)');
  });

  it('should maintain state across multiple progress updates', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 10, 'first.ts', 100);
    expect(progressState.current).toBe(1);
    expect(progressState.file).toBe('first.ts');

    handler(5, 10, 'middle.tsx', 5000);
    expect(progressState.current).toBe(5);
    expect(progressState.file).toBe('middle.tsx');

    handler(10, 10, 'last.js', 10000);
    expect(progressState.current).toBe(10);
    expect(progressState.file).toBe('last.js');
  });

  it('should calculate correct start time based on elapsed time', () => {
    const currentTime = Date.now();
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 2500);

    expect(progressState.startTime).toBe(currentTime - 2500);
  });

  it('should update live timer text format based on elapsed time threshold', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    // Start at 500ms
    handler(1, 5, 'file.ts', 500);
    expect(mockSpinner.text).toContain('[500ms]');

    // Advance to cross 1000ms threshold
    vi.advanceTimersByTime(600); // Now at 1100ms
    expect(mockSpinner.text).toMatch(/\[\d+\.\d+s\]/);
  });

  it('should handle zero elapsed time', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 0);

    expect(mockSpinner.text).toContain('[0ms]');
  });

  it('should format seconds with one decimal place', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 12345);

    expect(mockSpinner.text).toContain('[12.3s]');
  });

  it('should handle very large elapsed times', () => {
    const handler = createProgressHandler(mockSpinner, progressState, timerRef);

    handler(1, 5, 'file.ts', 125000); // 125 seconds

    expect(mockSpinner.text).toContain('[125.0s]');
  });
});
