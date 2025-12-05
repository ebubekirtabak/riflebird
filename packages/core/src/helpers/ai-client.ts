import { RiflebirdConfig } from '@config/schema';
import type { AIClient, AIClientResult } from '@models/ai-client';
import {
  OllamaChatCompletionResponse,
  OpenAIChatCompletionResponse,
  ChatMessage
} from '@models/chat';
export type { AIClient, AIClientResult } from '@models/ai-client';
export type { ChatCompletionOptions } from '@models/chat';

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
    createChatCompletion: async (opts): Promise<OpenAIChatCompletionResponse> => {
      return await openaiInstance.chat.completions.create({
        ...opts,
      });
    },
  };

  return { client, openaiInstance };
};

function mapOllamaToOpenAI(ollamaResult: OllamaChatCompletionResponse): OpenAIChatCompletionResponse {
  const { content, role } = ollamaResult.message;
  const { done_reason, model, created_at, prompt_eval_count, eval_count } = ollamaResult;

  const message: ChatMessage = {
    role: role as 'assistant' | 'user' | 'system',
    content,
  };

  return {
    id: `ollama-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(new Date(created_at).getTime() / 1000),
    model,
    choices: [{
      index: 0,
      message,
      finish_reason: done_reason,
    }],
    usage: {
      prompt_tokens: prompt_eval_count,
      completion_tokens: eval_count,
      total_tokens: prompt_eval_count + eval_count,
    },
  };
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
    createChatCompletion: async (opts): Promise<OpenAIChatCompletionResponse> => {
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

      const ollamaResult = await response.json() as OllamaChatCompletionResponse;
      return mapOllamaToOpenAI(ollamaResult);
    },
  };

  return { client };
}
