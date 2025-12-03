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
// Export common constants
export {
  COMMON_EXCLUDE_DIRS,
  COMPONENT_EXTENSIONS,
  TEST_FILE_PATTERNS,
  CONFIG_FILE_PATTERNS,
  RIFLEBIRD_DIR,
  RIFLEBIRD_PROMPTS_DIR,
  RIFLEBIRD_TEMPLATES_DIR,
  RIFLEBIRD_CONFIG_DIR,
} from './src/utils/constants';
export { createAIClient } from './src/helpers/ai-client';

// Export AI models
export type { ChatMessage, ChatCompletionOptions } from './src/models/chat';
export type { AIClient, AIClientResult } from './src/models/ai-client';
export type { FetchResponse } from './src/models/fetch';