import { PackageInfo } from '@/models';

export type PackageManagerInfo = {
  type: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  testCommand: string;
  testScript?: string;
  packageInfo?: PackageInfo;
  packageFilePath?: string;
};
