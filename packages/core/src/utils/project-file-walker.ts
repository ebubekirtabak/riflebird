import path from "path";
import fs from "fs/promises";
import { SecretScanner, sanitizationLogger } from '@security';
import { wrapFileContent } from "./markdown-util";


export type ProjectFileWalkerContext = {
  projectRoot: string;
};

export class ProjectFileWalker {

  constructor(private context: ProjectFileWalkerContext) {
    this.context = context;
  }

  async readFileFromProject(filePath: string, wrapContent?: boolean): Promise<string> {
    const fullPath = path.join(this.context.projectRoot, filePath);
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
  }

  writeFileToProject(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.context.projectRoot, filePath);
    return fs.writeFile(fullPath, content, 'utf-8');
  }

}
