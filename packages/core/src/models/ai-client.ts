import type OpenAI from 'openai';
import {
  ChatCompletionOptions,
  OllamaChatCompletionResponse,
  OpenAIChatCompletionResponse
} from '@models/chat';

export type AIClient = {
  createChatCompletion: (opts: ChatCompletionOptions) => Promise<OpenAIChatCompletionResponse>;
  mapResponseToOpenAI?: (response: OllamaChatCompletionResponse) => OpenAIChatCompletionResponse;
};

export type AIClientResult = {
  client: AIClient;
  openaiInstance?: OpenAI;
};
