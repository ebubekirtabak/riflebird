import { pathToFileURL, fileURLToPath } from 'url';
import { RiflebirdConfigSchema, RiflebirdConfig } from './schema';
import fs from 'fs/promises';
import path from 'path';

export async function loadConfig(
  configPath?: string
): Promise<RiflebirdConfig> {
  const configFile = configPath || (await findConfigFile());

  if (!configFile) {
    throw new Error(
      'riflebird.config.ts not found. Run "riflebird init" to create one.'
    );
  }

  let userConfig: unknown;

  try {
    if (configFile.endsWith('.ts')) {
      userConfig = await loadConfigWithJiti(configFile);
    } else {
      // Load .js or .mjs files via dynamic import with cache busting
      const fileUrl = `${pathToFileURL(configFile).href}?t=${Date.now()}`;
      const configModule = await import(fileUrl);
      userConfig = configModule.default ?? configModule;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load config from ${configFile}: ${message}`
    );
  }

  try {
    return RiflebirdConfigSchema.parse(userConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid configuration in ${configFile}: ${message}`
    );
  }
}

async function loadConfigWithJiti(configFile: string): Promise<unknown> {
  const { createJiti } = await import('jiti');
  const callerPath = fileURLToPath(import.meta.url);
  const jiti = createJiti(callerPath, {
    interopDefault: true,
    moduleCache: false,
    requireCache: false,
  });

  return jiti.import(configFile);
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