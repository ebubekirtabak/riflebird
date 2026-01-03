import type { FileNode, ProjectContext } from '@models';
import {
  info,
  debug,
  ProjectFileWalker,
  matchesPattern,
  checkAndThrowFatalError,
  generateFilePathWithConfig,
} from '@utils';
import type { RiflebirdConfig } from '@config/schema';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentFrameworkHandler } from './document-framework';

export type DocumentWriterOptions = {
  handler: DocumentFrameworkHandler;
  config: RiflebirdConfig;
};

export type DocumentPatternResult = {
  files: string[];
  failures: Array<{ file: string; error: string }>;
};

export class DocumentWriter {
  constructor(private options: DocumentWriterOptions) {}

  /**
   * Write documents for one or more patterns
   */
  async writeDocumentByMatchedFiles(
    projectContext: ProjectContext,
    matchedFiles: FileNode[],
    framework: string,
    onProgress?: (current: number, total: number, file: string, elapsedMs: number) => void
  ): Promise<DocumentPatternResult> {
    const exclusionPatterns = this.options.handler.getExclusionPatterns();

    const filesToProcess = matchedFiles.filter((file) => {
      for (const excludePattern of exclusionPatterns) {
        if (matchesPattern(file.name, file.path, [excludePattern], false)) {
          return false;
        }
      }
      return true;
    });
    info(`After exclusions: ${filesToProcess.length} component files to process`);

    const results: string[] = [];
    const failures: Array<{ file: string; error: string }> = [];
    let current = 0;
    const total = filesToProcess.length;
    const startTime = Date.now();

    for (const file of filesToProcess) {
      current++;
      if (onProgress) {
        onProgress(current, total, file.path, Date.now() - startTime);
      }

      try {
        const generated = await this.writeDocumentFile(projectContext, file.path, framework);
        if (generated) {
          results.push(`Generated Document for: ${file.path}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checkAndThrowFatalError(error);
        failures.push({ file: file.path, error: message });
      }
    }

    return { files: results, failures };
  }

  async writeDocumentFile(projectContext: ProjectContext, filePath: string): Promise<boolean> {
    const fileWalker = new ProjectFileWalker({ projectRoot: projectContext.projectRoot });
    const fileContent = await fileWalker.readFileFromProject(filePath, true);

    debug(`Component file content:\n${fileContent}`);

    const { documentation, healing } = this.options.config;
    const outputSuffix = this.options.handler.getOutputSuffix();

    const storyFilePath = generateFilePathWithConfig(filePath, {
      outputDir: documentation?.documentationOutputDir,
      projectRoot: projectContext.projectRoot,
      suffix: outputSuffix,
    });

    const isHealingEnabled = healing?.enabled !== false;
    const maxRetries = healing?.maxRetries ?? 3;

    let currentContent: string | null = null;
    const documentPath = join(projectContext.projectRoot, storyFilePath);
    const exists = existsSync(documentPath);

    // Initial generation or check existing
    if (exists) {
      info(`Document file already exists: ${storyFilePath}, checking validity...`);
      const existingContent = await fileWalker.readFileFromProject(storyFilePath, false);
      const validationError = await this.options.handler.validateDocument(
        existingContent,
        storyFilePath,
        projectContext
      );

      if (validationError === null) {
        info(`Existing document is valid: ${storyFilePath}, skipping generation.`);
        return true;
      }

      info(`Existing document is invalid: ${storyFilePath}, attempting to heal...`);
      debug(`Validation error: ${validationError}`);
      currentContent = existingContent;
    } else {
      try {
        currentContent = await this.options.handler.generateDocument(
          filePath,
          fileContent,
          storyFilePath,
          projectContext
        );
      } catch (err) {
        checkAndThrowFatalError(err);
        info(`Failed initial generation for ${filePath}: ${err}`);
        // If generation throws, we probably can't fix it easily without content.
        return false;
      }
    }

    if (!currentContent) {
      return false;
    }

    // Validation & Healing Loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await fileWalker.writeFileToProject(storyFilePath, currentContent);
      const validationError = await this.options.handler.validateDocument(
        currentContent,
        storyFilePath,
        projectContext
      );

      // Null return means success (no errors)
      if (validationError === null) {
        info(`Generated/Fixed document: ${storyFilePath}`);
        return true;
      }

      if (!isHealingEnabled || attempt === maxRetries) {
        info(
          `Failed to generate valid document for ${filePath}${attempt === maxRetries ? ' (max retries reached)' : ''}`
        );
        debug(`Validation error: ${validationError}`);
        return false;
      }

      // Healing attempt
      info(`Attempting to fix document for ${filePath} (attempt ${attempt}/${maxRetries})...`);
      try {
        const fixedContent = await this.options.handler.fixDocument(
          currentContent,
          filePath,
          storyFilePath,
          projectContext,
          validationError
        );

        if (fixedContent) {
          currentContent = fixedContent;
        } else {
          info(`Fix attempt failed to return content for ${filePath}`);
          return false;
        }
      } catch (err) {
        checkAndThrowFatalError(err);
        info(`Error during fix attempt for ${filePath}: ${err}`);
        return false;
      }
    }

    return false;
  }
}
