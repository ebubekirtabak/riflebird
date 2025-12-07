import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type ChatMessage = ChatCompletionMessageParam;

export type TextResponseFormat = {
  type: 'text';
};

export type JsonObjectResponseFormat = {
  type: 'json_object';
};

export type JsonSchemaConfig = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type JsonSchemaResponseFormat = {
  type: 'json_schema';
  json_schema: JsonSchemaConfig;
};

export type ResponseFormat =
  | TextResponseFormat
  | JsonObjectResponseFormat
  | JsonSchemaResponseFormat;

export type ChatCompletionOptions = {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
  response_format?: ResponseFormat;
  format?: 'json' | 'json_schema' | 'text' | object;
};

export type OpenAIChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OllamaChatCompletionResponse = {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason: string;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
};
