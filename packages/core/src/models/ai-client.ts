import type OpenAI from 'openai';
import { ChatCompletionOptions } from '@models/chat';

export type AIClient = {
  createChatCompletion: (opts: ChatCompletionOptions) => Promise<unknown>;
};

export type AIClientResult = {
  client: AIClient;
  openaiInstance?: OpenAI;
};
