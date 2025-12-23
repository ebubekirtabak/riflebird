import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { AgenticRunner } from '../agentic-runner';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';

// Mock dependencies
vi.mock('@utils/project-file-walker', () => {
  const mockInstance = {
    readFileFromProject: vi.fn().mockResolvedValue('// content'),
  };
  return {
    ProjectFileWalker: vi.fn(() => mockInstance),
  };
});

describe('AgenticRunner', () => {
  let runner: AgenticRunner;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockFileWalker: { readFileFromProject: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mock instance
    const { ProjectFileWalker } = await import('@utils/project-file-walker');
    mockFileWalker = new ProjectFileWalker({
      projectRoot: '/test',
    }) as unknown as { readFileFromProject: Mock };

    mockAiClient = {
      createChatCompletion: vi.fn(),
    } as unknown as AIClient;

    mockConfig = {
      ai: {
        model: 'test-model',
        temperature: 0,
      },
    } as RiflebirdConfig;

    runner = new AgenticRunner({
      aiClient: mockAiClient,
      config: mockConfig,
      projectRoot: '/test',
    });
  });

  it('should return code directly if AI provides code immediately', async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'generate_test',
              code: 'success',
            }),
          },
        },
      ],
    });

    const result = await runner.run('Initial Prompt');
    expect(result).toBe('success');
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('should handling loop with file requests', async () => {
    // Round 1: Request file
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'request_files',
              files: ['file1.ts'],
            }),
          },
        },
      ],
    });

    // Round 2: Return code
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'generate_test',
              code: 'final code',
            }),
          },
        },
      ],
    });

    mockFileWalker.readFileFromProject.mockResolvedValue('file content');

    const result = await runner.run('Start');

    expect(result).toBe('final code');
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(mockFileWalker.readFileFromProject).toHaveBeenCalledWith('file1.ts');

    // precise prompt check for the second call
    const secondCallArgs = (mockAiClient.createChatCompletion as Mock).mock.calls[1][0];
    const lastMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMsg.content).toContain('file content');
  });

  it('should use smart file resolution (extensions)', async () => {
    // Round 1: Request component.ts (does not exist)
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'request_files',
              files: ['component.ts'],
            }),
          },
        },
      ],
    });

    // Round 2: Success
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ action: 'generate_test', code: 'done' }),
          },
        },
      ],
    });

    mockFileWalker.readFileFromProject.mockImplementation(async (p: string) => {
      if (p === 'component.ts') throw new Error('Not found');
      if (p === 'component.tsx') return 'found tsx';
      return 'unknown';
    });

    await runner.run('Start');

    expect(mockFileWalker.readFileFromProject).toHaveBeenCalledWith('component.ts');
    expect(mockFileWalker.readFileFromProject).toHaveBeenCalledWith('component.tsx');

    const secondCallArgs = (mockAiClient.createChatCompletion as Mock).mock.calls[1][0];
    const lastMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMsg.content).toContain('Resolved to component.tsx');
    expect(lastMsg.content).toContain('found tsx');
  });

  it('should throw if max iterations exceeded', async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'request_files',
              files: ['ping.ts'],
            }),
          },
        },
      ],
    });

    const shortRunner = new AgenticRunner({
      aiClient: mockAiClient,
      config: mockConfig,
      projectRoot: '/test',
      maxIterations: 2,
    });

    await expect(shortRunner.run('Start')).rejects.toThrow(/iterations/);
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(2);
  });

  it('should handle invalid JSON gracefully', async () => {
    // If invalid JSON, but looks like code, we accept it (fallback)
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [{ message: { content: 'This is not JSON but maybe code?' } }],
    });

    // The current implementation throws "AI response was not valid JSON" if it fails to parse
    // UNLESS we want to support raw text fallback. The UnitTestWriter had logic:
    // catch { debug... throw ... }
    // Wait, looking at current impl:
    // catch { debug(...); throw new Error('AI response was not valid JSON'); }
    // So strict JSON is required.

    await expect(runner.run('Start')).rejects.toThrow('AI response was not valid JSON');
  });
  it('should return null if agent skips test', async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'skip_test',
              reason: 'barrel file',
            }),
          },
        },
      ],
    });

    const result = await runner.run('Start');
    expect(result).toBeNull();
  });

  it('should throw error if AI does not return any choices', async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [],
    });

    await expect(runner.run('Start')).rejects.toThrow('AI did not return any choices');
  });

  it('should throw error if AI returns empty content', async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    });

    await expect(runner.run('Start')).rejects.toThrow('AI returned empty or invalid content');
  });
  it('should use onSuccess callback if provided', async () => {
    const onSuccess = vi.fn().mockResolvedValue('intercepted');
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'generate_test',
              code: 'original',
            }),
          },
        },
      ],
    });

    const result = await runner.run('Start', onSuccess);
    expect(onSuccess).toHaveBeenCalled();
    expect(result).toBe('intercepted');
  });

  it('should handle file reading errors gracefully in context', async () => {
    // Round 1: Request bad file
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify({ action: 'request_files', files: ['bad.ts'] }) } },
      ],
    });

    // Round 2: Success
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify({ action: 'generate_test', code: 'done' }) } },
      ],
    });

    mockFileWalker.readFileFromProject.mockRejectedValue(new Error('Access denied'));

    await runner.run('Start');

    // Verify the error message made it into the context
    const secondCallArgs = (mockAiClient.createChatCompletion as Mock).mock.calls[1][0];
    const lastMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMsg.content).toContain('[Error reading file: Access denied]');
  });

  it('should handle alternate extension read failures', async () => {
    // Mock failure for .ts (main) and .tsx (alternate)
    mockFileWalker.readFileFromProject.mockImplementation(async (path: string) => {
      throw new Error(`Failed to read ${path}`);
    });

    // We need to access the private resolveFile or verify the behavior via run
    // Round 1: Request
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify({ action: 'request_files', files: ['comp.ts'] }) } },
      ],
    });
    // Round 2: Finish
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify({ action: 'generate_test', code: 'done' }) } },
      ],
    });

    await runner.run('Start');

    // The loop for extensions should have run, caught errors, and finally set the main error
    const secondCallArgs = (mockAiClient.createChatCompletion as Mock).mock.calls[1][0];
    const lastMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMsg.content).toContain('[Error reading file: Failed to read comp.ts]');
  });
});
