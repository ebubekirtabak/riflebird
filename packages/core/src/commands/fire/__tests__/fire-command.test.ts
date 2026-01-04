import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FireCommand, FireInput } from '../../fire-command';
import { CommandContext } from '../../base';
import { DocumentHandler } from '@handlers/document-handler';
import { ProjectContextProvider } from '@providers/project-context-provider';
import * as utils from '@utils';
import { getPatternsFromInput, resolveTestTypes } from '../fire-command-helpers';

vi.mock('@handlers/document-handler', () => ({
  DocumentHandler: vi.fn(),
}));

vi.mock('../fire-command-helpers', () => ({
  getPatternsFromInput: vi.fn(),
  resolveTestTypes: vi.fn(),
}));

vi.mock('../unit-test-writer', () => ({
  UnitTestWriter: vi.fn(),
}));

vi.mock('@utils', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  findProjectRoot: vi.fn(),
  findFilesByPatternInFileTree: vi.fn(),
}));

vi.mock('@providers/project-context-provider', () => ({
  ProjectContextProvider: vi.fn(),
}));

describe('FireCommand', () => {
  const mockContext = {
    aiClient: {},
    config: {},
  } as unknown as CommandContext;

  let fireCommand: FireCommand;
  const mockDocumentHandler = {
    handle: vi.fn(),
  };
  const mockProvider = {
    getContext: vi.fn(),
    getFileTree: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (DocumentHandler as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockDocumentHandler
    );
    (ProjectContextProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockProvider
    );
    (utils.findProjectRoot as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('/root');
    (utils.findFilesByPatternInFileTree as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      'file1.ts',
    ]);
    (getPatternsFromInput as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['file1.ts']);
    // Default valid types
    (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['unit']);

    mockProvider.getContext.mockResolvedValue({ testFrameworks: {} });
    mockProvider.getFileTree.mockResolvedValue({});
    mockDocumentHandler.handle.mockResolvedValue(['Doc generated']);

    fireCommand = new FireCommand(mockContext);
  });

  it('should be instantiable', () => {
    expect(fireCommand).toBeInstanceOf(FireCommand);
  });

  describe('execute', () => {
    it('should call document handler when document test type is active', async () => {
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['document']);
      const input: FireInput = {
        testTypes: ['document'],
        testPath: 'file1.ts',
      };

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(true);
      expect(DocumentHandler).toHaveBeenCalledWith(mockContext);
      // Verify DocumentHandler.handle was called
      expect(mockDocumentHandler.handle).toHaveBeenCalledWith(
        '/root',
        expect.any(Object), // provider instance
        expect.anything(), // project context
        input,
        ['file1.ts']
      );
      expect(result.result).toContain('Doc generated');
    });

    it('should not call document handler when document test type is not active', async () => {
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['unit']);
      const input: FireInput = {
        testTypes: ['unit'],
        testPath: 'file1.ts',
      };

      // Mock unit test writer behavior if needed, or rely on mocks returning undefined/empty
      await fireCommand.execute(input);

      expect(mockDocumentHandler.handle).not.toHaveBeenCalled();
    });
  });
});
