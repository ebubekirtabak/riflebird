import { StorybookService } from '../storybook-service';
import { ProjectConfigFiles } from '@models/project-config-files';
import { ProjectContext, PackageManager, FrameworkInfo } from '@models';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mocks first
const mocks = vi.hoisted(() => ({
  readFileFromProject: vi.fn(),
  executeProcessCommand: vi.fn(),
  existsSync: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
}));

// Mock dependencies
vi.mock('@utils', async (_) => {
  return {
    ProjectFileWalker: vi.fn().mockImplementation(() => ({
      readFileFromProject: mocks.readFileFromProject,
    })),
    debug: mocks.debug,
    info: mocks.info,
  };
});

vi.mock('@runners/process-execution', () => ({
  executeProcessCommand: mocks.executeProcessCommand,
}));

vi.mock('node:fs', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('node:fs')>()),
    existsSync: mocks.existsSync,
  };
});

// Helper to create context
const createMockProjectContext = (overrides: Partial<ProjectContext> = {}): ProjectContext => {
  const defaultConfigFiles: ProjectConfigFiles = {
    framework: { type: 'react', configFile: '', configFilePath: '' },
    language: 'typescript',
    packageManager: 'npm',
    libs: { core: [], testing: [], styling: [] },
    testFrameworks: {},
    linting: { type: 'eslint', configFile: '', configFilePath: '' },
    formatting: { type: 'prettier', configFile: '', configFilePath: '' },
    languageConfig: { type: 'typescript', configFile: '', configFilePath: '' },
    importantConfigFiles: {},
  };

  const defaultPackageManager: PackageManager = {
    type: 'unknown',
    packageInfo: { dependencies: {}, devDependencies: {} },
  };

  const defaultFrameworkInfo: FrameworkInfo = {
    name: 'typescript',
    fileLang: 'ts',
    configFilePath: '',
  };

  return {
    projectRoot: '/root',
    configFiles: defaultConfigFiles,
    packageManager: defaultPackageManager,
    languageConfig: defaultFrameworkInfo,
    linterConfig: {},
    formatterConfig: {},
    ...overrides,
  } as ProjectContext;
};

