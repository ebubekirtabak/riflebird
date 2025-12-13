import type { RiflebirdConfig } from './schema';
import { error as errorLog } from '@utils';

export type AIConfigValidationError = {
  field: string;
  message: string;
};

export type AIConfigValidationResult = {
  valid: boolean;
  errors: AIConfigValidationError[];
};

/**
 * Validates AI configuration before executing commands.
 * Checks for required API keys, valid URLs, and provider-specific requirements.
 */
export function validateAIConfig(ai: RiflebirdConfig['ai']): AIConfigValidationResult {
  const errors: AIConfigValidationError[] = [];

  // Validate based on provider
  switch (ai.provider) {
    case 'openai':
      validateOpenAIConfig(ai, errors);
      break;

    case 'anthropic':
      validateAnthropicConfig(ai, errors);
      break;

    case 'local':
      validateLocalConfig(ai, errors);
      break;

    case 'copilot-cli':
      // copilot-cli doesn't require API key (uses GitHub auth)
      break;

    default:
      errors.push({
        field: 'provider',
        message: `Unknown AI provider: ${ai.provider}`,
      });
  }

  // Validate temperature range
  if (ai.temperature < 0 || ai.temperature > 2) {
    errors.push({
      field: 'temperature',
      message: `Temperature must be between 0 and 2, got: ${ai.temperature}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateOpenAIConfig(
  ai: RiflebirdConfig['ai'],
  errors: AIConfigValidationError[]
): void {
  // Check for API key in config or environment
  const apiKey = ai.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    errors.push({
      field: 'apiKey',
      message: 'OpenAI API key is required. Set it in config or OPENAI_API_KEY environment variable.',
    });
  } else if (apiKey.trim().length === 0) {
    errors.push({
      field: 'apiKey',
      message: 'OpenAI API key cannot be empty.',
    });
  } else if (!apiKey.startsWith('sk-')) {
    errors.push({
      field: 'apiKey',
      message: 'OpenAI API key must start with "sk-".',
    });
  }

  // Validate model name
  if (!ai.model || ai.model.trim().length === 0) {
    errors.push({
      field: 'model',
      message: 'Model name is required for OpenAI provider.',
    });
  }
}

function validateAnthropicConfig(
  ai: RiflebirdConfig['ai'],
  errors: AIConfigValidationError[]
): void {
  // Check for API key - handle empty string vs undefined/null separately
  const hasConfigKey = ai.apiKey !== undefined && ai.apiKey !== null;
  const configKey = hasConfigKey ? ai.apiKey : undefined;
  const envKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = configKey ?? envKey;

  // Check for empty string first
  if (apiKey !== undefined && apiKey !== null && apiKey.trim().length === 0) {
    errors.push({
      field: 'apiKey',
      message: 'Anthropic API key cannot be empty.',
    });
  } else if (!apiKey) {
    errors.push({
      field: 'apiKey',
      message: 'Anthropic API key is required. Set it in config or ANTHROPIC_API_KEY environment variable.',
    });
  }

  // Validate model name
  if (!ai.model || ai.model.trim().length === 0) {
    errors.push({
      field: 'model',
      message: 'Model name is required for Anthropic provider.',
    });
  }
}

function validateLocalConfig(
  ai: RiflebirdConfig['ai'],
  errors: AIConfigValidationError[]
): void {
  // Local provider requires a URL
  if (!ai.url) {
    errors.push({
      field: 'url',
      message: 'URL is required for local AI provider (e.g., http://localhost:11434 for Ollama).',
    });
  } else {
    // Validate URL format
    try {
      const url = new URL(ai.url);

      // Check if it's a valid HTTP/HTTPS URL
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({
          field: 'url',
          message: `Local AI provider URL must use http:// or https:// protocol, got: ${url.protocol}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorLog(message);
      errors.push({
        field: 'url',
        message: `Invalid URL format: ${ai.url}`,
      });
    }
  }

  // Validate model name
  if (!ai.model || ai.model.trim().length === 0) {
    errors.push({
      field: 'model',
      message: 'Model name is required for local AI provider.',
    });
  }
}

/**
 * Validates AI config and throws a descriptive error if invalid.
 * Use this before executing commands that require AI.
 */
export function validateAIConfigOrThrow(ai: RiflebirdConfig['ai']): void {
  const result = validateAIConfig(ai);

  if (!result.valid) {
    const errorMessages = result.errors.map(err => `  - ${err.field}: ${err.message}`).join('\n');
    throw new Error(
      `Invalid AI configuration:\n${errorMessages}\n\nPlease check your riflebird.config.ts file or environment variables.`
    );
  }
}
