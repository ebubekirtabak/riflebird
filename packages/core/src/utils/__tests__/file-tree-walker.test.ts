import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { FileTreeWalker, FileTreeWalkerContext } from '../file-tree-walker';
import type { FileNode } from '@models/file-tree';
import type { AIClient } from '@models/ai-client';
import type { RiflebirdConfig } from '@config/schema';
import { encode } from '@toon-format/toon';

// Mock the dependencies
vi.mock('@utils/log-util', () => ({
    debug: vi.fn(),
}));

// Mock the prompt imports essentially
vi.mock('@prompts/project-configuration.txt', () => ({
    default: 'System prompt content {{FILE_TREE}}',
}));

describe('FileTreeWalker', () => {
    let mockContext: FileTreeWalkerContext;
    let mockAIClient: AIClient;
    let mockConfig: RiflebirdConfig;
    let mockFileTree: FileNode[];

    beforeEach(() => {
        mockFileTree = [
            {
                name: 'package.json',
                path: 'package.json',
                type: 'file',
                extension: '.json',
            },
            {
                name: 'src',
                path: 'src',
                type: 'directory',
                children: [
                    {
                        name: 'index.ts',
                        path: 'src/index.ts',
                        type: 'file',
                        extension: '.ts',
                    },
                ],
            },
        ];

        mockAIClient = {
            createChatCompletion: vi.fn(),
        };

        mockConfig = {
            ai: {
                model: 'gpt-4-turbo',
                temperature: 0,
            },
        } as RiflebirdConfig;

        mockContext = {
            projectRoot: '/test/project/root',
            fileTree: mockFileTree,
            aiClient: mockAIClient,
            config: mockConfig,
        };
    });

    describe('getFileTree', () => {
        it('should return the file tree from context', async () => {
            const walker = new FileTreeWalker(mockContext);
            const result = await walker.getFileTree();
            expect(result).toEqual(mockFileTree);
        });
    });

    describe('findConfigFiles', () => {
        it('should call aiClient with correct parameters and return parsed config', async () => {
            const mockResponseContent = JSON.stringify({
                packageManager: 'pnpm',
                hasTsConfig: true,
            });

            // Mock the AI client response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: mockResponseContent,
                        },
                    },
                ],
            };
            (mockAIClient.createChatCompletion as Mock).mockResolvedValue(mockResponse);

            const walker = new FileTreeWalker(mockContext);
            const result = await walker.findConfigFiles();

            // Verify AI client was called with correct parameters
            expect(mockAIClient.createChatCompletion).toHaveBeenCalledWith({
                model: mockConfig.ai.model,
                temperature: mockConfig.ai.temperature,
                response_format: { type: 'json_object' },
                format: 'json',
                messages: [
                    {
                        role: 'system',
                        content: expect.stringContaining(encode(mockFileTree)),
                    },
                ],
            });

            // Verify the result matches the mocked response content
            expect(result).toEqual(JSON.parse(mockResponseContent));
        });

        it('should handle markdown code block in response', async () => {
            const mockJsonContent = {
                packageManager: 'npm',
                hasTsConfig: false,
            };
            const mockResponseContent = '```json\n' + JSON.stringify(mockJsonContent) + '\n```';

            // Mock the AI client response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: mockResponseContent,
                        },
                    },
                ],
            };
            (mockAIClient.createChatCompletion as Mock).mockResolvedValue(mockResponse);

            const walker = new FileTreeWalker(mockContext);
            const result = await walker.findConfigFiles();

            expect(result).toEqual(mockJsonContent);
        });
    });
});
