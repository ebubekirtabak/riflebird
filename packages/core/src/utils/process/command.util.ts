import { spawnSync } from 'child_process';

export function ensureCommandExists(cmd: string) {
  // Try `which` first (macOS/Linux), then fall back to shell `command -v`.
  try {
    const which = spawnSync('which', [cmd]);
    if (which.status === 0) return true;
  } catch (_err) {
    void _err;
  }

  try {
    const check = spawnSync('command', ['-v', cmd], { shell: true });
    if (check.status === 0) return true;
  } catch (_err) {
    void _err;
  }

  throw new Error(`Command not found: please install ${cmd} to use the ${cmd} provider.`);
}