describe('StorybookService', () => {
  const mockProjectRoot = '/root';
  let service: StorybookService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect', () => {
    it('should use context documentation config if available (optimized path)', async () => {
      const context = createMockProjectContext({
        testFrameworks: {
          documentation: {
            version: '7.0',
            name: 'react',
            configFilePath: '/root/.storybook',
          },
        },
      });
      service = new StorybookService(mockProjectRoot, context);

      const config = await service.detect();
      expect(config).toEqual({
        version: '7.0',
        framework: 'react',
        configPath: '/root/.storybook',
      });
    });

    it('should handle partial documentation config with defaults', async () => {
      const context = createMockProjectContext({
        testFrameworks: {
          documentation: {
            // Missing details
          },
        },
      });
      service = new StorybookService(mockProjectRoot, context);

      const config = await service.detect();
      expect(config).toEqual({
        version: 'unknown',
        framework: 'unknown',
        configPath: join(mockProjectRoot, '.storybook'),
      });
    });

    it('should detect from context dependencies if documentation config missing', async () => {
      const context = createMockProjectContext({
        packageManager: {
          packageInfo: {
            dependencies: { '@storybook/react': '^7.0.0' },
            devDependencies: {},
          },
        },
      });
      service = new StorybookService(mockProjectRoot, context);

      const config = await service.detect();
      expect(config).toEqual({
        version: '7.0.0',
        framework: 'react',
        configPath: '/root/.storybook',
      });
    });

    it('should fallback to filesystem if context is missing', async () => {
      service = new StorybookService(mockProjectRoot);
      mocks.existsSync.mockReturnValue(true); // .storybook exists
      mocks.readFileFromProject.mockResolvedValue(
        JSON.stringify({
          devDependencies: { storybook: '7.5.0', '@storybook/vue3': '7.5.0' },
        })
      );

      const config = await service.detect();
      expect(config).toEqual({
        version: '7.5.0',
        framework: 'vue3',
        configPath: '/root/.storybook',
      });
      expect(mocks.existsSync).toHaveBeenCalledWith(join(mockProjectRoot, '.storybook'));
    });

    it('should return null if filesystem detection finds no storybook dir', async () => {
      service = new StorybookService(mockProjectRoot);
      mocks.existsSync.mockImplementation((path: string) => !path.endsWith('.storybook')); // .storybook missing

      const config = await service.detect();
      expect(config).toBeNull();
    });

    it('should return null if package.json parse fails', async () => {
      service = new StorybookService(mockProjectRoot);
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileFromProject.mockRejectedValue(new Error('Read error'));

      const config = await service.detect();
      expect(config).toBeNull();
      expect(mocks.debug).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing'),
        expect.any(Error)
      );
    });

    it('should return null if no storybook dependency found in package.json', async () => {
      service = new StorybookService(mockProjectRoot);
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileFromProject.mockResolvedValue(
        JSON.stringify({
          dependencies: { react: '18.0' },
        })
      );

      const config = await service.detect();
      expect(config).toBeNull();
    });

    it('should identify various frameworks correctly', async () => {
      service = new StorybookService(mockProjectRoot);
      mocks.existsSync.mockReturnValue(true);

      // Angular
      mocks.readFileFromProject.mockResolvedValueOnce(
        JSON.stringify({
          dependencies: { storybook: '7.0', '@storybook/angular': '7.0' },
        })
      );
      expect((await service.detect())?.framework).toBe('angular');

      // Svelte
      mocks.readFileFromProject.mockResolvedValueOnce(
        JSON.stringify({
          dependencies: { storybook: '7.0', '@storybook/svelte': '7.0' },
        })
      );
      expect((await service.detect())?.framework).toBe('svelte');
    });
  });

  describe('install', () => {
    beforeEach(() => {
      service = new StorybookService(mockProjectRoot);
    });

    it('should run storybook init command successfully', async () => {
      mocks.executeProcessCommand.mockResolvedValue({ exitCode: 0 });

      const result = await service.install();

      expect(result).toBe(true);
      expect(mocks.executeProcessCommand).toHaveBeenCalledWith(
        'npx',
        ['storybook@latest', 'init', '--yes'],
        expect.objectContaining({ cwd: mockProjectRoot })
      );
    });

    it('should return false if init command fails', async () => {
      mocks.executeProcessCommand.mockResolvedValue({ exitCode: 1 });

      const result = await service.install();

      expect(result).toBe(false);
    });

    it('should handle execution errors exception', async () => {
      mocks.executeProcessCommand.mockRejectedValue(new Error('Exec failed'));

      const result = await service.install();

      expect(result).toBe(false);
      expect(mocks.debug).toHaveBeenCalledWith(
        expect.stringContaining('installation error'),
        expect.any(Error)
      );
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      service = new StorybookService(mockProjectRoot);
    });

    it('should return true if storybook configured and script exists', async () => {
      // Setup detection success
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileFromProject.mockResolvedValue(
        JSON.stringify({
          dependencies: { storybook: '7.0' },
          scripts: { storybook: 'start-storybook' },
        })
      );

      const result = await service.verify();
      expect(result).toBe(true);
    });

    it('should return false if detection fails', async () => {
      // Setup detection failure
      mocks.existsSync.mockReturnValue(false); // No .storybook dir

      const result = await service.verify();
      expect(result).toBe(false);
    });

    it('should return false if scripts missing', async () => {
      // Setup detection success but no scripts
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileFromProject.mockResolvedValue(
        JSON.stringify({
          dependencies: { storybook: '7.0' },
          scripts: { test: 'jest' },
        })
      );

      const result = await service.verify();
      expect(result).toBe(false);
    });

    it('should accept build-storybook script', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileFromProject.mockResolvedValue(
        JSON.stringify({
          dependencies: { storybook: '7.0' },
          scripts: { 'build-storybook': 'build' },
        })
      );

      const result = await service.verify();
      expect(result).toBe(true);
    });
  });
});
