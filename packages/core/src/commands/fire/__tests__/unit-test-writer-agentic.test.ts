import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnitTestWriter } from "../unit-test-writer";
import type { ProjectContext } from "@models/project-context";
import type { AIClient } from "@models/ai-client";
import type { RiflebirdConfig } from "@config/schema";
import { ProjectConfigFiles } from "@/models/project-config-files";

// Mock dependencies
vi.mock("@runners/test-runner", () => ({
  runTest: vi.fn(),
  extractTestErrors: vi.fn(),
  parseFailingTestsFromJson: vi.fn(),
  getFailingTestsDetail: vi.fn(),
}));

vi.mock("@prompts/unit-test-agentic-prompt.txt", () => ({
  default: "Agentic Prompt For {{TEST_FRAMEWORK}}",
}));

vi.mock("@utils/project-file-walker", () => {
  const mockInstance = {
    readFileFromProject: vi
      .fn()
      .mockResolvedValue("// content of requested file"),
    writeFileToProject: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ProjectFileWalker: vi.fn(() => mockInstance),
    getMockWalkerInstance: () => mockInstance,
  };
});

type MockProjectFileWalkerInstance = {
  readFileFromProject: ReturnType<typeof vi.fn>;
  writeFileToProject: ReturnType<typeof vi.fn>;
};

type MockProjectFileWalkerModule = {
  getMockWalkerInstance: () => MockProjectFileWalkerInstance;
};

describe("UnitTestWriter - Agentic Flow", () => {
  let writer: UnitTestWriter;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockProjectContext: ProjectContext;
  let mockWalkerInstance: MockProjectFileWalkerInstance;

  const createMockProjectContext = (): ProjectContext =>
    ({
      projectRoot: "/test/project",
      unitTestOutputStrategy: "colocated",
      packageManager: {
        type: "pnpm",
        testCommand: "pnpm test",
        testScript: "vitest",
      },
      testFrameworks: {
        unit: { name: "vitest", version: "1.0.0", fileLang: "typescript" },
      },
      languageConfig: { name: "typescript", fileLang: "typescript" },
      configFiles: {} as ProjectConfigFiles,
    } as ProjectContext);

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getMockWalkerInstance } = (await import(
      "@utils/project-file-walker"
    )) as unknown as MockProjectFileWalkerModule;
    mockWalkerInstance = getMockWalkerInstance();

    mockConfig = {
      ai: {
        model: "gpt-4o-mini",
        temperature: 0.2,
        provider: "openai", // Agentic capable
      },
      healing: { enabled: false },
    } as RiflebirdConfig;

    mockAiClient = {
      createChatCompletion: vi.fn(),
    } as unknown as AIClient;

    mockProjectContext = createMockProjectContext();

    writer = new UnitTestWriter({
      aiClient: mockAiClient,
      config: mockConfig,
    });
  });

  it("should use agentic loop for openai provider", async () => {
    // First response: Request files
    // Second response: Generate test
    mockAiClient.createChatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "request_files",
                files: ["src/types.ts"],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "generate_test",
                code: "test code",
              }),
            },
          },
        ],
      });

    const testFramework = mockProjectContext.testFrameworks?.unit;
    if (!testFramework) throw new Error("Test framework not found");

    const result = await writer.generateTest(
      mockProjectContext,
      {
        filePath: "src/foo.ts",
        content: "foo",
        testFilePath: "src/foo.test.ts",
        testContent: "",
      },
      testFramework
    );

    expect(result).toBe("test code");
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(2);

    // Verify file reading
    expect(mockWalkerInstance.readFileFromProject).toHaveBeenCalledWith(
      "src/types.ts"
    );
  });

  it("should handle multiple file requests", async () => {
    mockAiClient.createChatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "request_files",
                files: ["a.ts"],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "request_files",
                files: ["b.ts"],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "generate_test",
                code: "final code",
              }),
            },
          },
        ],
      });

    const testFramework = mockProjectContext.testFrameworks?.unit;
    if (!testFramework) throw new Error("Test framework not found");

    const result = await writer.generateTest(
      mockProjectContext,
      {
        filePath: "src/foo.ts",
        content: "foo",
        testFilePath: "src/foo.test.ts",
        testContent: "",
      },
      testFramework
    );

    expect(result).toBe("final code");
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(3);
    expect(mockWalkerInstance.readFileFromProject).toHaveBeenCalledWith("a.ts");
    expect(mockWalkerInstance.readFileFromProject).toHaveBeenCalledWith("b.ts");
  });

  it("should throw if max iterations exceeded", async () => {
    // Always request files
    mockAiClient.createChatCompletion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "request_files",
              files: ["a.ts"],
            }),
          },
        },
      ],
    });

    const testFramework = mockProjectContext.testFrameworks?.unit;
    if (!testFramework) throw new Error("Test framework not found");

    await expect(
      writer.generateTest(
        mockProjectContext,
        {
          filePath: "src/foo.ts",
          content: "foo",
          testFilePath: "src/foo.test.ts",
          testContent: "",
        },
        testFramework
      )
    ).rejects.toThrow(/Agent failed to generate result after 5 iterations/);
  });
});
