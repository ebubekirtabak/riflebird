import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PassThrough } from 'stream';
import type { RiflebirdConfig } from '@config/schema';
import type { ChildProcess, SpawnSyncReturns } from 'child_process';

// Type for mock spawn function with lastArgs property
type MockSpawnFunction = ReturnType<typeof vi.fn> & { lastArgs?: string[] };

// Type for mock process returned by spawn
type MockChildProcess = Pick<ChildProcess, 'stdout' | 'stderr' | 'stdin'> & {
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
};

// Mock child_process before importing the module under test
vi.mock('child_process', () => {
  const actualChildProcess = vi.importActual('child_process');

  return {
    ...actualChildProcess,
    spawnSync: vi.fn((cmd: string, args?: unknown) => {
      // Mock successful binary existence checks
      if (cmd === 'which') {
        return {
          status: 0,
          stdout: Buffer.from('/usr/local/bin/copilot'),
          stderr: Buffer.from(''),
        };
      }
      // Mock successful command -v check
      if (typeof cmd === 'string' && cmd.includes('command -v copilot')) {
        return {
          status: 0,
          stdout: Buffer.from('/usr/local/bin/copilot'),
          stderr: Buffer.from(''),
        };
      }
      // Mock successful gh check
      if (typeof cmd === 'string' && cmd.includes('command -v gh')) {
        return { status: 0, stdout: Buffer.from('/usr/local/bin/gh'), stderr: Buffer.from('') };
      }
      // Mock successful auth status
      if (cmd === 'gh' && Array.isArray(args) && args[0] === 'auth') {
        return { status: 0, stdout: Buffer.from('authenticated'), stderr: Buffer.from('') };
      }
      // Default: command not found
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from('command not found') };
    }),
    spawn: vi.fn((cmd: string, args: string[] = []) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdin = new PassThrough();

      // Store the args for assertion
      (spawn as MockSpawnFunction).lastArgs = args;

      // Simulate async CLI output
      process.nextTick(() => {
        stdout.write('Mock copilot CLI response');
        stdout.end();
      });

      const mockProcess = {
        stdout,
        stderr,
        stdin,
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'exit') {
            process.nextTick(() => callback(0, null));
          }
          return mockProcess;
        }),
        once: vi.fn((event: string, callback: Function) => {
          if (event === 'exit') {
            process.nextTick(() => callback(0, null));
          }
          return mockProcess;
        }),
      } as MockChildProcess;

      return mockProcess;
    }),
  };
});

// Import after mocking
import { createCopilotCliClient } from '../copilot-cli-client';
import { spawn, spawnSync } from 'child_process';
import { ChatCompletionContentPartText } from 'openai/resources/chat';

