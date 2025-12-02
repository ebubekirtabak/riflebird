import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type ChatMessage = ChatCompletionMessageParam;

export type ChatCompletionOptions = {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
};
