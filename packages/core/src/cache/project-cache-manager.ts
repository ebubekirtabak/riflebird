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
      const cacheExists = await fs
        .access(cachePath)
        .then(() => true)
        .catch(() => false);

      return cacheExists;
    } catch (error) {
      debug('Error checking cache:', error);
      return false;
    }
  }

  async load(): Promise<ProjectContext | null> {
    try {
      const cachePath = path.join(this.cacheDir, CACHE_FILE);

      const content = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(content) as ProjectContext;

      const { isValid, wasUpdated } = await this.reconcileCache(cache);

      if (isValid) {
        if (wasUpdated) {
          debug('Cache was stale but repairable, updating...');
          await this.save(cache);
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
  ): Promise<{ isValid: boolean; wasUpdated: boolean }> {
    try {
      let wasUpdated = false;
      const frameworksToCheck: (FrameworkInfo | undefined)[] = [
        cache.languageConfig,
        cache.linterConfig,
        cache.formatterConfig,
        cache.testFrameworks?.unit,
        cache.testFrameworks?.e2e,
      ].filter(Boolean);

      for (const framework of frameworksToCheck) {
        if (!framework?.configFilePath || !framework?.configContent) {
          continue;
        }

        const filePath = path.join(this.projectRoot, framework.configFilePath);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Update cache if content changed
          if (content.trim() !== framework.configContent.trim()) {
            debug(`Config file changed, updating cache: ${framework.configFilePath}`);
            framework.configContent = content;
            wasUpdated = true;
          }
        } catch {
          debug(`Cache invalid: Config file missing ${framework.configFilePath}`);
          return { isValid: false, wasUpdated: false };
        }
      }

      // Check package file content if it was tracked
      const packageFile = cache.packageManager?.packageFilePath;
      if (packageFile) {
        const packageFilePath = path.join(this.projectRoot, packageFile);
        try {
          const content = await fs.readFile(packageFilePath, 'utf-8');
          const previousContent = cache.packageManager?.packageJsonContent;

          // Update cache if content changed
          if (content.trim() !== (previousContent || '').trim()) {
            debug(`Package file changed, updating cache: ${packageFile}`);
            if (cache.packageManager) {
              cache.packageManager.packageJsonContent = content;
            }
            wasUpdated = true;
          }
        } catch {
          debug(`Cache invalid: Package file missing or unreadable ${packageFile}`);
          return { isValid: false, wasUpdated: false };
        }
      }

      return { isValid: true, wasUpdated };
    } catch (error) {
      debug('Cache validation error:', error);
      return { isValid: false, wasUpdated: false };
    }
  }
}
