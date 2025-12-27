import { RiflebirdConfig } from '@config/schema';
import type { AIClient, AIClientResult } from '@models/ai-client';
import { OpenAIChatCompletionResponse, ChatMessage } from '@models/chat';
import { ensureCommandExists } from '@utils/process/command.util';
import { spawn, spawnSync } from 'child_process';
import { once } from 'events';

const COPILOT_CLI_CMD = 'copilot';
const COPILOT_CLI_DEFAULT_MODEL = 'gpt-4o-mini';

function ensureLoggedIn() {
  const loginUrl =
    'https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli#authenticate-with-github';

  // Check if `gh` is available
  try {
    const ghCheck = spawnSync('command -v gh', { shell: true });
    if (ghCheck.status === 0) {
      // Use `gh auth status` path
      const res = spawnSync('gh', ['auth', 'status']);
      if (res.status === 0) return true;

      // If `gh` is present but auth status failed
      const out = String(res.stdout || '').toLowerCase();
      const err = String(res.stderr || '').toLowerCase();
      throw new Error(
        [
          `GitHub CLI (gh) indicates not authenticated. Please run 'gh auth login' or 'copilot auth login'.`,
          `More info: ${loginUrl}`,
          `stderr: ${err.trim()}`,
          `stdout: ${out.trim()}`,
        ].join('\n')
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('GitHub CLI')) throw e;
  }

  throw new Error(
    [
      `Unable to confirm Copilot CLI authentication. Please ensure 'gh' (GitHub CLI) is installed and authenticated.`,
      `Run 'gh auth login' to authenticate.`,
      `More info: ${loginUrl}`,
    ].join('\n')
  );
}

export async function createCopilotCliClient(ai: RiflebirdConfig['ai']): Promise<AIClientResult> {
  if (ai.provider !== 'copilot-cli') {
    throw new Error(`Invalid provider: ${ai.provider}. Expected 'copilot-cli'.`);
  }

  try {
    ensureCommandExists(COPILOT_CLI_CMD);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Command not found')) {
      throw new Error(
        `Copilot CLI not found. Please install the Copilot CLI to use the copilot-cli provider. More info: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli`
      );
    }
    throw e;
  }
  ensureLoggedIn();
  const hasModelArg = ai.copilotCli?.args?.some(
    (a: string) => a === '--model' || a.startsWith('--model=')
  );
  const spawnArgs = hasModelArg
    ? (ai.copilotCli?.args ?? [])
    : [...(ai.copilotCli?.args ?? []), '--model', String(ai.model ?? COPILOT_CLI_DEFAULT_MODEL)];

  const client: AIClient = {
    createChatCompletion: async (opts): Promise<OpenAIChatCompletionResponse> => {
      // Build a simple plaintext prompt from chat messages
      const promptText = opts.messages
        .map(
          (m) =>
            `${m.role.toString()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`
        )
        .join('\n\n');

      const proc = spawn(COPILOT_CLI_CMD, spawnArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';
      proc.stdout.setEncoding('utf8');
      proc.stderr.setEncoding('utf8');
      proc.stdout.on('data', (d: string) => (stdout += d));
      proc.stderr.on('data', (d: string) => (stderr += d));

      // write prompt and close stdin
      proc.stdin.write(promptText);
      proc.stdin.end();

      const [code] = (await once(proc, 'exit')) as unknown as [number | null, string | null];

      if (code !== 0) {
        throw new Error(`Copilot CLI failed (exit ${code}): ${stderr.trim()}`);
      }

      const content = stdout.trim();

      const message: ChatMessage = {
        role: 'assistant',
        content,
      };

      return {
        id: `copilot-cli-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: opts.model ?? 'copilot-cli',
        choices: [
          {
            index: 0,
            message,
            finish_reason: 'stop',
          },
        ],
      };
    },
  };

  return { client };
}
