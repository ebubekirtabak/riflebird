import { ProjectConfigFiles } from './project-config-files';

export type ProjectContext = {
  configFiles: ProjectConfigFiles;
  testFrameworks?: TestFrameworks;
  packageManager?: PackageManager;
  languageConfig: FrameworkInfo;
  linterConfig: FrameworkInfo;
  formatterConfig: FrameworkInfo;
  projectRoot: string;
  unitTestOutputStrategy?: 'root' | 'colocated';
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
  packageFilePath?: string;
  packageJsonContent?: string;
  testCommand?: string;
  testScript?: string;
  packageInfo?: PackageInfo;
};

export type PackageInfo = {
  name?: string;
  version?: string;
  description?: string;
  // Dependencies
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  testFrameworks?: string[]; // Detected from dependencies
  engines?: Record<string, string>;
  private?: boolean;
  workspaces?: string[] | { packages: string[] };
};
