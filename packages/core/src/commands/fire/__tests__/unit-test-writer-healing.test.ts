/**
 * Tests for UnitTestWriter healing functionality
 * Verifies that the auto-healing feature correctly:
 * - Executes tests after generation
 * - Detects test failures
 * - Retries with error context
 * - Respects maxRetries configuration
 * - Handles healing.enabled configuration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UnitTestWriter } from '../unit-test-writer';
import type { ProjectContext, FrameworkInfo } from '@models/project-context';
import { ConfigFile } from '@models/project-config-files';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';

// Mock the test runner
vi.mock('@runners/test-runner', () => ({
  runTest: vi.fn(),
  extractTestErrors: vi.fn(),
  parseFailingTestsFromJson: vi.fn(),
  formatFailingTestsForPrompt: vi.fn(),
  getFailingTestsDetail: vi.fn(),
}));

vi.mock('@prompts/unit-test-prompt.txt', () => ({
  default: 'Generate unit test for {{TEST_FRAMEWORK}}.',
}));

vi.mock('@prompts/unit-test-fix-prompt.txt', () => ({
  default: 'Fix the failing test for {{TEST_FRAMEWORK}}. Failed code: {{FAILED_TEST_CODE}}. Error: {{ERROR_MESSAGE}}.',
}));

vi.mock('@utils/project-file-walker', () => {
  const mockInstance = {
    readFileFromProject: vi.fn().mockResolvedValue('// source code'),
    writeFileToProject: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ProjectFileWalker: vi.fn(() => mockInstance),
    getMockWalkerInstance: () => mockInstance,
  };
});

describe('UnitTestWriter - Healing', () => {
  let writer: UnitTestWriter;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockProjectContext: ProjectContext;
  let mockWalkerInstance: ReturnType<typeof vi.fn>;
  let mockRunTest: ReturnType<typeof vi.fn>;
  let mockExtractTestErrors: ReturnType<typeof vi.fn>;
  let mockParseFailingTestsFromJson: ReturnType<typeof vi.fn>;
  let mockFormatFailingTestsForPrompt: ReturnType<typeof vi.fn>;

  const createMockProjectContext = (): ProjectContext => ({
    projectRoot: '/test/project',
    unitTestOutputStrategy: 'colocated',
    packageManager: {
      type: 'pnpm',
      testCommand: 'pnpm test',
      testScript: 'vitest',
    },
    testFrameworks: {
      unit: {
        name: 'vitest',
        version: '1.0.0',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default { test: { globals: true } }',
      },
    },
    languageConfig: {
      name: 'typescript',
      fileLang: 'json',
      configFilePath: 'tsconfig.json',
      configContent: '{ "compilerOptions": { "strict": true } }',
    },
    linterConfig: {
      name: 'eslint',
      fileLang: 'javascript',
      configFilePath: 'eslint.config.js',
      configContent: 'module.exports = { rules: {} }',
    },
    formatterConfig: {
      name: 'prettier',
      fileLang: 'json',
      configFilePath: '.prettierrc',
      configContent: '{ "semi": true }',
    },
    configFiles: {
      framework: {} as ConfigFile,
      language: 'typescript',
      packageManager: 'pnpm',
      libs: { core: [], testing: [], styling: [] },
      testFrameworks: {},
      linting: {} as ConfigFile,
      formatting: {} as ConfigFile,
      languageConfig: {} as ConfigFile,
      importantConfigFiles: {},
    },
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocks
    const { getMockWalkerInstance } = await import('@utils/project-file-walker');
    mockWalkerInstance = getMockWalkerInstance();
    mockWalkerInstance.readFileFromProject.mockResolvedValue('// source code');
    mockWalkerInstance.writeFileToProject.mockResolvedValue(undefined);

    const testRunner = await import('@runners/test-runner');
    mockRunTest = testRunner.runTest as ReturnType<typeof vi.fn>;
    mockExtractTestErrors = testRunner.extractTestErrors as ReturnType<typeof vi.fn>;
    mockParseFailingTestsFromJson = testRunner.parseFailingTestsFromJson as ReturnType<typeof vi.fn>;
    mockFormatFailingTestsForPrompt = testRunner.formatFailingTestsForPrompt as ReturnType<typeof vi.fn>;

    // Default mock returns
    mockParseFailingTestsFromJson.mockReturnValue([]);
    mockFormatFailingTestsForPrompt.mockReturnValue('');

    mockProjectContext = createMockProjectContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('healing disabled', () => {
    beforeEach(() => {
      mockConfig = {
        ai: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          provider: 'openai',
        },
        healing: {
          enabled: false,
          maxRetries: 3,
          mode: 'auto',
        },
      } as RiflebirdConfig;

      mockAiClient = {
        createChatCompletion: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '```typescript\nimport { test } from "vitest";\ntest("works", () => {});\n```',
              },
            },
          ],
        }),
      } as unknown as AIClient;

      writer = new UnitTestWriter({
        aiClient: mockAiClient,
        config: mockConfig,
      });
    });

    it('should not run tests when healing is disabled', async () => {
      const testFramework: FrameworkInfo = mockProjectContext.testFrameworks.unit!;

      await writer.writeTestFile(
        mockProjectContext,
        'src/add.ts',
        testFramework
      );

      expect(mockRunTest).not.toHaveBeenCalled();
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(1);
    });
  });

  describe('healing enabled - tests pass on first try', () => {
    beforeEach(() => {
      mockConfig = {
        ai: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          provider: 'openai',
        },
        healing: {
          enabled: true,
          maxRetries: 3,
          mode: 'auto',
        },
      } as RiflebirdConfig;

      mockAiClient = {
        createChatCompletion: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '```typescript\nimport { test } from "vitest";\ntest("works", () => {});\n```',
              },
            },
          ],
        }),
      } as unknown as AIClient;

      // Mock successful test run
      mockRunTest.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: '✓ works',
        stderr: '',
        duration: 100,
      });

      writer = new UnitTestWriter({
        aiClient: mockAiClient,
        config: mockConfig,
      });
    });

    it('should run test once and succeed', async () => {
      const testFramework: FrameworkInfo = mockProjectContext.testFrameworks.unit!;

      await writer.writeTestFile(
        mockProjectContext,
        'src/add.ts',
        testFramework
      );

      // Should generate test once
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(1);

      // Should run test once
      expect(mockRunTest).toHaveBeenCalledTimes(1);
      expect(mockRunTest).toHaveBeenCalledWith(
        'pnpm test',
        {
          cwd: '/test/project',
          testFilePath: 'src/add.test.ts',
          timeout: 30000,
          framework: 'vitest',
        }
      );

      // Should write file once
      expect(mockWalkerInstance.writeFileToProject).toHaveBeenCalledTimes(1);
    });
  });

  describe('healing enabled - tests fail then succeed', () => {
    beforeEach(() => {
      mockConfig = {
        ai: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          provider: 'openai',
        },
        healing: {
          enabled: true,
          maxRetries: 3,
          mode: 'auto',
        },
      } as RiflebirdConfig;

      // First call returns broken test, second returns fixed test
      mockAiClient = {
        createChatCompletion: vi
          .fn()
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: '```typescript\nimport { test } from "vitest";\ntest("broken", () => { expect(undefined).toBe(true); });\n```',
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: '```typescript\nimport { test, expect } from "vitest";\ntest("fixed", () => { expect(true).toBe(true); });\n```',
                },
              },
            ],
          }),
      } as unknown as AIClient;

      // First test run fails, second succeeds
      mockRunTest
        .mockResolvedValueOnce({
          success: false,
          exitCode: 1,
          stdout: '✗ broken test failed',
          stderr: 'Error: expect(received).toBe(expected)',
          duration: 100,
          jsonReport: null, // No JSON report available, will fallback
        })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          stdout: '✓ fixed',
          stderr: '',
          duration: 100,
          jsonReport: null,
        });

      mockExtractTestErrors.mockReturnValue(
        'Test "broken" failed: expect(received).toBe(expected)'
      );

      // Mock parseFailingTestsFromJson to return failing test details
      mockParseFailingTestsFromJson.mockReturnValue([
        {
          testName: 'broken',
          fullName: 'broken test',
          ancestorTitles: [],
          errorMessage: 'expect(received).toBe(expected)\nExpected: true\nReceived: undefined',
          renderedHTML: '',
          duration: 100,
        },
      ]);

      // Mock formatFailingTestsForPrompt to return formatted string
      mockFormatFailingTestsForPrompt.mockReturnValue(
        '## Failed Tests (1)\n\n### Test 1: broken\n\n**Error:**\n```\nexpect(received).toBe(expected)\nExpected: true\nReceived: undefined\n```'
      );

      writer = new UnitTestWriter({
        aiClient: mockAiClient,
        config: mockConfig,
      });
    });

    it('should retry with healing context when test fails', async () => {
      const testFramework: FrameworkInfo = mockProjectContext.testFrameworks.unit!;

      await writer.writeTestFile(
        mockProjectContext,
        'src/add.ts',
        testFramework
      );

      // Should generate test twice (initial + 1 fix)
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(2);

      // Second call should use fix prompt with error context
      const secondCall = (mockAiClient.createChatCompletion as ReturnType<typeof vi.fn>).mock
        .calls[1][0];
      expect(secondCall.messages[0].content).toContain('Fix the failing test');
      expect(secondCall.messages[0].content).toContain('Failed code:');
      expect(secondCall.messages[0].content).toContain('Error:');

      // Should run test twice (initial + after fix)
      expect(mockRunTest).toHaveBeenCalledTimes(2);

      // Should extract errors once (after first failure for logging)
      expect(mockExtractTestErrors).toHaveBeenCalledTimes(1);

      // Should write file twice (initial + fixed)
      expect(mockWalkerInstance.writeFileToProject).toHaveBeenCalledTimes(2);
    });
  });

  describe('healing enabled - tests fail all retries', () => {
    beforeEach(() => {
      mockConfig = {
        ai: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          provider: 'openai',
        },
        healing: {
          enabled: true,
          maxRetries: 3,
          mode: 'auto',
        },
      } as RiflebirdConfig;

      // All calls return broken tests
      mockAiClient = {
        createChatCompletion: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '```typescript\nimport { test } from "vitest";\ntest("still broken", () => { throw new Error("fail"); });\n```',
              },
            },
          ],
        }),
      } as unknown as AIClient;

      // All test runs fail
      mockRunTest.mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Error: fail',
        duration: 100,
        jsonReport: null,
      });

      mockExtractTestErrors.mockReturnValue('Test "still broken" failed: Error: fail');

      // Mock parseFailingTestsFromJson to return failing test
      mockParseFailingTestsFromJson.mockReturnValue([
        {
          testName: 'still broken',
          fullName: 'still broken test',
          ancestorTitles: [],
          errorMessage: 'Error: fail',
          renderedHTML: '',
          duration: 100,
        },
      ]);

      mockFormatFailingTestsForPrompt.mockReturnValue(
        '## Failed Tests (1)\n\n### Test 1: still broken\n\n**Error:**\n```\nError: fail\n```'
      );

      writer = new UnitTestWriter({
        aiClient: mockAiClient,
        config: mockConfig,
      });
    });

    it('should stop after maxRetries and throw error', async () => {
      const testFramework: FrameworkInfo = mockProjectContext.testFrameworks.unit!;

      await expect(
        writer.writeTestFile(mockProjectContext, 'src/add.ts', testFramework)
      ).rejects.toThrow(
        /Test failed after 3 attempt/
      );

      // Should try maxRetries times (3): 1 generate + 2 fix attempts
      expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(3);
      expect(mockRunTest).toHaveBeenCalledTimes(3);
      // Extract errors called 3 times (once after each test failure for logging)
      expect(mockExtractTestErrors).toHaveBeenCalledTimes(3);
    });
  });

  describe('healing with mode configuration', () => {
    it('should respect mode: manual (not implemented yet)', async () => {
      mockConfig = {
        ai: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          provider: 'openai',
        },
        healing: {
          enabled: true,
          maxRetries: 3,
          mode: 'manual',
        },
      } as RiflebirdConfig;

      mockAiClient = {
        createChatCompletion: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '```typescript\nimport { test } from "vitest";\ntest("works", () => {});\n```',
              },
            },
          ],
        }),
      } as unknown as AIClient;

      writer = new UnitTestWriter({
        aiClient: mockAiClient,
        config: mockConfig,
      });

      const testFramework: FrameworkInfo = mockProjectContext.testFrameworks.unit!;

      // Mode is checked but currently only 'auto' is implemented
      // This test documents expected behavior for future implementation
      await writer.writeTestFile(
        mockProjectContext,
        'src/add.ts',
        testFramework
      );

      // Manual mode currently behaves like disabled healing
      expect(mockRunTest).not.toHaveBeenCalled();
    });
  });
});
