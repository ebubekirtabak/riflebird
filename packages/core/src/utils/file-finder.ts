import { FileNode } from '@models/file-tree';
import { getFileTree, flattenFileTree } from './file-tree';
import { FILE_PATTERNS, FilePattern, FileType, FindFilesByPatternOptions, CompiledPattern, getCompiledPattern } from './file';

/**
 * Find files by predefined file type
 * @param rootPath - Root path to search (ignored if options.fileTree is provided)
 * @param fileType - Predefined file type to search for
 * @param options - Options including optional pre-built fileTree
 */
export async function findFilesByType(
  rootPath: string,
  fileType: FileType,
  options: FindFilesByPatternOptions = {}
): Promise<FileNode[]> {
  const pattern = FILE_PATTERNS[fileType];

  if (!pattern || pattern.patterns.length === 0) {
    throw new Error(`No patterns defined for file type: ${fileType}`);
  }

  return await findFilesByPattern(rootPath, pattern, options);
}

/**
 * wrap string pattern to FilePattern and find files
 * @param rootPath - Root path to search (ignored if options.fileTree is provided)
 * @param pattern - String pattern to match
 * @param options - Options including optional pre-built fileTree
 */
export async function findFilesByStringPattern(
  rootPath: string,
  pattern: string,
  options: FindFilesByPatternOptions = {}
): Promise<FileNode[]> {
  const filePattern: FilePattern = {
    patterns: [pattern],  // Array of string patterns
    description: 'User-provided pattern'
  };

  return await findFilesByPattern(rootPath, filePattern, options);
}

/**
 * Find files matching custom patterns
 * @param rootPath - Root path to search (ignored if options.fileTree is provided)
 * @param pattern - FilePattern to match
 * @param options - Options including optional pre-built fileTree
 */
export async function findFilesByPattern(
  rootPath: string,
  pattern: FilePattern,
  options: FindFilesByPatternOptions = {}
): Promise<FileNode[]> {
  const { caseSensitive = false, fileTree, ...treeOptions } = options;

  // Use provided file tree or fetch it
  let tree: FileNode[];
  if (fileTree) {
    tree = fileTree;
  } else {
    const extensions = pattern.extensions || treeOptions.includeExtensions;

    tree = await getFileTree(rootPath, {
      ...treeOptions,
      includeExtensions: extensions,
    });
  }

  // Pre-compile patterns
  const includePatterns = pattern.patterns.map(p => getCompiledPattern(p, caseSensitive));
  const excludePatterns = options.excludePatterns
    ? options.excludePatterns.map(p => getCompiledPattern(p, caseSensitive))
    : [];

  return flattenAndFilterFiles(tree, includePatterns, excludePatterns, caseSensitive);
}

/**
 * Find files matching multiple file types
 * Optimized to fetch the file tree only once
 * @param rootPath - Root path to search (ignored if options.fileTree is provided)
 * @param fileTypes - Array of file types to search for
 * @param options - Options including optional pre-built fileTree
 */
export async function findFilesByTypes(
  rootPath: string,
  fileTypes: FileType[],
  options: FindFilesByPatternOptions = {}
): Promise<Record<FileType, FileNode[]>> {
  const { caseSensitive = false, fileTree, ...treeOptions } = options;
  const results: Record<string, FileNode[]> = {};
  const patternsByType = new Map<FileType, CompiledPattern[]>();
  const allExtensions = new Set<string>();
  const allIncludePatterns: CompiledPattern[] = [];
  const allExcludePatterns: CompiledPattern[] = options.excludePatterns
    ? options.excludePatterns.map(p => getCompiledPattern(p, caseSensitive))
    : [];

  // Pre-compile all patterns
  for (const fileType of fileTypes) {
    const patternDef = FILE_PATTERNS[fileType];
    if (patternDef) {
      results[fileType] = [];
      (patternDef.extensions || []).forEach(ext => allExtensions.add(ext));
      patternsByType.set(
        fileType,
        patternDef.patterns.map(p => getCompiledPattern(p, caseSensitive))
      );
      allIncludePatterns.push(...patternDef.patterns.map(p => getCompiledPattern(p, caseSensitive)));
    }
  }

  // Fetch or use provided file tree
  const tree = fileTree
    ? fileTree
    : await getFileTree(rootPath, {
      ...treeOptions,
      includeExtensions: allExtensions.size > 0 ? Array.from(allExtensions) : undefined,
    });

  // Flatten and filter once
  const allFiles = flattenFileTree(tree);
  for (const file of allFiles) {
    const name = caseSensitive ? file.name : file.name.toLowerCase();
    const path = caseSensitive ? file.path : file.path.toLowerCase();
    const matchesExclude = allExcludePatterns.some(compiled =>
      compiled.regex.test(compiled.isPathPattern ? path : name)
    );
    if (matchesExclude) continue;

    for (const [fileType, patterns] of patternsByType) {
      if (patterns.some(compiled => compiled.regex.test(compiled.isPathPattern ? path : name))) {
        results[fileType].push(file);
      }
    }
  }

  return results as Record<FileType, FileNode[]>;
}

/**
 * Flatten file tree and filter by patterns
 */
function flattenAndFilterFiles(
  nodes: FileNode[],
  includePatterns: CompiledPattern[],
  excludePatterns: CompiledPattern[],
  caseSensitive: boolean
): FileNode[] {
  const result: FileNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'file') {
      const name = caseSensitive ? node.name : node.name.toLowerCase();
      const path = caseSensitive ? node.path : node.path.toLowerCase();
      const matchesInclude = includePatterns.some(compiled =>
        compiled.regex.test(compiled.isPathPattern ? path : name)
      );
      const matchesExclude = excludePatterns.some(compiled =>
        compiled.regex.test(compiled.isPathPattern ? path : name)
      );
      if (matchesInclude && !matchesExclude) {
        result.push(node);
      }
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return result;
}
