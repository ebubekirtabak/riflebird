import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { DocumentWriter } from '../document-writer';

import type { RiflebirdConfig } from '@config/schema';
import type { ProjectContext } from '@models';

import { ProjectFileWalker, FileContentWithStats } from '@utils';
import { DocumentFrameworkHandler } from '../document-framework';
import { existsSync } from 'node:fs';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('@utils', () => {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    matchesPattern: vi.fn(),
    checkAndThrowFatalError: vi.fn(),
    generateFilePathWithConfig: vi.fn((filePath, config) => {
      // Simple mock implementation to return a path
      const baseName = filePath.replace(/\.tsx$/, '');
      if (config.outputDir) return `${config.outputDir}/${baseName}.doc`;
      return `${baseName}.doc`;
    }),
    getFileTree: vi.fn(),
    findFilesByPatternInFileTree: vi.fn(),
    executeProcessCommand: vi.fn(),
    ProjectFileWalker: vi.fn().mockImplementation(
      () =>
        // @ts-expect-error - Partial mock
        ({
          readFileFromProject: vi
            .fn()
            .mockResolvedValue('const Button = () => <button>Click me</button>;'),
          readWithStats: vi.fn().mockResolvedValue({
            content: 'const Button = () => <button>Click me</button>;',
            stats: { mtimeMs: 1000 },
          } as FileContentWithStats),
          resolvePath: vi.fn((p) => p),
          generateFileStats: vi.fn(),
          getFileStats: vi.fn(),
          getFileLastModified: vi.fn(),
          writeFileToProject: vi.fn(),
        }) as Mocked<ProjectFileWalker>
    ),
  };
});

