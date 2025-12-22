import { AIClient } from '@/models';
import { RiflebirdConfig } from '@config/schema';

export type AgenticOptions = {
  aiClient: AIClient;
  config: RiflebirdConfig;
  projectRoot: string;
  maxIterations?: number;
};

export type AgenticFileRequest = {
  action: 'request_files';
  files: string[];
};

export type AgenticGenerateResponse = {
  action: 'generate_test' | 'fix_test' | 'success'; // Generic success action
  code: string;
};

export type AgenticSkipResponse = {
  action: 'skip_test';
  reason: string;
};

export type AgenticResponse = AgenticFileRequest | AgenticGenerateResponse | AgenticSkipResponse;

export function isSkipAction(response: AgenticResponse): response is AgenticSkipResponse {
  return response.action === 'skip_test';
}
