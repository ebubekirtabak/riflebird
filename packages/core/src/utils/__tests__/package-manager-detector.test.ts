/**
 * Tests for package manager detection and package.json parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectPackageManagerInfo } from '../package-manager-detector';

// Mock ProjectFileWalker
vi.mock('../project-file-walker', () => {
  const mockInstance = {
    readFileFromProject: vi.fn(),
  };
  return {
    ProjectFileWalker: vi.fn(() => mockInstance),
    getMockWalkerInstance: () => mockInstance,
  };
});

describe('package-manager-detector', () => {
   
  let mockWalker: { readFileFromProject: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { getMockWalkerInstance } = await import('../project-file-walker') as any;
    mockWalker = getMockWalkerInstance();
    vi.clearAllMocks();
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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'pnpm');

      expect(result.type).toBe('pnpm');
      expect(result.testCommand).toBe('pnpm run test');
      expect(result.testScript).toBe('test');
      expect(result.packageInfo).toBeDefined();
      expect(result.packageInfo?.name).toBe('test-project');
      expect(result.packageInfo?.version).toBe('1.0.0');
      expect(result.packageInfo?.description).toBe('Test project description');
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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'yarn');

      expect(result.packageInfo?.dependencies).toEqual({ react: '^18.2.0' });
      expect(result.packageInfo?.devDependencies).toEqual({ vitest: '^1.0.0' });
      expect(result.packageInfo?.peerDependencies).toEqual({ 'react-dom': '^18.0.0' });
      expect(result.packageInfo?.optionalDependencies).toEqual({ fsevents: '^2.3.0' });
    });

    it('should handle missing package.json gracefully', async () => {
      mockWalker.readFileFromProject.mockRejectedValue(new Error('File not found'));

      const result = await detectPackageManagerInfo('/test/project', 'pnpm');

      expect(result.type).toBe('pnpm');
      expect(result.testCommand).toBe('pnpm test');
      expect(result.packageInfo).toBeUndefined();
    });

    it('should detect package manager from detectedType parameter', async () => {
      const packageJson = { name: 'test', scripts: { test: 'vitest' } };
      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const npmResult = await detectPackageManagerInfo('/test/project', 'npm');
      expect(npmResult.type).toBe('npm');

      const yarnResult = await detectPackageManagerInfo('/test/project', 'yarn');
      expect(yarnResult.type).toBe('yarn');

      const pnpmResult = await detectPackageManagerInfo('/test/project', 'pnpm');
      expect(pnpmResult.type).toBe('pnpm');

      const bunResult = await detectPackageManagerInfo('/test/project', 'bun');
      expect(bunResult.type).toBe('bun');
    });

    it('should extract scripts including test-related ones', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
          'test:unit': 'vitest run',
          'test:watch': 'vitest --watch',
          'test:coverage': 'vitest --coverage',
          build: 'tsc',
          dev: 'vite',
          lint: 'eslint .',
        },
      };

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

      expect(result.packageInfo?.scripts).toEqual(packageJson.scripts);
      expect(result.packageInfo?.scripts?.test).toBe('vitest');
      expect(result.packageInfo?.scripts?.['test:unit']).toBe('vitest run');
      expect(result.packageInfo?.scripts?.['test:coverage']).toBe('vitest --coverage');
    });

    it('should handle workspace configuration', async () => {
      const packageJson = {
        name: 'monorepo',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
        scripts: { test: 'vitest' },
      };

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'pnpm');

      expect(result.packageInfo?.workspaces).toEqual(['packages/*', 'apps/*']);
      expect(result.packageInfo?.private).toBe(true);
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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const pnpmResult = await detectPackageManagerInfo('/test/project', 'pnpm');
      expect(pnpmResult.testCommand).toBe('pnpm run test');

      const npmResult = await detectPackageManagerInfo('/test/project', 'npm');
      expect(npmResult.testCommand).toBe('npm run test');

      const yarnResult = await detectPackageManagerInfo('/test/project', 'yarn');
      expect(yarnResult.testCommand).toBe('yarn run test');

      const bunResult = await detectPackageManagerInfo('/test/project', 'bun');
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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'pnpm');

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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

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
      mockWalker.readFileFromProject.mockResolvedValue('{ invalid json }');

      const result = await detectPackageManagerInfo('/test/project', 'pnpm');

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

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

      expect(result.testScript).toBe('test:unit');
      expect(result.testCommand).toBe('npm run test:unit');
    });

    it('should prioritize test-unit script over standard test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
          'test-unit': 'vitest run',
        },
      };

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

      expect(result.testScript).toBe('test-unit');
      expect(result.testCommand).toBe('npm run test-unit');
    });

    it('should prioritize framework-specific test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          'test:jest': 'jest',
          'test:e2e': 'playwright',
        },
        devDependencies: {
          jest: '^29.0.0',
        },
      };

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

      expect(result.testScript).toBe('test:jest');
      expect(result.testCommand).toBe('npm run test:jest');
    });

    it('should fallback to standard test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
        },
      };

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

      expect(result.testScript).toBe('test');
      expect(result.testCommand).toBe('npm run test');
    });

    it('should find any script starting with test: as fallback', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          'test:something': 'vitest',
        },
      };

      mockWalker.readFileFromProject.mockResolvedValue(JSON.stringify(packageJson));

      const result = await detectPackageManagerInfo('/test/project', 'npm');

      expect(result.testScript).toBe('test:something');
      expect(result.testCommand).toBe('npm run test:something');
    });
  });
});
