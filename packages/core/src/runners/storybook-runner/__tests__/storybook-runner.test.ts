import { StorybookRunner } from '../storybook-runner';
import { CommandContext } from '@commands/base';
import { ProjectContext } from '@models';
import { ProjectContextProvider } from '@providers/project-context-provider';
import { StorybookService } from '@services/storybook-service';
import { DocumentWriter } from '@handlers/document-writer';
import { FireInput } from '@commands/fire/types';
import { info } from '@utils';
import { describe, it, expect, beforeEach, vi, MockedClass } from 'vitest';

// Mocks
vi.mock('@services/storybook-service');
vi.mock('@handlers/document-writer');
vi.mock('@handlers/storybook-handler');
vi.mock('@utils', () => ({
  info: vi.fn(),
}));

describe('StorybookRunner', () => {
  let runner: StorybookRunner;
  let mockContext: CommandContext;
  let mockProvider: ProjectContextProvider;
  let mockProjectContext: ProjectContext;
  let mockInput: FireInput;

  // Mock implementations
  const mockStorybookService = StorybookService as unknown as MockedClass<typeof StorybookService>;
  const mockDocumentWriter = DocumentWriter as unknown as MockedClass<typeof DocumentWriter>;
  // Removed unused mockStorybookDocumentHandler

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      config: {
        documentation: { enabled: true },
      },
      aiClient: {},
    } as unknown as CommandContext;

    mockProjectContext = {
      configFiles: {
        framework: { name: 'react' },
      },
    } as unknown as ProjectContext;

    mockInput = {
      onProgress: vi.fn(),
    } as unknown as FireInput;

    runner = new StorybookRunner(mockContext);

    // Default mock setup
    mockStorybookService.prototype.detect.mockResolvedValue({
      version: '7.0.0',
      framework: 'react',
      configPath: '.storybook',
    });
    mockStorybookService.prototype.install.mockResolvedValue(true);
    mockStorybookService.prototype.verify.mockResolvedValue(true);

    mockDocumentWriter.prototype.writeDocumentByMatchedFiles.mockResolvedValue({
      files: ['Created doc 1'],
      failures: [],
    });
  });

  it('should run successfully when Storybook is detected and verified', async () => {
    const results = await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(mockStorybookService.prototype.detect).toHaveBeenCalled();
    expect(mockDocumentWriter.prototype.writeDocumentByMatchedFiles).toHaveBeenCalled();
    expect(mockStorybookService.prototype.verify).toHaveBeenCalled();
    expect(results).toContain('Created doc 1');
    expect(results).toContain('Storybook verification passed.');
  });

  it('should attempt to install Storybook if not detected and allowed', async () => {
    // Ensure framework is unknown so it triggers install logic
    mockProjectContext.configFiles!.framework = undefined;

    mockStorybookService.prototype.detect
      .mockResolvedValueOnce(null) // First detection fails
      .mockResolvedValueOnce({
        version: '7.0.0',
        framework: 'react',
        configPath: '.storybook',
      }); // Second detection after install succeeds

    await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(info).toHaveBeenCalledWith('Storybook not detected. Attempting to install...');
    expect(mockStorybookService.prototype.install).toHaveBeenCalled();
    expect(mockDocumentWriter.prototype.writeDocumentByMatchedFiles).toHaveBeenCalled();
  });

  it('should fail if Storybook installation fails', async () => {
    mockProjectContext.configFiles!.framework = undefined;
    mockStorybookService.prototype.detect.mockResolvedValue(null);
    mockStorybookService.prototype.install.mockResolvedValue(false);

    const results = await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(info).toHaveBeenCalledWith('Storybook installation failed.');
    expect(results).toContain('Storybook installation failed.');
    expect(mockDocumentWriter.prototype.writeDocumentByMatchedFiles).not.toHaveBeenCalled();
  });

  it('should fail if Storybook installation succeeds but detection still fails', async () => {
    mockProjectContext.configFiles!.framework = undefined;
    mockStorybookService.prototype.detect.mockResolvedValue(null);
    mockStorybookService.prototype.install.mockResolvedValue(true);

    const results = await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(info).toHaveBeenCalledWith(
      'Storybook installation seemed to succeed but detection failed.'
    );
    expect(results).toContain('Storybook installation failed to verify.');
  });

  it('should skip storybook if disabled in config', async () => {
    mockProjectContext.configFiles!.framework = undefined;
    mockContext.config.documentation = { enabled: false };
    mockStorybookService.prototype.detect.mockResolvedValue(null);

    const results = await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(mockStorybookService.prototype.install).not.toHaveBeenCalled();
    expect(results).toContain('Skipped document generation: Storybook not available.');
  });

  it('should handle manual framework override if uiFramework is detected', async () => {
    // case where detect returns config but we overwrite framework
    mockProjectContext.configFiles!.framework!.name = 'vue';
    mockStorybookService.prototype.detect.mockResolvedValue({
      version: '7.0.0',
      framework: 'react', // detected as react
      configPath: '.storybook',
    });

    await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(mockDocumentWriter.prototype.writeDocumentByMatchedFiles).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'vue', // It should be passed here
      expect.anything()
    );
  });

  it('should construct storybook config if detected is null but uiFramework is known', async () => {
    mockProjectContext.configFiles!.framework!.name = 'vue';
    mockStorybookService.prototype.detect.mockResolvedValue(null);

    await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(mockDocumentWriter.prototype.writeDocumentByMatchedFiles).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'vue',
      expect.anything()
    );

    expect(mockStorybookService.prototype.verify).toHaveBeenCalled();
  });

  it('should report document generation failures', async () => {
    mockDocumentWriter.prototype.writeDocumentByMatchedFiles.mockResolvedValue({
      files: [],
      failures: [{ file: 'failed.ts', error: 'Some error' }],
    });

    const results = await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(info).toHaveBeenCalledWith(expect.stringContaining('failed to generate stories'));
    expect(results).toContain('\nDocument Failures:');
    expect(results).toContain('  - failed.ts: Some error');
  });

  it('should report verification failure', async () => {
    mockStorybookService.prototype.verify.mockResolvedValue(false);

    const results = await runner.run('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(info).toHaveBeenCalledWith('Storybook verification failed.');
    expect(results).toContain('Storybook verification failed.');
  });
});
