import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentHandler } from '../document-handler';
import { CommandContext } from '@commands/base';
import { ProjectContext } from '@models';
import { ProjectContextProvider } from '@providers/project-context-provider';
import { FireInput } from '@commands/fire/types';

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
    } as unknown as CommandContext;

    mockProvider = {} as unknown as ProjectContextProvider;
    mockProjectContext = {} as unknown as ProjectContext;
    mockInput = {} as unknown as FireInput;

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
});
