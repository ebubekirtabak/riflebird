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
