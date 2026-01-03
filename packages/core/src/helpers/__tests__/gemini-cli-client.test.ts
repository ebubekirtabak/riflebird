import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGeminiClient, ensureGeminiLoggedIn } from '../gemini-cli-client';
import { executeProcessCommand } from '../../runners/process-execution';
import { ensureCommandExists } from '@utils/process/command.util';
import { ChatMessage } from '@models/chat';

// Mock dependencies
vi.mock('../../runners/process-execution', () => ({
  executeProcessCommand: vi.fn(),
}));

vi.mock('@/utils/process/command.util', () => ({
  ensureCommandExists: vi.fn(),
}));

describe('gemini-cli-client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createGeminiClient', () => {
    const mockConfig = {
      provider: 'gemini-cli' as const,
      model: 'gemini-pro',
      temperature: 0.7,
    };

    it('should throw error if provider is not gemini-cli', async () => {
      await expect(
        createGeminiClient({ ...mockConfig, provider: 'openai' } as unknown as Parameters<
          typeof createGeminiClient
        >[0])
      ).rejects.toThrow('Invalid provider for Gemini Client');
    });

    it('should create client and call executeProcessCommand regarding createChatCompletion', async () => {
      // Mock login check
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      // Mock login session check success
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: 'Available sessions',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const { client } = await createGeminiClient(mockConfig);

      // Mock chat completion execution success
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: JSON.stringify({
          response: 'Hello from Gemini',
          stats: {
            session: { duration: 100 },
            model: { turns: 1 },
            tools: { calls: 0 },
            user: { turns: 1 },
          },
          error: null,
        }),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const response = await client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-pro',
        temperature: 0.7,
      });

      expect(response.choices[0].message.content).toBe('Hello from Gemini');

      const expectedArgs = ['-p', 'Hello', '--output-format', 'json'];
      expect(executeProcessCommand).toHaveBeenCalledTimes(2); // 1 for login, 1 for chat
      expect(executeProcessCommand).toHaveBeenLastCalledWith(
        'gemini',
        expectedArgs,
        expect.objectContaining({
          cwd: expect.any(String), // cwd
          timeout: 300000, // timeout
          shell: false,
        })
      );
    });

    it('should throw error when CLI returns an error object', async () => {
      // Mock login check
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      // Mock login session check success
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: 'Available sessions',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const { client } = await createGeminiClient(mockConfig);

      // Mock chat completion execution with functional error
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: JSON.stringify({
          response: null,
          stats: {
            session: { duration: 100 },
            model: { turns: 0 },
            tools: { calls: 0 },
            user: { turns: 1 },
          },
          error: {
            type: 'FatalAuthenticationError',
            message: 'Authentication failed',
            code: 41,
          },
        }),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gemini-pro',
          temperature: 0.7,
        })
      ).rejects.toThrow('Gemini CLI Error (FatalAuthenticationError): Authentication failed');
    });

    it('should handle execution failure', async () => {
      // Mock login check status
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: 'Available sessions',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const { client } = await createGeminiClient(mockConfig);

      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: '',
        stderr: 'Some error',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gemini-pro',
          temperature: 0.7,
        })
      ).rejects.toThrow('Gemini CLI exited with code 1: Some error');
    });

    it('should handle timeout', async () => {
      // Mock login check status
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: 'Available sessions',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const { client } = await createGeminiClient(mockConfig);

      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: true,
      });

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gemini-pro',
          temperature: 0.7,
        })
      ).rejects.toThrow('Gemini CLI timed out');
    });
    it('should handle array content in messages', async () => {
      // Mock login check
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      // Mock login session check success
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: 'Available sessions',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const { client } = await createGeminiClient(mockConfig);

      // Mock chat completion execution success
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: JSON.stringify({
          response: 'Response',
          stats: {
            session: { duration: 100 },
            model: { turns: 1 },
            tools: { calls: 0 },
            user: { turns: 1 },
          },
          error: null,
        }),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      ];

      await client.createChatCompletion({
        messages,
        model: 'gemini-pro',
      });

      const expectedArgs = ['-p', 'Part 1\nPart 2', '--output-format', 'json'];
      expect(executeProcessCommand).toHaveBeenLastCalledWith(
        'gemini',
        expectedArgs,
        expect.objectContaining({
          cwd: expect.any(String),
          timeout: 300000,
          shell: false,
        })
      );
    });

    it('should fallback to raw output if JSON parsing fails with non-Gemini error', async () => {
      // Mock login check
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      // Mock login session check success
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: 'Available sessions',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const { client } = await createGeminiClient(mockConfig);

      const rawOutput = 'This is not JSON\nMaybe just some text';
      // Mock chat completion execution with invalid JSON
      vi.mocked(executeProcessCommand).mockResolvedValueOnce({
        stdout: rawOutput,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await client.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-pro',
        temperature: 0.7,
      });

      expect(response.choices[0].message.content).toBe(rawOutput);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse Gemini CLI JSON output:',
        expect.any(SyntaxError)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('ensureGeminiLoggedIn', () => {
    it('should resolve if logged in', async () => {
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      vi.mocked(executeProcessCommand).mockResolvedValue({
        stdout: 'Available sessions: default',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await expect(ensureGeminiLoggedIn()).resolves.toBeUndefined();
      expect(executeProcessCommand).toHaveBeenCalledWith(
        'gemini',
        ['--list-sessions'],
        expect.objectContaining({
          cwd: expect.any(String),
          timeout: 10000,
          shell: false,
        })
      );
    });

    it('should resolve if "Loaded cached credentials" is present', async () => {
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      vi.mocked(executeProcessCommand).mockResolvedValue({
        stdout: 'Some output...',
        stderr: 'Loaded cached credentials.',
        exitCode: 0,
        timedOut: false,
      });

      await expect(ensureGeminiLoggedIn()).resolves.toBeUndefined();
    });

    it('should throw if not logged in', async () => {
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      vi.mocked(executeProcessCommand).mockResolvedValue({
        stdout: 'No sessions found',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await expect(ensureGeminiLoggedIn()).rejects.toThrow(
        'Gemini CLI does not seem to be logged in'
      );
    });

    it('should throw if command failed', async () => {
      vi.mocked(ensureCommandExists).mockImplementation(() => true);
      vi.mocked(executeProcessCommand).mockResolvedValue({
        stdout: '',
        stderr: 'Error checking',
        exitCode: 1,
        timedOut: false,
      });

      await expect(ensureGeminiLoggedIn()).rejects.toThrow(
        'Gemini CLI does not seem to be logged in'
      );
    });
  });
});
