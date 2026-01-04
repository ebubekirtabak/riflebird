import { StorybookService } from '../storybook-service';
import { ProjectContext, ProjectConfigFiles, ConfigFile, FrameworkInfo } from '@models';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';

// Mock ProjectFileWalker
vi.mock('@utils', () => ({
  ProjectFileWalker: vi.fn().mockImplementation(() => ({
    readFileFromProject: vi.fn(),
  })),
  debug: vi.fn(),
  info: vi.fn(),
  executeProcessCommand: vi.fn(),
}));

// --- Helper Functions for Mocks ---

const createMockConfigFile = (overrides?: Partial<ConfigFile>): ConfigFile => ({
  type: 'mock-type',
  configFile: 'mock.config.js',
  configFilePath: '/mock/path/mock.config.js',
  ...overrides,
});

const createMockFrameworkInfo = (overrides?: Partial<FrameworkInfo>): FrameworkInfo => ({
  name: 'mock-framework',
  version: '1.0.0',
  ...overrides,
});

const createMockProjectConfigFiles = (
  overrides?: Partial<ProjectConfigFiles>
): ProjectConfigFiles => ({
  framework: createMockConfigFile({ type: 'react' }),
  language: 'typescript',
  packageManager: 'npm',
  libs: {
    core: [],
    testing: [],
    styling: [],
  },
  testFrameworks: {
    unit: createMockConfigFile({ type: 'vitest' }),
  },
  linting: createMockConfigFile({ type: 'eslint' }),
  formatting: createMockConfigFile({ type: 'prettier' }),
  languageConfig: createMockConfigFile({ type: 'typescript' }),
  importantConfigFiles: {},
  ...overrides,
});

const createMockProjectContext = (overrides?: Partial<ProjectContext>): ProjectContext => ({
  projectRoot: '/test/project/root',
  configFiles: createMockProjectConfigFiles(),
  languageConfig: createMockFrameworkInfo({ name: 'typescript' }),
  linterConfig: createMockFrameworkInfo({ name: 'eslint' }),
  formatterConfig: createMockFrameworkInfo({ name: 'prettier' }),
  testFrameworks: {},
  packageManager: {
    type: 'npm',
    version: '8.0.0',
    packageInfo: {
      dependencies: {},
      devDependencies: {},
    },
  },
  ...overrides,
});

// --- Tests ---

describe('StorybookService', () => {
  const mockProjectRoot = '/test/project/root';

  it('should detect Storybook from ProjectContext (optimized path)', async () => {
    const mockContext = createMockProjectContext({
      projectRoot: mockProjectRoot,
      testFrameworks: {
        documentation: {
          name: 'react',
          version: '7.6.0',
          configFilePath: '/test/project/root/.storybook',
        },
      },
      packageManager: {
        type: 'npm',
        version: '8.0.0',
        packageInfo: {
          dependencies: {},
          devDependencies: {},
        },
      },
    });

    const service = new StorybookService(mockProjectRoot, mockContext);
    const config = await service.detect();

    expect(config).toEqual({
      version: '7.6.0',
      framework: 'react',
      configPath: '/test/project/root/.storybook',
    });
  });

  it('should fallback to dependencies from ProjectContext if documentation framework is missing', async () => {
    const mockContext = createMockProjectContext({
      projectRoot: mockProjectRoot,
      testFrameworks: {}, // No documentation framework detected explicitly
      packageManager: {
        type: 'npm',
        version: '8.0.0',
        packageInfo: {
          dependencies: {
            storybook: '^7.0.0',
            '@storybook/react': '^7.0.0',
          },
          devDependencies: {},
        },
      },
    });

    const service = new StorybookService(mockProjectRoot, mockContext);
    const config = await service.detect();

    expect(config).toEqual({
      version: '7.0.0',
      framework: 'react',
      configPath: join(mockProjectRoot, '.storybook'),
    });
  });

  // Additional tests can be added here for fallback to fs, but those require mocking fs
});
