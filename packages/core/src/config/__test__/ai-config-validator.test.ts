import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateAIConfig, validateAIConfigOrThrow } from '../ai-config-validator';
import type { RiflebirdConfig } from '../schema';

describe('ai-config-validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateAIConfig', () => {
    describe('OpenAI provider', () => {
      it('should pass validation with valid API key in config', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'sk-test123456789',
          model: 'gpt-4o-mini',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should pass validation with API key in environment variable', () => {
        process.env.OPENAI_API_KEY = 'sk-env123456789';

        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail validation without API key', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('apiKey');
        expect(result.errors[0].message).toContain('required');
      });

      it('should fail validation with empty API key', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: '   ',
          model: 'gpt-4o-mini',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('apiKey');
        expect(result.errors[0].message).toContain('cannot be empty');
      });

      it('should fail validation with invalid API key format', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'invalid-key-format',
          model: 'gpt-4o-mini',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('apiKey');
        expect(result.errors[0].message).toContain('must start with "sk-"');
      });

      it('should fail validation without model name', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'sk-test123456789',
          model: '',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('model');
        expect(result.errors[0].message).toContain('required');
      });
    });

    describe('Anthropic provider', () => {
      it('should pass validation with valid API key in config', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'anthropic',
          apiKey: 'sk-ant-test123',
          model: 'claude-3-sonnet',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should pass validation with API key in environment variable', () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-env123';

        const ai: RiflebirdConfig['ai'] = {
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail validation without API key', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('apiKey');
        expect(result.errors[0].message).toContain('Anthropic API key is required');
      });

      it('should fail validation with empty API key', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'anthropic',
          apiKey: '',
          model: 'claude-3-sonnet',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('apiKey');
        expect(result.errors[0].message).toContain('cannot be empty');
      });

      it('should fail validation without model name', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'anthropic',
          apiKey: 'sk-ant-test123',
          model: '',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('model');
      });
    });

    describe('Local provider', () => {
      it('should pass validation with valid URL and model', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'local',
          url: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should pass validation with HTTPS URL', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'local',
          url: 'https://my-ai-server.local:8080',
          model: 'custom-model',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail validation without URL', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'local',
          model: 'llama2',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('url');
        expect(result.errors[0].message).toContain('URL is required');
      });

      it('should fail validation with invalid URL format', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'local',
          url: 'not-a-valid-url',
          model: 'llama2',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('url');
        expect(result.errors[0].message).toContain('Invalid URL format');
      });

      it('should fail validation with non-HTTP protocol', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'local',
          url: 'ftp://localhost:11434',
          model: 'llama2',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('url');
        expect(result.errors[0].message).toContain('must use http:// or https://');
      });

      it('should fail validation without model name', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'local',
          url: 'http://localhost:11434',
          model: '',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('model');
      });
    });

    describe('Copilot CLI provider', () => {
      it('should pass validation without API key', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'copilot-cli',
          model: 'gpt-4',
          temperature: 0.2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Temperature validation', () => {
      it('should fail validation with temperature below 0', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'gpt-4o-mini',
          temperature: -0.1,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'temperature')).toBe(true);
      });

      it('should fail validation with temperature above 2', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'gpt-4o-mini',
          temperature: 2.1,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'temperature')).toBe(true);
      });

      it('should pass validation with temperature at boundary (0)', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'gpt-4o-mini',
          temperature: 0,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
      });

      it('should pass validation with temperature at boundary (2)', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'gpt-4o-mini',
          temperature: 2,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(true);
      });
    });

    describe('Multiple errors', () => {
      it('should collect multiple validation errors', () => {
        const ai: RiflebirdConfig['ai'] = {
          provider: 'openai',
          apiKey: 'invalid',
          model: '',
          temperature: 3,
        };

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
        expect(result.errors.some(e => e.field === 'apiKey')).toBe(true);
        expect(result.errors.some(e => e.field === 'model')).toBe(true);
        expect(result.errors.some(e => e.field === 'temperature')).toBe(true);
      });
    });

    describe('Unknown provider', () => {
      it('should fail validation with unknown provider', () => {
        const ai = {
          provider: 'unknown-provider',
          model: 'test',
          temperature: 0.2,
        } as unknown as RiflebirdConfig['ai'];

        const result = validateAIConfig(ai);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('provider');
        expect(result.errors[0].message).toContain('Unknown AI provider');
      });
    });
  });

  describe('validateAIConfigOrThrow', () => {
    it('should not throw for valid config', () => {
      const ai: RiflebirdConfig['ai'] = {
        provider: 'openai',
        apiKey: 'sk-test123',
        model: 'gpt-4o-mini',
        temperature: 0.2,
      };

      expect(() => validateAIConfigOrThrow(ai)).not.toThrow();
    });

    it('should throw with descriptive error for invalid config', () => {
      const ai: RiflebirdConfig['ai'] = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.2,
      };

      expect(() => validateAIConfigOrThrow(ai)).toThrow(/Invalid AI configuration/);
      expect(() => validateAIConfigOrThrow(ai)).toThrow(/apiKey/);
      expect(() => validateAIConfigOrThrow(ai)).toThrow(/required/);
    });

    it('should throw with all error details', () => {
      const ai: RiflebirdConfig['ai'] = {
        provider: 'openai',
        apiKey: 'invalid',
        model: '',
        temperature: 3,
      };

      expect(() => validateAIConfigOrThrow(ai)).toThrow(/apiKey/);
      expect(() => validateAIConfigOrThrow(ai)).toThrow(/model/);
      expect(() => validateAIConfigOrThrow(ai)).toThrow(/temperature/);
    });
  });
});