describe('createCopilotCliClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (spawn as MockSpawnFunction).lastArgs = undefined;

    // Reset spawnSync to default success behavior for each test
    const mockSpawnSync = vi.mocked(spawnSync);
    // @ts-expect-error - Mock return type doesn't match exact signature
    mockSpawnSync.mockImplementation((cmd: string, args?: unknown): SpawnSyncReturns<Buffer> => {
      // Mock successful binary existence checks
      if (cmd === 'which') {
        return {
          status: 0,
          stdout: Buffer.from('/usr/local/bin/copilot'),
          stderr: Buffer.from(''),
        } as SpawnSyncReturns<Buffer>;
      }
      // Mock successful command -v check
      if (typeof cmd === 'string' && cmd.includes('command -v copilot')) {
        return {
          status: 0,
          stdout: Buffer.from('/usr/local/bin/copilot'),
          stderr: Buffer.from(''),
        } as SpawnSyncReturns<Buffer>;
      }
      // Mock successful gh check
      if (typeof cmd === 'string' && cmd.includes('command -v gh')) {
        return {
          status: 0,
          stdout: Buffer.from('/usr/local/bin/gh'),
          stderr: Buffer.from(''),
        } as SpawnSyncReturns<Buffer>;
      }
      // Mock successful auth status
      if (cmd === 'gh' && Array.isArray(args) && args[0] === 'auth') {
        return {
          status: 0,
          stdout: Buffer.from('authenticated'),
          stderr: Buffer.from(''),
        } as SpawnSyncReturns<Buffer>;
      }
      // Default: command not found
      return {
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('command not found'),
      } as SpawnSyncReturns<Buffer>;
    });

    // Reset spawn to default success behavior for each test
    const mockSpawn = vi.mocked(spawn);
    mockSpawn.mockImplementation((cmd: string, args: readonly string[] = []): ChildProcess => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdin = new PassThrough();

      // Store the args for assertion
      (spawn as MockSpawnFunction).lastArgs = [...args];

      // Simulate async CLI output
      process.nextTick(() => {
        stdout.write('Mock copilot CLI response');
        stdout.end();
      });

      const mockProcess = {
        stdout,
        stderr,
        stdin,
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'exit') {
            process.nextTick(() => callback(0, null));
          }
          return mockProcess;
        }),
        once: vi.fn((event: string, callback: Function) => {
          if (event === 'exit') {
            process.nextTick(() => callback(0, null));
          }
          return mockProcess;
        }),
      } as MockChildProcess;

      return mockProcess as unknown as ChildProcess;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('client creation and validation', () => {
    it('should successfully create client when copilot binary exists and is authenticated', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        temperature: 0.2,
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      expect(client).toBeDefined();
      expect(client.createChatCompletion).toBeDefined();
      expect(spawnSync).toHaveBeenCalledWith('which', ['copilot']);
      // Should check for gh and auth status
      expect(spawnSync).toHaveBeenCalledWith('command -v gh', { shell: true });
      expect(spawnSync).toHaveBeenCalledWith('gh', ['auth', 'status']);
    });

    it('should throw error when copilot binary is not found', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      // @ts-expect-error - Mock return type doesn't match exact signature
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      } as SpawnSyncReturns<Buffer>);

      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: [] },
      } as unknown as RiflebirdConfig['ai'];

      await expect(createCopilotCliClient(ai)).rejects.toThrow(
        'Copilot CLI not found. Please install the Copilot CLI to use the copilot-cli provider. More info: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli'
      );
      await expect(createCopilotCliClient(ai)).rejects.toThrow('install-copilot-cli');
    });

    it('should throw error when copilot is not authenticated', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      // @ts-expect-error - Mock return type doesn't match exact signature
      mockSpawnSync.mockImplementation((cmd: string, args?: unknown): SpawnSyncReturns<Buffer> => {
        // Binary exists
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/copilot'),
            stderr: Buffer.from(''),
          } as SpawnSyncReturns<Buffer>;
        }
        // Check for gh existence
        if (typeof cmd === 'string' && cmd.includes('command -v gh')) {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/gh'),
            stderr: Buffer.from(''),
          } as SpawnSyncReturns<Buffer>;
        }
        // Auth check fails for gh
        if (cmd === 'gh' && Array.isArray(args) && args[0] === 'auth') {
          return {
            status: 1,
            stdout: Buffer.from(''),
            stderr: Buffer.from('not authenticated'),
          } as SpawnSyncReturns<Buffer>;
        }
        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
        } as SpawnSyncReturns<Buffer>;
      });

      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: [] },
      } as unknown as RiflebirdConfig['ai'];

      await expect(createCopilotCliClient(ai)).rejects.toThrow(
        'GitHub CLI (gh) indicates not authenticated'
      );
      await expect(createCopilotCliClient(ai)).rejects.toThrow('gh auth login');
    });

    it('should handle spawn errors during command checks', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      mockSpawnSync.mockImplementation(() => {
        throw new Error('Spawn process failed');
      });

      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: [] },
      } as unknown as RiflebirdConfig['ai'];

      await expect(createCopilotCliClient(ai)).rejects.toThrow(
        'Copilot CLI not found. Please install the Copilot CLI to use the copilot-cli provider. More info: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli'
      );
    });

    it('should handle spawn errors during auth checks', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      // @ts-expect-error - Mock return type doesn't match exact signature
      mockSpawnSync.mockImplementation((cmd: string) => {
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from('/bin/copilot'),
            stderr: Buffer.from(''),
          } as SpawnSyncReturns<Buffer>;
        }
        if (typeof cmd === 'string' && cmd.includes('command -v gh')) {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/gh'),
            stderr: Buffer.from(''),
          } as SpawnSyncReturns<Buffer>;
        }
        if (cmd === 'gh') {
          throw new Error('Auth command failed');
        }
        return { status: 1 } as SpawnSyncReturns<Buffer>;
      });

      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: [] },
      } as unknown as RiflebirdConfig['ai'];

      await expect(createCopilotCliClient(ai)).rejects.toThrow(
        'Unable to confirm Copilot CLI authentication'
      );
    });
  });

  describe('model injection behavior', () => {
    it('should inject ai.model when no --model arg is provided', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        temperature: 0.2,
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test prompt' }],
      });

      expect(spawn).toHaveBeenCalledWith(
        'copilot',
        ['query', '--model', 'gpt-4'],
        expect.any(Object)
      );
    });

    it('should not inject model when --model already exists in args', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query', '--model', 'custom-model'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(spawn).toHaveBeenCalledWith(
        'copilot',
        ['query', '--model', 'custom-model'],
        expect.any(Object)
      );
    });

    it('should use default model when ai.model is not provided', async () => {
      const ai = {
        provider: 'copilot-cli',
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(spawn).toHaveBeenCalledWith(
        'copilot',
        ['query', '--model', 'gpt-4o-mini'],
        expect.any(Object)
      );
    });

    it('should handle --model= format in args', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query', '--model=preset-model'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      // Should not inject another --model since one already exists
      const lastArgs = (spawn as MockSpawnFunction).lastArgs;
      expect(lastArgs).toEqual(['query', '--model=preset-model']);
      expect(lastArgs?.filter((arg: string) => arg.startsWith('--model')).length).toBe(1);
    });
  });

  describe('chat completion execution', () => {
    it('should return properly formatted OpenAI-style response', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      const response = await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('object', 'chat.completion');
      expect(response).toHaveProperty('created');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('choices');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]).toHaveProperty('message');
      expect(response.choices[0].message).toHaveProperty('role', 'assistant');
      expect(response.choices[0].message).toHaveProperty('content');
      expect(response.choices[0]).toHaveProperty('finish_reason', 'stop');
    });

    it('should construct prompt from chat messages', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const mockSpawn = vi.mocked(spawn);
      let capturedInput = '';

      mockSpawn.mockImplementationOnce(
        (_cmd: string, _args: readonly string[] = []): ChildProcess => {
          const stdout = new PassThrough();
          const stderr = new PassThrough();
          const stdin = new PassThrough();

          stdin.on('data', (chunk) => {
            capturedInput += chunk.toString();
          });

          process.nextTick(() => {
            stdout.write('response');
            stdout.end();
          });

          const mockProcess = {
            stdout,
            stderr,
            stdin,
            on: vi.fn((event: string, callback: Function) => {
              if (event === 'exit') {
                process.nextTick(() => callback(0, null));
              }
              return mockProcess;
            }),
            once: vi.fn((event: string, callback: Function) => {
              if (event === 'exit') {
                process.nextTick(() => callback(0, null));
              }
              return mockProcess;
            }),
          } as MockChildProcess;

          return mockProcess as unknown as ChildProcess;
        }
      );

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(capturedInput).toContain('system: You are a helpful assistant');
      expect(capturedInput).toContain('user: Hello');
    });

    it('should handle complex message content (objects)', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const mockSpawn = vi.mocked(spawn);
      let capturedInput = '';

      mockSpawn.mockImplementationOnce(
        (_cmd: string, _args: readonly string[] = []): ChildProcess => {
          const stdout = new PassThrough();
          const stderr = new PassThrough();
          const stdin = new PassThrough();

          stdin.on('data', (chunk) => {
            capturedInput += chunk.toString();
          });

          process.nextTick(() => {
            stdout.write('response');
            stdout.end();
          });

          const mockProcess = {
            stdout,
            stderr,
            stdin,
            on: vi.fn((e, cb) => {
              if (e === 'exit') process.nextTick(() => cb(0));
              return mockProcess;
            }),
            once: vi.fn((e, cb) => {
              if (e === 'exit') process.nextTick(() => cb(0));
              return mockProcess;
            }),
          } as MockChildProcess;

          return mockProcess as unknown as ChildProcess;
        }
      );

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }] as
              | string
              | Array<ChatCompletionContentPartText>,
          },
        ],
      });

      // Should be JSON stringified
      expect(capturedInput).toContain('user: [{"type":"text","text":"Hello"}]');
    });

    it('should handle CLI process errors', async () => {
      const mockSpawn = vi.mocked(spawn);

      mockSpawn.mockImplementationOnce((): ChildProcess => {
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const stdin = new PassThrough();

        process.nextTick(() => {
          stderr.write('CLI error message');
          stderr.end();
          stdout.end();
        });

        const mockProcess = {
          stdout,
          stderr,
          stdin,
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'exit') {
              process.nextTick(() => callback(1, null)); // Non-zero exit code
            }
            return mockProcess;
          }),
          once: vi.fn((event: string, callback: Function) => {
            if (event === 'exit') {
              process.nextTick(() => callback(1, null));
            }
            return mockProcess;
          }),
        } as MockChildProcess;

        return mockProcess as unknown as ChildProcess;
      });

      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await expect(
        client.createChatCompletion({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Copilot CLI failed');
    });
  });

  describe('argument handling', () => {
    it('should pass through custom args to spawn', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: ['query', '--format', 'json', '--verbose'] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(spawn).toHaveBeenCalledWith(
        'copilot',
        ['query', '--format', 'json', '--verbose', '--model', 'gpt-4'],
        expect.any(Object)
      );
    });

    it('should handle empty args array', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
        copilotCli: { args: [] },
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(spawn).toHaveBeenCalledWith('copilot', ['--model', 'gpt-4'], expect.any(Object));
    });

    it('should handle undefined copilotCli config', async () => {
      const ai = {
        provider: 'copilot-cli',
        model: 'gpt-4',
      } as unknown as RiflebirdConfig['ai'];

      const { client } = await createCopilotCliClient(ai);

      await client.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(spawn).toHaveBeenCalledWith('copilot', ['--model', 'gpt-4'], expect.any(Object));
    });
  });
});
