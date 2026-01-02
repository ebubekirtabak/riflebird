import type { ProjectContext } from '@models';
import type { RiflebirdConfig } from '@config/schema';

export type DocumentGenerationContext = {
  projectContext: ProjectContext;
  filePath: string;
  config: RiflebirdConfig;
};

export interface DocumentFrameworkHandler {
  getExclusionPatterns(): string[];
  getOutputSuffix(): string;
  generateDocument(
    sourceFilePath: string,
    sourceFileContent: string,
    outputFilePath: string,
    projectContext: ProjectContext,
    framework: string
  ): Promise<string | null>;
  fixDocument(
    content: string,
    filePath: string,
    storyFilePath: string,
    projectContext: ProjectContext,
    validationErrors?: string
  ): Promise<string | null>;
  validateDocument(
    content: string,
    filePath: string,
    projectContext: ProjectContext
  ): Promise<string | null>;
}
