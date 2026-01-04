import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { DocumentHandler } from '../document-handler';
import { CommandContext } from '@commands/base';
import { ProjectContext } from '@models';
import { ProjectContextProvider } from '@providers/project-context-provider';
import { FireInput } from '@commands/fire/types';

vi.mock('@runners', () => {
  return {
    StorybookRunner: vi.fn().mockImplementation(() => ({
      run: vi.fn().mockResolvedValue(['generated-story']),
    })),
  };
});

vi.mock('@utils', () => ({
  info: vi.fn(),
}));

describe('DocumentHandler', () => {
  let handler: DocumentHandler;
  let mockContext: CommandContext;
  let mockProvider: ProjectContextProvider;
  let mockProjectContext: ProjectContext;
  let mockInput: FireInput;

  beforeEach(() => {
    mockContext = {
      config: {
        documentation: {
          enabled: true,
          framework: 'storybook',
        },
      },
    } as CommandContext;

    mockProvider = {} as ProjectContextProvider;
    mockProjectContext = {} as ProjectContext;
    mockInput = {} as FireInput;

    handler = new DocumentHandler(mockContext);
  });

  it('should handle undefined documentation config gracefully', async () => {
    // @ts-ignore
    mockContext.config.documentation = undefined;
    handler = new DocumentHandler(mockContext);

    const result = await handler.handle('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(result).toEqual([]);
  });

  it('should return empty array if documentation is disabled', async () => {
    mockContext.config.documentation!.enabled = false;
    handler = new DocumentHandler(mockContext);

    const result = await handler.handle('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(result).toEqual([]);
  });

  it('should delegate to StorybookRunner when framework is storybook', async () => {
    mockContext.config.documentation!.framework = 'storybook';
    handler = new DocumentHandler(mockContext);

    const result = await handler.handle('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(result).toEqual(['generated-story']);

    const { StorybookRunner } = await import('@runners');
    expect(StorybookRunner).toHaveBeenCalledWith(mockContext);
    const mockInstance = (StorybookRunner as unknown as Mock).mock.results[0].value;
    expect(mockInstance.run).toHaveBeenCalledWith(
      '/root',
      mockProvider,
      mockProjectContext,
      mockInput,
      []
    );
  });

  it('should return empty array and log info when framework is none', async () => {
    // @ts-ignore
    mockContext.config.documentation!.framework = 'none';
    handler = new DocumentHandler(mockContext);

    const result = await handler.handle('/root', mockProvider, mockProjectContext, mockInput, []);

    expect(result).toEqual([]);
    const { info } = await import('@utils');
    expect(info).toHaveBeenCalledWith('Documentation framework not specified');
  });
});
