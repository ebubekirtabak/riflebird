import path from "path";
import fs from "fs/promises";

export type ProjectFileWalkerContext = {
  projectRoot: string;
};

export class ProjectFileWalker {

  constructor(private context: ProjectFileWalkerContext) {
    this.context = context;
  }

  readFileFromProject(filePath: string): Promise<string> {
    const fullPath = path.join(this.context.projectRoot, filePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  writeFileToProject(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.context.projectRoot, filePath);
    return fs.writeFile(fullPath, content, 'utf-8');
  }

}
