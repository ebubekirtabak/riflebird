export type ConfigFile = {
  type: string;
  name?: string;
  fileLang?: string;
  version?: string;
  configFile: string;
  configFilePath: string;
};

export type ProjectConfigFiles = {
  framework: ConfigFile;
  language: string;
  packageManager: string;
  libs: {
    core: string[];
    testing: string[];
    styling: string[];
  };
  testFrameworks: TestFrameworksConfig;
  linting: ConfigFile;
  formatting: ConfigFile;
  languageConfig: ConfigFile;
  importantConfigFiles: Record<string, ConfigFile>;
};

export type TestFrameworksConfig = {
  unit?: ConfigFile;
  e2e?: ConfigFile;
  visual?: ConfigFile;
  performance?: ConfigFile;
  documentation?: ConfigFile;
};
