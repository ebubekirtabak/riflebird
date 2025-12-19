import {
  type RiflebirdConfig,
  OpenAIConfig,
  AnthropicConfig,
  LocalConfig,
  OtherConfig,
  CopilotCliConfig,
} from './schema';

export type AIConfigValidationError = {
  field: string;
  message: string;
};

export type AIConfigValidationResult = {
  valid: boolean;
  errors: AIConfigValidationError[];
};

export function validateAIConfig(ai: RiflebirdConfig['ai']): AIConfigValidationResult {
  let schema;

  switch (ai.provider) {
    case 'openai':
      schema = OpenAIConfig;
      break;
    case 'anthropic':
      schema = AnthropicConfig;
      break;
    case 'local':
      schema = LocalConfig;
      break;
    case 'other':
      schema = OtherConfig;
      break;
    case 'copilot-cli':
      schema = CopilotCliConfig;
      break;
    default:
      return {
        valid: false,
        errors: [
          {
            field: 'provider',
            message: `Unknown AI provider: ${(ai as RiflebirdConfig['ai']).provider}`,
          },
        ],
      };
  }

  const result = schema.safeParse(ai);

  if (result.success) {
    return {
      valid: true,
      errors: [],
    };
  }

  const errors: AIConfigValidationError[] = result.error.errors.map((err) => ({
    field: String(err.path[0] || 'unknown'),
    message: err.message,
  }));

  return {
    valid: false,
    errors,
  };
}

/**
 * Validates AI config and throws a descriptive error if invalid.
 * Use this before executing commands that require AI.
 */
export function validateAIConfigOrThrow(ai: RiflebirdConfig['ai']): void {
  const result = validateAIConfig(ai);

  if (!result.valid) {
    const errorMessages = result.errors.map((err) => `  - ${err.field}: ${err.message}`).join('\n');
    throw new Error(
      `Invalid AI configuration:\n${errorMessages}\n\nPlease check your riflebird.config.ts file or environment variables.`
    );
  }
}
