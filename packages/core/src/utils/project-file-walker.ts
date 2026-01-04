import path from 'path';
import fs from 'fs/promises';
import { Stats } from 'fs';
import { SecretScanner, sanitizationLogger } from '@security';
import { wrapFileContent } from './markdown-util';

export type ProjectFileWalkerContext = {
  projectRoot: string;
};

export class ProjectFileWalker {
  constructor(private context: ProjectFileWalkerContext) {}

  async resolveAndValidatePath(filePath: string): Promise<string> {
    const fullPath = path.resolve(this.context.projectRoot, filePath);

    if (!fullPath.startsWith(path.resolve(this.context.projectRoot))) {
      throw new Error(`Security Error: Access denied for path outside project root: ${filePath}`);
    }

    return fullPath;
  }

  async readFileFromProject(filePath: string, wrapContent?: boolean): Promise<string> {
    try {
      const fullPath = await this.resolveAndValidatePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Sanitize the file content before returning
      const result = SecretScanner.sanitize(content, { filePath });

      // Log if secrets were detected
      if (result.secretsDetected > 0) {
        sanitizationLogger.logSanitization(result, filePath);
      }

      if (wrapContent) {
        return wrapFileContent(filePath, result.sanitizedCode);
      }

      return result.sanitizedCode;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
    }
  }

  async writeFileToProject(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = await this.resolveAndValidatePath(filePath);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${(error as Error).message}`);
    }
  }

  async getFileStats(filePath: string): Promise<Stats> {
    try {
      const fullPath = await this.resolveAndValidatePath(filePath);
      return await fs.stat(fullPath);
    } catch (error) {
      throw new Error(`Failed to get stats for file ${filePath}: ${(error as Error).message}`);
    }
  }

  async getFileLastModified(filePath: string): Promise<number> {
    try {
      const stats = await this.getFileStats(filePath);
      return stats.mtimeMs;
    } catch (error) {
      throw new Error(
        `Failed to get last modified time for file ${filePath}: ${(error as Error).message}`
      );
    }
  }
}
