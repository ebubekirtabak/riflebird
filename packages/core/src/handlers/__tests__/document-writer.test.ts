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
        }) as unknown as Mocked<ProjectFileWalker>
    ),
  };
});

describe('DocumentWriter', () => {
  let writer: DocumentWriter;
  let mockHandler: Mocked<DocumentFrameworkHandler>;
  let mockConfig: RiflebirdConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockHandler = {
      getExclusionPatterns: vi.fn().mockReturnValue(['**/*.ignore']),
      getOutputSuffix: vi.fn().mockReturnValue('.doc'),
      generateDocument: vi.fn().mockResolvedValue('Calculated Doc Content'),
      fixDocument: vi.fn().mockResolvedValue('Fixed Doc Content'),
      validateDocument: vi.fn().mockResolvedValue(null),
    } as unknown as Mocked<DocumentFrameworkHandler>;

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
      },
    } as RiflebirdConfig;

    // DocumentWriter now takes { handler, config }
    writer = new DocumentWriter({ handler: mockHandler, config: mockConfig });
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
        ({
          readFileFromProject: vi.fn().mockResolvedValue('Existing Valid Content'),
          readWithStats: vi
            .fn()
            .mockResolvedValue({ content: 'Existing Valid Content', stats: { mtimeMs: 1000 } }),
          resolvePath: vi.fn((p) => p),
          writeFileToProject: vi.fn(),
        }) as unknown as Mocked<ProjectFileWalker>
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
        ({
          readFileFromProject: vi.fn().mockResolvedValue('Existing Invalid Content'),
          readWithStats: vi
            .fn()
            .mockResolvedValue({ content: 'Existing Invalid Content', stats: { mtimeMs: 1000 } }),
          resolvePath: vi.fn((p) => p),
          writeFileToProject: vi.fn(),
        }) as unknown as Mocked<ProjectFileWalker>
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
});
