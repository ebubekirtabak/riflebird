import { ProjectContext, FrameworkInfo } from '@models/project-context';
import { debug, error as errorLog } from '@utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export const CACHE_FOLDER = '.riflebird';
export const CACHE_FILE = 'cache.json';

export class ProjectCacheManager {
  private projectRoot: string;
  private cacheDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.cacheDir = path.join(this.projectRoot, CACHE_FOLDER);
  }

  async hasCache(): Promise<boolean> {
    try {
      const cachePath = path.join(this.cacheDir, CACHE_FILE);
      await fs.access(cachePath);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<ProjectContext | null> {
    try {
      const cachePath = path.join(this.cacheDir, CACHE_FILE);

      const content = await fs.readFile(cachePath, 'utf-8');

      let cache: ProjectContext;
      try {
        cache = JSON.parse(content) as ProjectContext;
      } catch (error) {
        if (error instanceof SyntaxError) {
          debug('Cache file corrupted, invalidating...');
          return null;
        }
        throw error;
      }

      const { isValid, wasUpdated, reconciledCache } = await this.reconcileCache(cache);

      if (isValid) {
        if (wasUpdated && reconciledCache) {
          debug('Cache was stale but repairable, updating...');
          await this.save(reconciledCache);
          return reconciledCache;
        }
        return cache;
      }

      return null;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        debug('Cache file not found');
        return null;
      }
      debug('Error loading cache:', error);
      return null;
    }
  }

  async save(context: ProjectContext): Promise<void> {
    try {
      const cachePath = path.join(this.cacheDir, CACHE_FILE);

      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(context, null, 2), 'utf-8');
      debug('Project context cached successfully');
    } catch (error) {
      errorLog('Error saving cache:', error);
    }
  }

  private async reconcileCache(
    cache: ProjectContext
  ): Promise<{ isValid: boolean; wasUpdated: boolean; reconciledCache?: ProjectContext }> {
    try {
      // Deep copy to avoid mutation
      const reconciledCache = JSON.parse(JSON.stringify(cache)) as ProjectContext;
      let wasUpdated = false;

      const frameworksToCheck: (FrameworkInfo | undefined)[] = [
        reconciledCache.languageConfig,
        reconciledCache.linterConfig,
        reconciledCache.formatterConfig,
        reconciledCache.testFrameworks?.unit,
        reconciledCache.testFrameworks?.e2e,
      ].filter(Boolean);

      for (const framework of frameworksToCheck) {
        if (!framework?.configFilePath) {
          continue;
        }

        const filePath = path.join(this.projectRoot, framework.configFilePath);

        try {
          // Use file descriptor to avoid TOCTOU race condition
          const fileHandle = await fs.open(filePath, 'r');

          try {
            const stats = await fileHandle.stat();
            // Check if file was modified based on mtime
            if (!framework.lastModified || stats.mtimeMs !== framework.lastModified) {
              const content = await fileHandle.readFile({ encoding: 'utf-8' });

              if (content.trim() !== (framework.configContent || '').trim()) {
                debug(`Config file changed, updating cache: ${framework.configFilePath}`);
                framework.configContent = content;
              } else {
                debug(
                  `Config file touched (mtime changed), updating timestamp: ${framework.configFilePath}`
                );
              }

              framework.lastModified = stats.mtimeMs;
              wasUpdated = true;
            }
          } finally {
            await fileHandle.close();
          }
        } catch {
          debug(`Cache invalid: Config file missing ${framework.configFilePath}`);
          return { isValid: false, wasUpdated: false };
        }
      }

      // Check package file content if it was tracked
      const packageFile = reconciledCache.packageManager?.packageFilePath;
      if (packageFile) {
        const packageFilePath = path.join(this.projectRoot, packageFile);
        let fileHandle: fs.FileHandle | undefined;

        try {
          fileHandle = await fs.open(packageFilePath, 'r');
          const stats = await fileHandle.stat();
          const cachedMtime = reconciledCache.packageManager?.packageFileLastModified;

          if (!cachedMtime || stats.mtimeMs !== cachedMtime) {
            const content = await fileHandle.readFile({ encoding: 'utf-8' });
            const previousContent = reconciledCache.packageManager?.packageFileContent;

            if (content.trim() !== (previousContent || '').trim()) {
              debug(`Package file changed, updating cache: ${packageFile}`);
              if (reconciledCache.packageManager) {
                reconciledCache.packageManager.packageFileContent = content;
              }
            } else {
              debug(`Package file touched (mtime changed), updating timestamp: ${packageFile}`);
            }

            if (reconciledCache.packageManager) {
              reconciledCache.packageManager.packageFileLastModified = stats.mtimeMs;
            }
            wasUpdated = true;
          }
        } catch {
          debug(`Cache invalid: Package file missing or unreadable ${packageFile}`);
          return { isValid: false, wasUpdated: false };
        } finally {
          await fileHandle?.close();
        }
      }

      return { isValid: true, wasUpdated, reconciledCache };
    } catch (error) {
      debug('Cache validation error:', error);
      return { isValid: false, wasUpdated: false };
    }
  }
}
