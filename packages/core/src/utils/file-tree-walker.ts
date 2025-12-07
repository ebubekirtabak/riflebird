import type { FileNode } from '@models/file-tree';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';
import { ProjectConfigFiles } from '@models/project-config-files';
import { encode } from '@toon-format/toon';
import { debug } from '@utils/log-util';

export type FileTreeWalkerContext = {
  projectRoot: string;
  fileTree: FileNode[];
  aiClient: AIClient;
  config: RiflebirdConfig;
};

export class FileTreeWalker {
  context: FileTreeWalkerContext;

  constructor(context: FileTreeWalkerContext) {
    this.context = context;
  }

  async findConfigFiles(): Promise<ProjectConfigFiles> {
    debug(`Here is the file tree of the project:\n\n${encode(this.context.fileTree)}`);
    const projectConfigPrompt = await import('@prompts/project-configuration.txt');

    const { choices = [] } = await this.context.aiClient.createChatCompletion({
      model: this.context.config.ai.model,
      temperature: this.context.config.ai.temperature,
      response_format: { type: "json_object" },
      format: 'json',
      messages: [
        {
          role: 'system',
          content: projectConfigPrompt.default
            .replace(/\{\{FILE_TREE\}\}/g, encode(this.context.fileTree))
        }
      ],
    });

    let { content } = choices[0].message;
    let parsedContent: unknown = content;

    if (content && typeof content === 'string') {
      parsedContent = JSON.parse(content);
    }

    debug('AI response for config files:', parsedContent);
    return parsedContent as ProjectConfigFiles;
  }

}
