// packages/core/src/config/loader.ts
import { pathToFileURL } from 'url';
import { RiflebirdConfigSchema, RiflebirdConfig } from './schema';
import fs from 'fs/promises';
import path from 'path';

export async function loadConfig(
  configPath?: string
): Promise<RiflebirdConfig> {
  // Find config file
  const configFile = configPath || (await findConfigFile());

  if (!configFile) {
    throw new Error(
      'riflebird.config.ts not found. Run "riflebird init" to create one.'
    );
  }

  // Load config
  const configModule = await import(pathToFileURL(configFile).href);
  const userConfig = configModule.default || configModule;

  // Validate with Zod
  const validatedConfig = RiflebirdConfigSchema.parse(userConfig);

  return validatedConfig;
}

async function findConfigFile(): Promise<string | null> {
  const configNames = [
    'riflebird.config.ts',
    'riflebird.config.js',
    'riflebird.config.mjs',
  ];

  for (const name of configNames) {
    const configPath = path.join(process.cwd(), name);
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      continue;
    }
  }

  return null;
}

export function defineConfig(config: RiflebirdConfig): RiflebirdConfig {
  return config;
}