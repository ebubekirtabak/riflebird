import { RiflebirdConfig } from '@config/schema';
import type { AIClient, AIClientResult } from '@models/ai-client';

// Re-export types for convenience
export type { ChatMessage, ChatCompletionOptions } from '@models/chat';
export type { AIClient, AIClientResult } from '@models/ai-client';

export async function createAIClient(
  ai: RiflebirdConfig['ai']
): Promise<AIClientResult> {
  switch (ai.provider) {
    case 'openai':
      return await createOpenAIClient(ai);

    case 'local':
      return await createLocalClient(ai);

    case 'anthropic':
      throw new Error('Anthropic provider support is not implemented yet');

    default:
      throw new Error(`Unknown AI provider: ${ai.provider}`);
  }
}

async function createOpenAIClient(
  ai: RiflebirdConfig['ai']
): Promise<AIClientResult> {
  const OpenAIModule = await import('openai');
  const OpenAIClass = OpenAIModule.default;
  const openaiInstance = new OpenAIClass({ apiKey: ai.apiKey });

  const client: AIClient = {
    createChatCompletion: async (opts) => {
      return await openaiInstance.chat.completions.create({
        ...opts,
      });
    },
  };

  return { client, openaiInstance };
}

async function createLocalClient(
  ai: RiflebirdConfig['ai']
): Promise<AIClientResult> {
  const baseUrl = ai.url ?? process.env.LOCAL_API_URL ?? 'http://127.0.0.1:11434';

  if (typeof fetch !== 'function') {
    throw new Error(
      'Global fetch is not available in this Node runtime. Please run on Node 18+ or provide a fetch polyfill.'
    );
  }

  const client: AIClient = {
    createChatCompletion: async (opts) => {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...opts,
          stream: false,
          options: {
            temperature: opts.temperature,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Local AI provider error: ${response.status} ${text}`);
      }

      return await response.json();
    },
  };

  return { client };
}
