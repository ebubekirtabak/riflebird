import { FileNode } from "@/models/file-tree";
import { FileType } from "./file-patterns";

export type FileStats = {
  total: number;
  byExtension: Record<string, number>;
  byType?: Record<FileType, number>;
};

export function getFileStats(files: FileNode[]): FileStats {
  const stats: FileStats = {
    total: files.length,
    byExtension: {},
  };

  for (const file of files) {
    if (file.extension) {
      stats.byExtension[file.extension] = (stats.byExtension[file.extension] || 0) + 1;
    }
  }

  return stats;
}
