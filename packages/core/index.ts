// Export main class
export { Riflebird } from './src/riflebird';

// Export types
export type { RiflebirdConfig } from './src/config/schema';
export type { TestFrameworkAdapter, TestPlan, TestStep, Assertion } from './src/adapters/base';

// Export config helper
export { defineConfig } from './src/config/loader';

// Export adapters
export { PlaywrightAdapter } from './src/adapters/playwright';
export { CypressAdapter } from './src/adapters/cypress';// Export AI client helpers
export { createAIClient } from './src/helpers/ai-client';

// Export AI models
export type { ChatMessage, ChatCompletionOptions } from './src/models/chat';
export type { AIClient, AIClientResult } from './src/models/ai-client';
export type { FetchResponse } from './src/models/fetch';