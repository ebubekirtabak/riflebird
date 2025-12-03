export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  children?: FileNode[];
};

export type FileTreeOptions = {
  includeExtensions?: string[];
  excludeDirs?: string[];
  maxDepth?: number;
};