import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { AgenticRunner } from "../agentic-runner";
import type { AIClient } from "@models/ai-client";
import type { RiflebirdConfig } from "@config/schema";

// Mock dependencies
vi.mock("@utils/project-file-walker", () => {
  const mockInstance = {
    readFileFromProject: vi.fn().mockResolvedValue("// content"),
  };
  return {
    ProjectFileWalker: vi.fn(() => mockInstance),
  };
});

describe("AgenticRunner", () => {
  let runner: AgenticRunner;
  let mockAiClient: AIClient;
  let mockConfig: RiflebirdConfig;
  let mockFileWalker: { readFileFromProject: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mock instance
    const { ProjectFileWalker } = await import("@utils/project-file-walker");
    mockFileWalker = new ProjectFileWalker({
      projectRoot: "/test",
    }) as unknown as { readFileFromProject: Mock };

    mockAiClient = {
      createChatCompletion: vi.fn(),
    } as unknown as AIClient;

    mockConfig = {
      ai: {
        model: "test-model",
        temperature: 0,
      },
    } as RiflebirdConfig;

    runner = new AgenticRunner({
      aiClient: mockAiClient,
      config: mockConfig,
      projectRoot: "/test",
    });
  });

  it("should return code directly if AI provides code immediately", async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "generate_test",
              code: "success",
            }),
          },
        },
      ],
    });

    const result = await runner.run("Initial Prompt");
    expect(result).toBe("success");
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("should handling loop with file requests", async () => {
    // Round 1: Request file
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "request_files",
              files: ["file1.ts"],
            }),
          },
        },
      ],
    });

    // Round 2: Return code
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
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

    mockFileWalker.readFileFromProject.mockResolvedValue("file content");

    const result = await runner.run("Start");

    expect(result).toBe("final code");
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(mockFileWalker.readFileFromProject).toHaveBeenCalledWith("file1.ts");

    // precise prompt check for the second call
    const secondCallArgs = (mockAiClient.createChatCompletion as Mock).mock
      .calls[1][0];
    const lastMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMsg.content).toContain("file content");
  });

  it("should use smart file resolution (extensions)", async () => {
    // Round 1: Request component.ts (does not exist)
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "request_files",
              files: ["component.ts"],
            }),
          },
        },
      ],
    });

    // Round 2: Success
    (mockAiClient.createChatCompletion as Mock).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ action: "generate_test", code: "done" }),
          },
        },
      ],
    });

    mockFileWalker.readFileFromProject.mockImplementation(async (p: string) => {
      if (p === "component.ts") throw new Error("Not found");
      if (p === "component.tsx") return "found tsx";
      return "unknown";
    });

    await runner.run("Start");

    expect(mockFileWalker.readFileFromProject).toHaveBeenCalledWith(
      "component.ts"
    );
    expect(mockFileWalker.readFileFromProject).toHaveBeenCalledWith(
      "component.tsx"
    );

    const secondCallArgs = (mockAiClient.createChatCompletion as Mock).mock
      .calls[1][0];
    const lastMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1];
    expect(lastMsg.content).toContain("Resolved to component.tsx");
    expect(lastMsg.content).toContain("found tsx");
  });

  it("should throw if max iterations exceeded", async () => {
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "request_files",
              files: ["ping.ts"],
            }),
          },
        },
      ],
    });

    const shortRunner = new AgenticRunner({
      aiClient: mockAiClient,
      config: mockConfig,
      projectRoot: "/test",
      maxIterations: 2,
    });

    await expect(shortRunner.run("Start")).rejects.toThrow(/iterations/);
    expect(mockAiClient.createChatCompletion).toHaveBeenCalledTimes(2);
  });

  it("should handle invalid JSON gracefully", async () => {
    // If invalid JSON, but looks like code, we accept it (fallback)
    (mockAiClient.createChatCompletion as Mock).mockResolvedValue({
      choices: [{ message: { content: "This is not JSON but maybe code?" } }],
    });

    // The current implementation throws "AI response was not valid JSON" if it fails to parse
    // UNLESS we want to support raw text fallback. The UnitTestWriter had logic:
    // catch { debug... throw ... }
    // Wait, looking at current impl:
    // catch { debug(...); throw new Error('AI response was not valid JSON'); }
    // So strict JSON is required.

    await expect(runner.run("Start")).rejects.toThrow(
      "AI response was not valid JSON"
    );
  });
});
