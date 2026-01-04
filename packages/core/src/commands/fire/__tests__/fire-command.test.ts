import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FireCommand, FireInput } from '../../fire-command';
import { CommandContext } from '../../base';
import { DocumentHandler } from '@handlers/document-handler';
import { ProjectContextProvider } from '@providers/project-context-provider';
import * as utils from '@utils';
import { getPatternsFromInput, resolveTestTypes } from '../fire-command-helpers';

// Define mocks that need to be accessed in tests
const mocks = vi.hoisted(() => ({
  writeTestByMatchedFiles: vi.fn(),
}));

// Mock both alias and relative path to ensure fire-command.ts uses the mock
vi.mock('@handlers/document-handler', () => ({
  DocumentHandler: vi.fn(),
}));

vi.mock('../fire-command-helpers', () => ({
  getPatternsFromInput: vi.fn(),
  resolveTestTypes: vi.fn(),
}));

vi.mock('../unit-test-writer', () => ({
  UnitTestWriter: vi.fn().mockImplementation(() => ({
    writeTestByMatchedFiles: mocks.writeTestByMatchedFiles,
  })),
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
    mocks.writeTestByMatchedFiles.mockResolvedValue({ files: [], failures: [] });

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

      if (!result.success) {
        console.error('Test execute failed:', result.error);
      }
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

    it('should auto-enable --all if scope is provided', async () => {
      const input: FireInput = {
        testPath: 'some/path',
        scope: 'component',
      };
      // resolveTestTypes should be called with all=true
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (all, _types) => {
          if (all) return ['unit']; // Simulate behavior when all is true
          return ['unit'];
        }
      );

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(true);
      // Verify input mutation or behavior
      // Since input is passed by reference, check if it was mutated
      expect(input.all).toBe(true);
    });

    it('should handle execution errors gracefully', async () => {
      (utils.findProjectRoot as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Project root error')
      );
      const input: FireInput = { testPath: 'file1.ts' };

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project root error');
    });

    it('should handle unit test execution when enabled', async () => {
      const input: FireInput = { testPath: 'file1.ts', testTypes: ['unit'] };
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['unit']);
      mockProvider.getContext.mockResolvedValue({
        testFrameworks: { unit: { name: 'vitest' } },
      });

      mocks.writeTestByMatchedFiles.mockResolvedValue({
        files: ['test1.test.ts'],
        failures: [],
      });

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(true);
      expect(result.result).toContain('test1.test.ts');
    });

    it('should report failures from unit test generation', async () => {
      const input: FireInput = { testPath: 'file1.ts', testTypes: ['unit'] };
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['unit']);
      mockProvider.getContext.mockResolvedValue({
        testFrameworks: { unit: { name: 'vitest' } },
      });

      mocks.writeTestByMatchedFiles.mockResolvedValue({
        files: [],
        failures: [{ file: 'file1.ts', error: 'Generation failed' }],
      });

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(true);
      expect(result.result).toContain('Generation failed');
    });

    it('should log placeholder for E2E tests', async () => {
      const input: FireInput = { testPath: 'file1.ts', testTypes: ['e2e'] };
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['e2e']);

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(true);
      expect(result.result).toContain('E2E test execution (coming soon)');
    });

    it('should log placeholder for Performance tests', async () => {
      const input: FireInput = { testPath: 'file1.ts', testTypes: ['performance'] };
      (resolveTestTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['performance']);

      const result = await fireCommand.execute(input);

      expect(result.success).toBe(true);
      expect(result.result).toContain('Performance testing (coming soon)');
    });
  });
});
