export type ChatMessage = {
  role: string;
  content: string;
};

export type ChatCompletionOptions = {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
};
