import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ProjectContextProvider } from '../project-context-provider';
import { ProjectCacheManager } from '../../cache/project-cache-manager';
import { CommandContext } from '@commands/base';
import { AIClient } from '@models/ai-client';
import { RiflebirdConfig } from '@config/schema';
import { detectPackageManagerInfo } from '@utils';
import { TestFrameworkAdapter } from '@adapters/base';
import { ProjectContext } from '@models/project-context';

// Mock CacheManager and Utils
vi.mock('../../cache/project-cache-manager');
vi.mock('@utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@utils')>();
  return {
    ...actual,
    debug: vi.fn(),
    error: vi.fn(),
    detectPackageManagerInfo: vi.fn(),
    ProjectFileWalker: vi.fn().mockImplementation(() => ({
      readFileFromProject: vi.fn().mockResolvedValue('{}'),
    })),
    FileTreeWalker: vi.fn().mockImplementation(() => ({
      findConfigFiles: vi.fn().mockResolvedValue({
        packageManager: 'npm',
        languageConfig: {},
        linterConfig: {},
        formatterConfig: {},
        testFrameworks: {},
        importantConfigFiles: {},
      }),
    })),
  };
});
vi.mock('fs/promises');

// Factory for type-safe ProjectContext
const createMockConfigFile = (
  overrides: Partial<import('@models/project-config-files').ConfigFile> = {}
): import('@models/project-config-files').ConfigFile => ({
  type: 'mock-type',
  configFile: 'mock.config',
  configFilePath: 'mock.config',
  ...overrides,
});

const createMockProjectContext = (overrides: Partial<ProjectContext> = {}): ProjectContext => ({
  projectRoot: '/mock/root',
  configFiles: {
    framework: createMockConfigFile({ type: 'react' }),
    language: 'typescript',
    packageManager: 'npm',
    libs: { core: [], testing: [], styling: [] },
    testFrameworks: {},
    linting: createMockConfigFile({ type: 'eslint' }),
    formatting: createMockConfigFile({ type: 'prettier' }),
    languageConfig: createMockConfigFile({ type: 'typescript' }),
    importantConfigFiles: {},
  },
  languageConfig: {},
  linterConfig: {},
  formatterConfig: {},
  packageManager: { type: 'npm' },
  ...overrides,
});

describe('ProjectContextProvider Caching Strategy', () => {
  let provider: ProjectContextProvider;
  let mockContext: CommandContext;
  let mockCacheManagerInstance: { load: Mock; save: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Cache Manager Instance
    mockCacheManagerInstance = {
      load: vi.fn(),
      save: vi.fn(),
    };
    vi.mocked(ProjectCacheManager).mockImplementation(
      () => mockCacheManagerInstance as unknown as ProjectCacheManager
    );

    // Create type-safe mocks
    const mockAIClient: AIClient = {
      createChatCompletion: vi.fn(),
    };

    const mockAdapter: TestFrameworkAdapter = {
      name: 'mock-adapter',
      init: vi.fn(),
      goto: vi.fn(),
      click: vi.fn(),
      fill: vi.fn(),
      select: vi.fn(),
      expectVisible: vi.fn(),
      expectText: vi.fn(),
      expectURL: vi.fn(),
      screenshot: vi.fn(),
      findElement: vi.fn(),
      close: vi.fn(),
      generateTestCode: vi.fn(),
    };

    // Mock Context
    mockContext = {
      aiClient: mockAIClient,
      config: { unitTesting: { enabled: true } } as RiflebirdConfig,
      adapter: mockAdapter,
    } as CommandContext;

    provider = new ProjectContextProvider(mockContext, '/mock/root');
    // Mock getFileTree to avoid real FS calls
    vi.spyOn(provider, 'getFileTree').mockResolvedValue([]);
  });

  it('should USE cached context if available (HIT)', async () => {
    const cachedCtx = createMockProjectContext({
      projectRoot: '/mock/root',
    });
    // @ts-expect-error - simulating cache property for test
    cachedCtx.cameFromCache = true;

    mockCacheManagerInstance.load.mockResolvedValue(cachedCtx);

    const result = await provider.getContext();

    expect(result).toBe(cachedCtx);
    expect(mockCacheManagerInstance.load).toHaveBeenCalledTimes(1);

    // Ensure we didn't trigger expensive operations
    expect(mockContext.aiClient.createChatCompletion).not.toHaveBeenCalled();
    // Should NOT save again immediately upon hit
    expect(mockCacheManagerInstance.save).not.toHaveBeenCalled();
  });

  it('should GENERATE and SAVE context if cache is missing (MISS)', async () => {
    mockCacheManagerInstance.load.mockResolvedValue(null);
    (detectPackageManagerInfo as Mock).mockResolvedValue({
      type: 'npm',
      packageInfo: {},
      packageFilePath: 'package.json',
    });

    const result = await provider.getContext();

    expect(result).toBeDefined();
    expect(mockCacheManagerInstance.load).toHaveBeenCalledTimes(1);

    // Since cache missed, it should find config files (which uses AI/Walker)
    // We mocked FileTreeWalker in the top level mock

    // Crucially, it MUST save the new context
    expect(mockCacheManagerInstance.save).toHaveBeenCalledTimes(1);
    expect(mockCacheManagerInstance.save).toHaveBeenCalledWith(result);
  });
});
