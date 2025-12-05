import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAIClient } from '../ai-client';
import type { RiflebirdConfig } from '@config/schema';

describe('ai-client', () => {
  describe('createAIClient', () => {
    it('should throw error for anthropic provider', async () => {
      const config: RiflebirdConfig['ai'] = {
        provider: 'anthropic',
        model: 'claude-3-opus',
        temperature: 0.2,
      };

      await expect(createAIClient(config)).rejects.toThrow(
        'Anthropic provider support is not implemented yet'
      );
    });

    it('should throw error for unknown provider', async () => {
      const config = {
        provider: 'unknown',
        model: 'test-model',
        temperature: 0.2,
      } as unknown as RiflebirdConfig['ai'];

      await expect(createAIClient(config)).rejects.toThrow(
        'Unknown AI provider: unknown'
      );
    });
  });

  describe('createOpenAIClient', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create OpenAI client with provided API key', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'test response' } }],
      });

      const mockOpenAI = vi.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      vi.doMock('openai', () => ({
        default: mockOpenAI,
      }));

      const config: RiflebirdConfig['ai'] = {
        provider: 'openai',
        apiKey: 'test-api-key',
        model: 'gpt-4',
        temperature: 0.7,
      };

      const result = await createAIClient(config);

      expect(result.client).toBeDefined();
      expect(result.openaiInstance).toBeDefined();
      expect(mockOpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should create OpenAI client without API key', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'test response' } }],
      });

      const mockOpenAI = vi.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      vi.doMock('openai', () => ({
        default: mockOpenAI,
      }));

      const config: RiflebirdConfig['ai'] = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
      };

      const result = await createAIClient(config);

      expect(result.client).toBeDefined();
      expect(result.openaiInstance).toBeDefined();
      expect(mockOpenAI).toHaveBeenCalledWith({ apiKey: undefined });
    });

    it('should call OpenAI chat completion with correct parameters', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'test response' } }],
      });

      const mockOpenAI = vi.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      vi.doMock('openai', () => ({
        default: mockOpenAI,
      }));

      const config: RiflebirdConfig['ai'] = {
        provider: 'openai',
        apiKey: 'test-api-key',
        model: 'gpt-4',
        temperature: 0.7,
      };

      const result = await createAIClient(config);

      const messages = [
        { role: 'system' as const, content: 'You are a test assistant' },
        { role: 'user' as const, content: 'Hello' },
      ];

      await result.client.createChatCompletion({
        model: 'gpt-4',
        temperature: 0.7,
        messages,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        temperature: 0.7,
        messages,
      });
    });
  });

  describe('createLocalClient', () => {
    let originalFetch: typeof globalThis.fetch | undefined;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      }
    });

    it('should create local client with default URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'test response' } }),
        text: async () => '',
      });

      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        model: 'llama2',
        temperature: 0.5,
      };

      const result = await createAIClient(config);

      expect(result.client).toBeDefined();
      expect(result.openaiInstance).toBeUndefined();
    });

    it('should create local client with custom URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'test response' } }),
        text: async () => '',
      });

      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        url: 'http://localhost:8080',
        model: 'llama2',
        temperature: 0.5,
      };

      const result = await createAIClient(config);

      await result.client.createChatCompletion({
        model: 'llama2',
        temperature: 0.5,
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should use environment variable for URL when not provided', async () => {
      const originalEnv = process.env.LOCAL_API_URL;
      process.env.LOCAL_API_URL = 'http://custom-env-url:9999';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'test response' } }),
        text: async () => '',
      });

      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        model: 'llama2',
        temperature: 0.5,
      };

      const result = await createAIClient(config);

      await result.client.createChatCompletion({
        model: 'llama2',
        temperature: 0.5,
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-env-url:9999/api/chat',
        expect.anything()
      );

      // Restore original env
      if (originalEnv) {
        process.env.LOCAL_API_URL = originalEnv;
      } else {
        delete process.env.LOCAL_API_URL;
      }
    });

    it('should throw error when fetch is not available', async () => {
      const originalFetch = globalThis.fetch;
      // Temporarily set fetch to undefined to simulate missing fetch
      Object.defineProperty(globalThis, 'fetch', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        model: 'llama2',
        temperature: 0.5,
      };

      await expect(createAIClient(config)).rejects.toThrow(
        'Global fetch is not available in this Node runtime. Please run on Node 18+ or provide a fetch polyfill.'
      );

      // Restore original fetch
      Object.defineProperty(globalThis, 'fetch', {
        value: originalFetch,
        configurable: true,
        writable: true,
      });
    });

    it('should call local API with correct payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'test response' } }),
        text: async () => '',
      });

      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        model: 'llama2',
        temperature: 0.8,
      };

      const result = await createAIClient(config);

      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hi' },
      ];

      await result.client.createChatCompletion({
        model: 'llama2',
        temperature: 0.8,
        messages,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama2',
            temperature: 0.8,
            messages,
            stream: false,
            options: {
              temperature: 0.8,
            },
          }),
        }
      );
    });

    it('should handle local API error responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        model: 'llama2',
        temperature: 0.5,
      };

      const result = await createAIClient(config);

      await expect(
        result.client.createChatCompletion({
          model: 'llama2',
          temperature: 0.5,
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Local AI provider error: 500 Internal Server Error');
    });

    it('should return JSON response from local API', async () => {
      const mockOllamaResponse = {
        message: {
          role: 'assistant',
          content: 'Hello from Ollama!'
        },
        model: 'llama2',
        done: true,
        done_reason: 'stop',
        created_at: '2025-12-06T00:00:00.000Z',
        prompt_eval_count: 10,
        eval_count: 5,
        total_duration: 1000,
        load_duration: 100,
        prompt_eval_duration: 200,
        eval_duration: 300,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOllamaResponse,
        text: async () => '',
      });

      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

      const config: RiflebirdConfig['ai'] = {
        provider: 'local',
        model: 'llama2',
        temperature: 0.5,
      };

      const result = await createAIClient(config);

      const response = await result.client.createChatCompletion({
        model: 'llama2',
        temperature: 0.5,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      // Verify the response is transformed to OpenAI format
      expect(response).toMatchObject({
        model: 'llama2',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello from Ollama!',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });
      expect(response.id).toMatch(/^ollama-\d+$/);
      expect(response.created).toBeGreaterThan(0);
    });
  });
});
