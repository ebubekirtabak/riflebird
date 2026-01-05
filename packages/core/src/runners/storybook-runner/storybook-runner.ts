import { CommandContext } from '@commands/base';
import type { FileNode, ProjectContext } from '@models';
import type { ProjectContextProvider } from '@providers/project-context-provider';
import { StorybookService } from '@services/storybook-service';
import { DocumentWriter } from '@handlers/document-writer';
import { StorybookDocumentHandler } from '@handlers/storybook-handler';
import { FireInput } from '@commands/fire/types';
import { info } from '@utils';

export class StorybookRunner {
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  async run(
    projectRoot: string,
    provider: ProjectContextProvider,
    projectContext: ProjectContext,
    input: FireInput,
    matchedFiles: FileNode[]
  ): Promise<string[]> {
    const results: string[] = [];
    const docConfig = this.context.config.documentation;
    const storybookService = new StorybookService(projectRoot, projectContext);

    let storybookConfig = await storybookService.detect();
    const uiFramework = projectContext.configFiles?.framework?.name || 'unknown';

    if (uiFramework && uiFramework !== 'unknown') {
      if (storybookConfig) {
        storybookConfig.framework = uiFramework;
      } else {
        storybookConfig = {
          version: 'unknown',
          framework: uiFramework,
          configPath: '',
        };
      }
    }

    if (!storybookConfig && (!docConfig || docConfig.enabled !== false)) {
      info('Storybook not detected. Attempting to install...');
      const installed = await storybookService.install();
      if (installed) {
        storybookConfig = await storybookService.detect();
        if (!storybookConfig) {
          info('Storybook installation seemed to succeed but detection failed.');
          results.push('Storybook installation failed to verify.');
        }
      } else {
        info('Storybook installation failed.');
        results.push('Storybook installation failed.');
      }
    }

    if (storybookConfig) {
      info(`Detected Storybook v${storybookConfig.version} (${storybookConfig.framework})`);

      const handler = new StorybookDocumentHandler({
        aiClient: this.context.aiClient,
        config: this.context.config,
      });
      const documentWriter = new DocumentWriter({ handler, config: this.context.config });
      const { files, failures } = await documentWriter.writeDocumentByMatchedFiles(
        projectContext,
        matchedFiles,
        input.onProgress
      );
      results.push(...files);

      if (failures.length > 0) {
        info(`\n⚠️  ${failures.length} file(s) failed to generate stories:`);
        failures.forEach((f) => info(`  - ${f.file}: ${f.error}`));
        const failureMsgs = failures.map((f) => `  - ${f.file}: ${f.error}`);
        results.push('\nDocument Failures:', ...failureMsgs);
      }
    } else {
      results.push('Skipped document generation: Storybook not available.');
    }

    if (storybookConfig) {
      info('Verifying Storybook stories...');
      const verificationPassed = await storybookService.verify();
      if (verificationPassed) {
        info('Storybook verification passed.');
        results.push('Storybook verification passed.');
      } else {
        info('Storybook verification failed.');
        results.push('Storybook verification failed.');
      }
    }

    return results;
  }
}
