export type GeminiCliOutput = {
  response: string | null;
  stats: {
    session: { duration: number };
    model: { turns: number };
    tools: { calls: number };
    user: { turns: number };
  };
  error: {
    type: string;
    message: string;
    code: number | null;
  } | null;
};
