import ora from 'ora';

export type ProgressState = {
  current: number;
  total: number;
  file: string;
  startTime: number;
};

export function createProgressHandler(
  spinner: ReturnType<typeof ora>,
  state: ProgressState,
  timerRef: { current: NodeJS.Timeout | undefined }
) {
  return (current: number, total: number, file: string, elapsedMs: number) => {
    state.current = current;
    state.total = total;
    state.file = file;
    state.startTime = Date.now() - elapsedMs;

    // Start live timer on first progress update
    if (!timerRef.current && total > 0) {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        const timeStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
        spinner.text = `🔥 Generating tests... (${state.current}/${state.total}) [${timeStr}] ${state.file} \n`;
      }, 100); // Update every 100ms
    }

    const timeStr = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
    spinner.text = `🔥 Generating tests... (${current}/${total}) [${timeStr}] ${file} \n`;
  };
}
