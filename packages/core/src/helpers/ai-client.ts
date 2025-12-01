import type OpenAI from 'openai';
import { RiflebirdConfig } from '@config/schema';
import type { AIClient, AIClientResult } from '@models/ai-client';
import type { FetchResponse } from '@models/fetch';

// Re-export types for convenience
export type { ChatMessage, ChatCompletionOptions } from '@models/chat';
export type { AIClient, AIClientResult } from '@models/ai-client';
export type { FetchResponse } from '@models/fetch';

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
  const OpenAIConstructor = OpenAIModule.default as unknown as {
    new (opts: { apiKey?: string }): OpenAI;
  };
  const openaiInstance = new OpenAIConstructor({ apiKey: ai.apiKey });

  const client: AIClient = {
    createChatCompletion: async (opts) => {
      const openaiRec = openaiInstance as unknown as Record<string, unknown>;
      const chatRec = openaiRec['chat'] as unknown as Record<string, unknown>;
      const completionsRec = chatRec['completions'] as unknown as {
        create: (payload: unknown) => Promise<unknown>;
      };

      return await completionsRec.create({
        model: opts.model,
        temperature: opts.temperature,
        messages: opts.messages,
      });
    },
  };

  return { client, openaiInstance };
}

async function createLocalClient(
  ai: RiflebirdConfig['ai']
): Promise<AIClientResult> {
  const baseUrl = ai.url ?? process.env.LOCAL_API_URL ?? 'http://127.0.0.1:11434';
  const fetchFn = (
    globalThis as unknown as { fetch?: (...args: unknown[]) => Promise<unknown> }
  ).fetch;

  if (!fetchFn) {
    throw new Error(
      'Global fetch is not available in this Node runtime. Please run on Node 18+ or provide a fetch polyfill.'
    );
  }

  const client: AIClient = {
    createChatCompletion: async (opts) => {
      const response = (await fetchFn(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          stream: false,
          options: {
            temperature: opts.temperature,
          },
        }),
      })) as unknown as FetchResponse;

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Local AI provider error: ${response.status} ${text}`);
      }

      return await response.json();
    },
  };

  return { client };
}