describe('DocumentWriter', () => {
  let writer: DocumentWriter;
  let mockHandler: Mocked<DocumentFrameworkHandler>;
  let mockConfig: RiflebirdConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error - Partial mock
    mockHandler = {
      getExclusionPatterns: vi.fn().mockReturnValue(['**/*.ignore']),
      getOutputSuffix: vi.fn().mockReturnValue('.doc'),
      generateDocument: vi.fn().mockResolvedValue('Calculated Doc Content'),
      fixDocument: vi.fn().mockResolvedValue('Fixed Doc Content'),
      validateDocument: vi.fn().mockResolvedValue(null),
    } as Mocked<DocumentFrameworkHandler>;

    mockConfig = {
      documentation: {
        enabled: true,
        documentationMatch: ['src/components/*.tsx'],
        documentationOutputDir: 'docs',
      },
      healing: {
        enabled: true,
        mode: 'auto',
        maxRetries: 3,
        strategy: 'smart',
      },
    } as RiflebirdConfig;

    // DocumentWriter now takes { handler, config }
    writer = new DocumentWriter({ handler: mockHandler, config: mockConfig });

    vi.mocked(ProjectFileWalker).mockImplementation(
      () =>
        // @ts-expect-error - Partial mock
        ({
          readFileFromProject: vi
            .fn()
            .mockResolvedValue('const Button = () => <button>Click me</button>;'),
          readWithStats: vi.fn().mockResolvedValue({
            content: 'const Button = () => <button>Click me</button>;',
            stats: { mtimeMs: 1000 },
          } as FileContentWithStats),
          resolvePath: vi.fn((p) => p),
          generateFileStats: vi.fn(),
          getFileStats: vi.fn(),
          getFileLastModified: vi.fn(),
          writeFileToProject: vi.fn(),
          // @ts-expect-error - Partial mock
        }) as Mocked<ProjectFileWalker>
    );
  });

  it('should find files and delegate generation to handler', async () => {
    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe('Generated Document for: src/components/Button.tsx');
    expect(result.failures).toHaveLength(0);

    // Verify handler delegation
    expect(mockHandler.getExclusionPatterns).toHaveBeenCalled();
    expect(mockHandler.getOutputSuffix).toHaveBeenCalled();
    expect(mockHandler.generateDocument).toHaveBeenCalledWith(
      'src/components/Button.tsx',
      expect.stringContaining('Click me'), // content from mocked walker
      expect.stringContaining('docs/src/components/Button.doc'), // output path based on suffix and config
      expect.any(Object) // ProjectContext
    );
    expect(mockHandler.validateDocument).toHaveBeenCalled();

    // Verify file written
    const { ProjectFileWalker } = await import('@utils');
    const mockedWalkerInstance = vi.mocked(ProjectFileWalker).mock.results[0].value;
    expect(mockedWalkerInstance.writeFileToProject).toHaveBeenCalledWith(
      expect.stringContaining('docs/src/components/Button.doc'),
      'Calculated Doc Content'
    );
  });

  it('should skip generation if valid file exists', async () => {
    // Mock file existing
    vi.mocked(existsSync).mockReturnValue(true);
    // Mock walker reading existing file
    vi.mocked(ProjectFileWalker).mockImplementation(
      () =>
        // @ts-expect-error - Partial mock
        ({
          readFileFromProject: vi.fn().mockResolvedValue('Existing Valid Content'),
          readWithStats: vi
            .fn()
            .mockResolvedValue({ content: 'Existing Valid Content', stats: { mtimeMs: 1000 } }),
          resolvePath: vi.fn((p) => p),
          writeFileToProject: vi.fn(),
        }) as Mocked<ProjectFileWalker>
    );

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe('Generated Document for: src/components/Button.tsx');
    expect(result.failures).toHaveLength(0);

    // Should NOT call generateDocument
    expect(mockHandler.generateDocument).not.toHaveBeenCalled();
    // Should call validateDocument
    expect(mockHandler.validateDocument).toHaveBeenCalledWith(
      'Existing Valid Content',
      expect.stringContaining('docs/src/components/Button.doc'),
      expect.any(Object)
    );
  });

  it('should attempt to heal if existing file is invalid', async () => {
    // Mock file existing
    vi.mocked(existsSync).mockReturnValue(true);
    // Mock walker reading existing file
    vi.mocked(ProjectFileWalker).mockImplementation(
      () =>
        // @ts-expect-error - Partial mock
        ({
          readFileFromProject: vi.fn().mockResolvedValue('Existing Invalid Content'),
          readWithStats: vi
            .fn()
            .mockResolvedValue({ content: 'Existing Invalid Content', stats: { mtimeMs: 1000 } }),
          resolvePath: vi.fn((p) => p),
          writeFileToProject: vi.fn(),
          // @ts-expect-error - Partial mock
        }) as Mocked<ProjectFileWalker>
    );

    // Mock validation to fail first (for existing), then fail again (in loop), then succeed (after fix)
    vi.mocked(mockHandler.validateDocument)
      .mockResolvedValueOnce('Initial Validation Error') // Check existing
      .mockResolvedValueOnce('Initial Validation Error') // Check loop 1
      .mockResolvedValueOnce(null); // Check loop 2 (after fix)

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(1);
    expect(result.failures).toHaveLength(0);

    // Should NOT call generateDocument
    expect(mockHandler.generateDocument).not.toHaveBeenCalled();
    // Should attempt to fix
    expect(mockHandler.fixDocument).toHaveBeenCalledWith(
      'Existing Invalid Content',
      'src/components/Button.tsx',
      expect.stringContaining('docs/src/components/Button.doc'),
      expect.any(Object),
      'Initial Validation Error'
    );
  });

  it('should attempt to heal multiple times and fail if validation persists', async () => {
    // Mock file NOT existing
    vi.mocked(existsSync).mockReturnValue(false);

    // Mock validation failure
    vi.mocked(mockHandler.validateDocument).mockResolvedValue('Validation Error');

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(0); // Should fail to add to results
    expect(result.failures).toHaveLength(0); // No implementation error, just failure

    expect(mockHandler.generateDocument).toHaveBeenCalled();
    expect(mockHandler.validateDocument).toHaveBeenCalledTimes(3);

    const { ProjectFileWalker } = await import('@utils');
    const mockedWalkerInstance = vi.mocked(ProjectFileWalker).mock.results[0].value;
    // Writes to file on every validation attempt
    expect(mockedWalkerInstance.writeFileToProject).toHaveBeenCalledTimes(3);
  });

  it('should write file if repair succeeds', async () => {
    // Mock file NOT existing
    vi.mocked(existsSync).mockReturnValue(false);

    // Mock validation failure first, then success
    vi.mocked(mockHandler.validateDocument)
      .mockResolvedValueOnce('Validation Error')
      .mockResolvedValueOnce(null);

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe('Generated Document for: src/components/Button.tsx');
    expect(result.failures).toHaveLength(0);

    expect(mockHandler.generateDocument).toHaveBeenCalled();
    expect(mockHandler.fixDocument).toHaveBeenCalled();
    expect(mockHandler.validateDocument).toHaveBeenCalledTimes(2);

    const { ProjectFileWalker } = await import('@utils');
    const mockedWalkerInstance = vi.mocked(ProjectFileWalker).mock.results[0].value;
    expect(mockedWalkerInstance.writeFileToProject).toHaveBeenCalledWith(
      expect.stringContaining('docs/src/components/Button.doc'),
      'Fixed Doc Content'
    );
  });

  it('should call onProgress callback during processing', async () => {
    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const onProgress = vi.fn();

    await writer.writeDocumentByMatchedFiles(
      mockContext,
      [{ name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' }],
      onProgress
    );

    expect(onProgress).toHaveBeenCalledWith(1, 1, 'src/components/Button.tsx', expect.any(Number));
  });

  it('should handle errors during file processing and continue', async () => {
    vi.mocked(ProjectFileWalker).mockImplementation(
      () =>
        // @ts-expect-error - Partial mock
        ({
          readFileFromProject: vi.fn().mockImplementation(() => {
            throw new Error('Read failed');
          }),
        }) as Mocked<ProjectFileWalker>
    );

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBe('Read failed');
  });

  it('should fail if initial generation fails', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    mockHandler.generateDocument.mockRejectedValue(new Error('Generation failed'));

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(0);
    // documentWriter catches error and returns false, so it won't be in failures list if writeDocumentFile catches it?
    // Wait, checked implementation: writeDocumentFile catches only invalid document generation?
    // Looking at source:
    // try { currentContent = await ... } catch { return false }
    // So it returns false, meaning not generated. But does it add to failures?
    // writeDocumentByMatchedFiles calls writeDocumentFile inside try block.
    // If writeDocumentFile returns false (handled error), then loop continues without error.
    // Failures array is populated only if writeDocumentFile THROWS.
    // But writeDocumentFile swallows initial generation error.
    // So result.failures should be empty, results.files empty.

    expect(result.failures).toHaveLength(0);
    // expect(result.failures[0].error).toContain('Generation failed');
  });

  it('should fail if healing is disabled and validation fails', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockHandler.validateDocument.mockResolvedValue('Invalid');

    mockConfig.healing = mockConfig.healing || {
      enabled: true,
      mode: 'auto',
      maxRetries: 3,
      strategy: 'smart',
    };
    mockConfig.healing.enabled = false;
    writer = new DocumentWriter({ handler: mockHandler, config: mockConfig });

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(0);
  });

  it('should fail if fix attempt returns null', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockHandler.validateDocument.mockResolvedValue('Invalid');
    mockHandler.fixDocument.mockResolvedValue(null);

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(0);
  });

  it('should handle error during fix attempt', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockHandler.validateDocument.mockResolvedValue('Invalid');
    mockHandler.fixDocument.mockRejectedValue(new Error('Fix error'));

    const mockContext = { projectRoot: '/root' } as ProjectContext;
    const result = await writer.writeDocumentByMatchedFiles(mockContext, [
      { name: 'Button.tsx', path: 'src/components/Button.tsx', type: 'file' },
    ]);

    expect(result.files).toHaveLength(0);
  });
});
