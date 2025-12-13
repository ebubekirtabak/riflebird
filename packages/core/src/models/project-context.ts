import { ProjectConfigFiles } from "./project-config-files";

export type ProjectContext = {
  configFiles: ProjectConfigFiles;
  testFrameworks?: TestFrameworks;
  packageManager?: PackageManager;
  languageConfig: FrameworkInfo;
  linterConfig: FrameworkInfo;
  formatterConfig: FrameworkInfo;
  projectRoot: string;
};

export type TestFrameworks = {
  unit?: FrameworkInfo;
  e2e?: FrameworkInfo;
  visual?: FrameworkInfo;
  performance?: FrameworkInfo;
};

export type FrameworkInfo = {
  name?: string;
  version?: string;
  fileLang?: string;
  configFilePath?: string;
  configContent?: string;
};

export type PackageManager = {
  type: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  version?: string;
  lockFilePath?: string;
  packageJsonPath?: string;
  packageJsonContent?: string;
};
