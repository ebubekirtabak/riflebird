import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectPackageManagerInfo } from '../package-manager-detector';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

vi.mock('@security', () => ({
  SecretScanner: {
    sanitize: vi.fn((content) => ({ secretsDetected: 0, sanitizedCode: content })),
  },
  sanitizationLogger: {
    logSanitization: vi.fn(),
  },
}));

describe('package-manager-detector', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'riflebird-pkg-detect-'));
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  describe('detectPackageManagerInfo', () => {
    it('should extract full package.json information', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project description',
        scripts: {
          test: 'vitest',
          build: 'tsc',
          dev: 'vite',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          vitest: '^1.0.0',
          '@testing-library/react': '^14.0.0',
          typescript: '^5.0.0',
        },
        engines: {
          node: '>=18.0.0',
        },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'pnpm');

      expect(result.type).toBe('pnpm');
      expect(result.testCommand).toBe('pnpm run test');
      expect(result.testScript).toBe('test');
      expect(result.packageInfo).toBeDefined();
      expect(result.packageInfo?.name).toBe('test-project');
      expect(result.packageInfo?.version).toBe('1.0.0');
      expect(result.packageInfo?.description).toBe('Test project description');

      // Verify arrays are correctly populated by real extraction
      expect(result.packageInfo?.dependencies).toHaveProperty('react');
      expect(result.packageInfo?.devDependencies).toHaveProperty('vitest');
    });

    it('should detect test frameworks from dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: { test: 'jest' },
        devDependencies: {
          vitest: '^1.0.0',
          jest: '^29.0.0',
          '@testing-library/react': '^14.0.0',
          playwright: '^1.40.0',
        },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');

      expect(result.packageInfo?.testFrameworks).toContain('vitest');
      expect(result.packageInfo?.testFrameworks).toContain('jest');
      expect(result.packageInfo?.testFrameworks).toContain('playwright');
      expect(result.packageInfo?.testFrameworks).toContain('@testing-library/react');
    });

    it('should extract all dependency types', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: { test: 'vitest' },
        dependencies: {
          react: '^18.2.0',
        },
        devDependencies: {
          vitest: '^1.0.0',
        },
        peerDependencies: {
          'react-dom': '^18.0.0',
        },
        optionalDependencies: {
          fsevents: '^2.3.0',
        },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'yarn');

      expect(result.packageInfo?.dependencies).toEqual({ react: '^18.2.0' });
      expect(result.packageInfo?.devDependencies).toEqual({ vitest: '^1.0.0' });
      expect(result.packageInfo?.peerDependencies).toEqual({ 'react-dom': '^18.0.0' });
      expect(result.packageInfo?.optionalDependencies).toEqual({ fsevents: '^2.3.0' });
    });

    it('should handle missing package.json gracefully', async () => {
      // No file written
      const result = await detectPackageManagerInfo(projectRoot, 'pnpm');

      expect(result.type).toBe('pnpm');
      expect(result.testCommand).toBe('pnpm test');
      expect(result.packageInfo).toBeUndefined();
    });

    it('should use detected type as fallback when package.json is missing', async () => {
      // No file written
      const pnpmResult = await detectPackageManagerInfo(projectRoot, 'pnpm');
      expect(pnpmResult.type).toBe('pnpm');

      const yarnResult = await detectPackageManagerInfo(projectRoot, 'yarn');
      expect(yarnResult.type).toBe('yarn');

      const bunResult = await detectPackageManagerInfo(projectRoot, 'bun');
      expect(bunResult.type).toBe('bun');
    });

    it('should detect package manager from detectedType parameter', async () => {
      const packageJson = { name: 'test', scripts: { test: 'vitest' } };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const npmResult = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(npmResult.type).toBe('npm');

      const yarnResult = await detectPackageManagerInfo(projectRoot, 'yarn');
      expect(yarnResult.type).toBe('yarn');

      const pnpmResult = await detectPackageManagerInfo(projectRoot, 'pnpm');
      expect(pnpmResult.type).toBe('pnpm');

      const bunResult = await detectPackageManagerInfo(projectRoot, 'bun');
      expect(bunResult.type).toBe('bun');
    });

    it('should extract engine requirements', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: { test: 'vitest' },
        engines: {
          node: '>=18.0.0',
          npm: '>=9.0.0',
        },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');

      expect(result.packageInfo?.engines).toEqual({
        node: '>=18.0.0',
        npm: '>=9.0.0',
      });
    });

    it('should build correct test command with package manager', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: { test: 'vitest' },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const pnpmResult = await detectPackageManagerInfo(projectRoot, 'pnpm');
      expect(pnpmResult.testCommand).toBe('pnpm run test');

      const npmResult = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(npmResult.testCommand).toBe('npm run test');

      const yarnResult = await detectPackageManagerInfo(projectRoot, 'yarn');
      expect(yarnResult.testCommand).toBe('yarn run test');

      const bunResult = await detectPackageManagerInfo(projectRoot, 'bun');
      expect(bunResult.testCommand).toBe('bun run test');
    });

    it('should handle package.json without test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'tsc',
          dev: 'vite',
        },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'pnpm');

      expect(result.testCommand).toBe('pnpm test');
      expect(result.testScript).toBeUndefined();
    });

    it('should detect multiple test frameworks in complex projects', async () => {
      const packageJson = {
        name: 'complex-project',
        scripts: { test: 'vitest' },
        dependencies: {
          react: '^18.2.0',
        },
        devDependencies: {
          vitest: '^1.0.0',
          jest: '^29.0.0',
          '@testing-library/react': '^14.0.0',
          '@testing-library/vue': '^8.0.0',
          playwright: '^1.40.0',
          cypress: '^13.0.0',
          mocha: '^10.0.0',
        },
      };

      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');

      const frameworks = result.packageInfo?.testFrameworks || [];
      expect(frameworks).toContain('vitest');
      expect(frameworks).toContain('jest');
      expect(frameworks).toContain('@testing-library/react');
      expect(frameworks).toContain('@testing-library/vue');
      expect(frameworks).toContain('playwright');
      expect(frameworks).toContain('cypress');
      expect(frameworks).toContain('mocha');
    });

    it('should handle malformed package.json gracefully', async () => {
      await fs.writeFile(path.join(projectRoot, 'package.json'), '{ invalid json }');

      const result = await detectPackageManagerInfo(projectRoot, 'pnpm');

      expect(result.type).toBe('pnpm');
      expect(result.testCommand).toBe('pnpm test');
      expect(result.packageInfo).toBeUndefined();
    });

    it('should prioritize test:unit script over standard test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
          'test:unit': 'vitest run',
        },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');

      expect(result.testScript).toBe('test:unit');
      expect(result.testCommand).toBe('npm run test:unit');
    });

    // Validating other priorities through reused file write logic is straightforward
    // but covering all heuristics in separate tests is good practice.
    it('should fallback to standard test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
        },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(result.testScript).toBe('test');
    });

    it('should prioritize test-unit script over standard test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
          'test-unit': 'vitest run',
        },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(result.testScript).toBe('test-unit');
    });

    it('should prioritize framework specific test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          'test:vitest': 'vitest',
          build: 'tsc',
        },
        devDependencies: {
          vitest: '^1.0.0',
        },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      // Frameworks must be detected for this heuristic to work
      const result = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(result.testScript).toBe('test:vitest');
    });

    it('should use framework name as script if available', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          vitest: 'vitest',
          build: 'tsc',
        },
        devDependencies: {
          vitest: '^1.0.0',
        },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(result.testScript).toBe('vitest');
    });

    it('should fallback to any script starting with test:', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          'test:something': 'echo test',
          build: 'tsc',
        },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, 'npm');
      expect(result.testScript).toBe('test:something');
    });

    it('should fallback to npm when package manager type is unknown', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: { test: 'echo test' },
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo(projectRoot, undefined);

      expect(result.type).toBe('unknown');
      expect(result.testCommand).toBe('npm run test');
    });
  });
});
