import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { debug, info, ProjectFileWalker } from '@utils';
import { executeProcessCommand } from '@runners/process-execution';
import type { ProjectContext } from '@models';

export type StorybookConfig = {
  version: string;
  framework: string;
  configPath: string;
};

export class StorybookService {
  private fileWalker: ProjectFileWalker;
  private context?: ProjectContext;

  constructor(
    private projectRoot: string,
    context?: ProjectContext
  ) {
    this.fileWalker = new ProjectFileWalker({ projectRoot });
    this.context = context;
  }

  /**
   * Detects if Storybook is installed and returns configuration
   */
  async detect(): Promise<StorybookConfig | null> {
    // 1. Try to use context if available (Optimized path)
    if (this.context) {
      const docConfig = this.context.testFrameworks?.documentation;
      if (docConfig) {
        return {
          version: docConfig.version || 'unknown',
          framework: docConfig.name || 'unknown',
          configPath: docConfig.configFilePath || join(this.projectRoot, '.storybook'),
        };
      }

      // If documentation framework not explicitly detected, try to find in dependencies from context
      if (this.context.packageManager?.packageInfo) {
        const pkgInfo = this.context.packageManager.packageInfo;
        const deps = { ...pkgInfo.dependencies, ...pkgInfo.devDependencies };
        return this.detectFromDependencies(deps);
      }
    }

    // 2. Fallback to file reading if context is missing or incomplete
    const hasStorybookDir = existsSync(join(this.projectRoot, '.storybook'));
    const packageJsonPath = join(this.projectRoot, 'package.json');

    if (!hasStorybookDir || !existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJsonContent = await this.fileWalker.readFileFromProject('package.json');
      const packageJson = JSON.parse(packageJsonContent);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      return this.detectFromDependencies(deps);
    } catch (error) {
      debug('Error parsing package.json for Storybook detection', error);
      return null;
    }
  }

  private detectFromDependencies(deps: Record<string, string>): StorybookConfig | null {
    const storybookDep = Object.keys(deps).find(
      (d) => d === 'storybook' || d.startsWith('@storybook/')
    );

    if (!storybookDep) {
      return null;
    }

    const version = deps[storybookDep].replace('^', '').replace('~', '');

    // Try to determine framework from dependencies
    let framework = 'unknown';
    if (deps['@storybook/react']) framework = 'react';
    else if (deps['@storybook/vue3']) framework = 'vue3';
    else if (deps['@storybook/angular']) framework = 'angular';
    else if (deps['@storybook/svelte']) framework = 'svelte';

    return {
      version,
      framework,
      configPath: join(this.projectRoot, '.storybook'),
    };
  }

  /**
   * Installs Storybook using the standard init command
   */
  async install(): Promise<boolean> {
    info('Installing Storybook...');
    try {
      // Using npx storybook@latest init
      // We need to run this interactively or handle prompts if possible,
      // but usually 'init' tries to auto-detect.
      // For now we'll run it and pipe output.
      const result = await executeProcessCommand('npx', ['storybook@latest', 'init', '--yes'], {
        cwd: this.projectRoot,
        stdio: 'inherit', // Let user see output
      });

      if (result.exitCode !== 0) {
        throw new Error(`Storybook init failed with code ${result.exitCode}`);
      }

      return true;
    } catch (error) {
      info('Failed to install Storybook.');
      debug('Storybook installation error:', error);
      return false;
    }
  }

  /**
   * Verifies Storybook installation
   */
  async verify(): Promise<boolean> {
    const config = await this.detect();
    if (!config) return false;

    // Check if we can run the build command as a smoke test
    // Running full 'storybook dev' blocks, so we might try 'build-storybook'
    // or just check if the scripts exist.
    const packageJsonContent = await this.fileWalker.readFileFromProject('package.json');
    const packageJson = JSON.parse(packageJsonContent);
    if (!packageJson.scripts?.storybook && !packageJson.scripts?.['build-storybook']) {
      return false;
    }

    return true;
  }
}
