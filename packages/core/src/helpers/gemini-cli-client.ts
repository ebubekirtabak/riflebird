import { RiflebirdConfig } from '@config/schema';
import type { AIClient, AIClientResult } from '@models/ai-client';
import { OpenAIChatCompletionResponse } from '@models/chat';
import { ensureCommandExists } from '@utils/process/command.util';
import { executeProcessCommand } from '@runners/process-execution';
import { GeminiCliOutput } from './types/gemini-cli';

const GEMINI_CLI_CMD = 'gemini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-exp';
const DEFAULT_TIMEOUT = 300000;

function createGeminiResponse(content: string, model?: string): OpenAIChatCompletionResponse {
  return {
    id: `gemini-cli-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || DEFAULT_GEMINI_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

export async function createGeminiClient(ai: RiflebirdConfig['ai']): Promise<AIClientResult> {
  if (ai.provider !== 'gemini-cli') {
    throw new Error(`Invalid provider for Gemini Client: ${ai.provider}`);
  }

  const config = ai;

  await ensureGeminiLoggedIn();

  const client: AIClient = {
    createChatCompletion: async (options) => {
      const messages = options.messages;
      const lastMessage = messages[messages.length - 1];
      const model = config.model;

      const getMessageContent = (content: typeof lastMessage.content): string => {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
          return content
            .map((part) => {
              if ('text' in part && typeof part.text === 'string') return part.text;
              return '';
            })
            .join('\n');
        }
        return '';
      };

      const promptContent = getMessageContent(lastMessage.content);

      const args: string[] = ['-p', promptContent, '--output-format', 'json'];
      const executionResult = await executeProcessCommand(
        GEMINI_CLI_CMD,
        args,
        process.cwd(),
        DEFAULT_TIMEOUT
      );

      if (executionResult.timedOut) {
        throw new Error('Gemini CLI timed out');
      }

      if (executionResult.exitCode !== 0) {
        throw new Error(
          `Gemini CLI exited with code ${executionResult.exitCode}: ${executionResult.stderr}`
        );
      }

      const output = executionResult.stdout;

      try {
        const parsed = JSON.parse(output.trim()) as GeminiCliOutput;

        if (parsed.error) {
          throw new Error(`Gemini CLI Error (${parsed.error.type}): ${parsed.error.message}`);
        }

        return createGeminiResponse(parsed.response ?? '', model);
      } catch (e) {
        // Reraise explicit Gemini errors
        if (e instanceof Error && e.message.startsWith('Gemini CLI Error')) {
          throw e;
        }

        console.warn('Failed to parse Gemini CLI JSON output:', e);
        // Fallback: return raw output if parsing fails entirely, primarily for debugging or if strict mode is off
        return createGeminiResponse(output.trim(), model);
      }
    },
  };

  return { client };
}

export async function ensureGeminiLoggedIn(): Promise<void> {
  ensureCommandExists(GEMINI_CLI_CMD);
  const args = ['--list-sessions'];

  let result;
  try {
    result = await executeProcessCommand(GEMINI_CLI_CMD, args, process.cwd(), 10000);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to check Gemini CLI login status: ${errorMessage}`);
  }

  const fullOutput = result.stdout + result.stderr;

  // Heuristic: check for "Available sessions" or "Loaded cached credentials" presence
  if (
    result.exitCode === 0 &&
    (fullOutput.includes('Available sessions') || fullOutput.includes('Loaded cached credentials.'))
  ) {
    return;
  } else {
    throw new Error(
      `Gemini CLI does not seem to be logged in. Output:\n${fullOutput}\nPlease run '${GEMINI_CLI_CMD} auth' or check your setup.`
    );
  }
}
