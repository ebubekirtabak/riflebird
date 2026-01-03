import { CommandContext } from '@commands/base';
import type { FileNode, ProjectContext } from '@models';
import { ProjectContextProvider } from '@providers/project-context-provider';
import { StorybookRunner } from '@runners';
import { FireInput } from '@commands/fire/types';
import { info } from '@utils';

export class DocumentHandler {
  constructor(private context: CommandContext) {}

  async handle(
    projectRoot: string,
    provider: ProjectContextProvider,
    projectContext: ProjectContext,
    input: FireInput,
    matchedFiles: FileNode[]
  ): Promise<string[]> {
    const documentationConfig = this.context.config.documentation;
    if (!documentationConfig) {
      return [];
    }

    const { framework, enabled } = documentationConfig;
    if (!enabled) {
      return [];
    }

    const frameworks = {
      storybook: () => {
        const storybookRunner = new StorybookRunner(this.context);
        return storybookRunner.run(projectRoot, provider, projectContext, input, matchedFiles);
      },
      none: () => {
        info('Documentation framework not specified');
        return [];
      },
    };

    return frameworks[framework as keyof typeof frameworks]();
  }
}
