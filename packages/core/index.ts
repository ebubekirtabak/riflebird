// Export main class
export { Riflebird } from './src/riflebird';

// Export types
export type { RiflebirdConfig } from './src/config/schema';
export type { TestFrameworkAdapter, TestPlan, TestStep, Assertion } from './src/adapters/base';
export type { TestType, TestScope } from './src/commands/fire-command';

// Export config schemas
export {
  AIProviderSchema,
  FrameworkSchema,
  UnitTestFrameworkSchema,
  CoverageProviderSchema,
  CoverageReporterSchema,
  TestEnvironmentSchema,
  DEFAULT_UNIT_TEST_PATTERNS,
  DEFAULT_E2E_TEST_PATTERNS,
  DEFAULT_COVERAGE_INCLUDE,
  DEFAULT_COVERAGE_EXCLUDE,
} from './src/config/schema';

// Export config helper
export { defineConfig } from './src/config/loader';

// Export adapters
export { PlaywrightAdapter } from './src/adapters/playwright';
export { CypressAdapter } from './src/adapters/cypress';

// Export file tree utilities
export { getFileTree, formatFileTree, flattenFileTree } from './src/utils/file-tree';
export type { FileNode, FileTreeOptions } from './src/models/file-tree';

// Export file finder utilities
export {
  findFilesByType,
  findFilesByPattern,
  findFilesByTypes,
  getFileStats,
  FILE_PATTERNS,
} from './src/utils/file-finder';
export type {
  FilePattern,
  FileType,
  FindFilesByPatternOptions,
  FileStats,
} from './src/utils/file-finder';

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

// Export project path utilities
export {
  findProjectRoot,
  getProjectPaths,
  ensureRiflebirdDirs,
  riflebirdDirExists,
  listCustomPrompts,
  readCustomPrompt,
  writeCustomPrompt,
} from './src/utils/project-paths';
export type { ProjectPaths } from './src/utils/project-paths';

// Export AI client helpers
export { createAIClient } from './src/helpers/ai-client';

// Export AI models
export type { ChatMessage, ChatCompletionOptions } from './src/models/chat';
export type { AIClient, AIClientResult } from './src/models/ai-client';
export type { FetchResponse } from './src/models/fetch';

// Export commands
export {
  Command,
  AimCommand,
  FireCommand,
  TargetCommand,
  ReloadCommand,
} from './src/commands';
export type {
  CommandContext,
  AimInput,
  AimOutput,
  FireInput,
  FireOutput,
  TargetInput,
  TargetOutput,
  ReloadInput,
  ReloadOutput,
} from './src/commands';
