import fs from 'fs/promises';
import path from 'path';
import {
  RIFLEBIRD_DIR,
  RIFLEBIRD_PROMPTS_DIR,
  RIFLEBIRD_TEMPLATES_DIR,
  RIFLEBIRD_CONFIG_DIR,
} from './constants';

export type ProjectPaths = {
  root: string;
  riflebirdDir: string;
  promptsDir: string;
  templatesDir: string;
  configDir: string;
};

/**
 * Find the project root by looking for package.json
 */
export async function findProjectRoot(startPath?: string): Promise<string> {
  let currentPath = startPath || process.cwd();
  const rootPath = path.parse(currentPath).root;

  // Traverse up until we find package.json or reach filesystem root
  while (currentPath !== rootPath) {
    try {
      await fs.access(path.join(currentPath, 'package.json'));
      return currentPath;
    } catch {
      const parentPath = path.dirname(currentPath);
      // Stop if we can't go up anymore
      if (parentPath === currentPath) {
        break;
      }
      currentPath = parentPath;
    }
  }

  // If no package.json found, return the start path
  return startPath || process.cwd();
}

/**
 * Get all Riflebird-related paths in the user's project
 */
export async function getProjectPaths(startPath?: string): Promise<ProjectPaths> {
  const root = await findProjectRoot(startPath);

  return {
    root,
    riflebirdDir: path.join(root, RIFLEBIRD_DIR),
    promptsDir: path.join(root, RIFLEBIRD_DIR, RIFLEBIRD_PROMPTS_DIR),
    templatesDir: path.join(root, RIFLEBIRD_DIR, RIFLEBIRD_TEMPLATES_DIR),
    configDir: path.join(root, RIFLEBIRD_DIR, RIFLEBIRD_CONFIG_DIR),
  };
}

/**
 * Ensure Riflebird directory structure exists in the user's project
 */
export async function ensureRiflebirdDirs(startPath?: string): Promise<ProjectPaths> {
  const paths = await getProjectPaths(startPath);

  // Create directories if they don't exist
  await fs.mkdir(paths.riflebirdDir, { recursive: true });
  await fs.mkdir(paths.promptsDir, { recursive: true });
  await fs.mkdir(paths.templatesDir, { recursive: true });
  await fs.mkdir(paths.configDir, { recursive: true });

  return paths;
}

/**
 * Check if Riflebird directory exists
 */
export async function riflebirdDirExists(startPath?: string): Promise<boolean> {
  const paths = await getProjectPaths(startPath);

  try {
    await fs.access(paths.riflebirdDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all custom prompt files in the user's project
 */
export async function listCustomPrompts(startPath?: string): Promise<string[]> {
  const paths = await getProjectPaths(startPath);

  try {
    const files = await fs.readdir(paths.promptsDir);
    return files.filter((file) => file.endsWith('.md') || file.endsWith('.txt'));
  } catch {
    return [];
  }
}

/**
 * Read a custom prompt file
 */
export async function readCustomPrompt(
  filename: string,
  startPath?: string
): Promise<string> {
  const paths = await getProjectPaths(startPath);
  const promptPath = path.join(paths.promptsDir, filename);

  try {
    return await fs.readFile(promptPath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read custom prompt ${filename}: ${message}`);
  }
}

/**
 * Write a custom prompt file
 */
export async function writeCustomPrompt(
  filename: string,
  content: string,
  startPath?: string
): Promise<void> {
  const paths = await getProjectPaths(startPath);
  await fs.mkdir(paths.promptsDir, { recursive: true });

  const promptPath = path.join(paths.promptsDir, filename);

  try {
    await fs.writeFile(promptPath, content, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write custom prompt ${filename}: ${message}`);
  }
}
