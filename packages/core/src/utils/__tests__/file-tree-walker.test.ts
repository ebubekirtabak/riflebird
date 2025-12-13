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

    describe('getFlattenedFileTree', () => {
        it('should return a flattened file tree with only files', async () => {
            const walker = new FileTreeWalker(mockContext);
            const result = await walker.getFlattenedFileTree();

            // Should only contain files, not directories
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                name: 'package.json',
                path: 'package.json',
                type: 'file',
                extension: '.json',
            });
            expect(result[1]).toEqual({
                name: 'index.ts',
                path: 'src/index.ts',
                type: 'file',
                extension: '.ts',
            });
        });

        it('should cache the flattened file tree on subsequent calls', async () => {
            const walker = new FileTreeWalker(mockContext);

            // First call
            const result1 = await walker.getFlattenedFileTree();

            // Second call
            const result2 = await walker.getFlattenedFileTree();

            // Should return the same reference (cached)
            expect(result1).toBe(result2);
        });

        it('should handle empty file tree', async () => {
            const emptyContext = {
                ...mockContext,
                fileTree: [],
            };
            const walker = new FileTreeWalker(emptyContext);
            const result = await walker.getFlattenedFileTree();

            expect(result).toEqual([]);
        });

        it('should handle nested directory structures', async () => {
            const nestedFileTree: FileNode[] = [
                {
                    name: 'src',
                    path: 'src',
                    type: 'directory',
                    children: [
                        {
                            name: 'utils',
                            path: 'src/utils',
                            type: 'directory',
                            children: [
                                {
                                    name: 'helper.ts',
                                    path: 'src/utils/helper.ts',
                                    type: 'file',
                                    extension: '.ts',
                                },
                            ],
                        },
                        {
                            name: 'index.ts',
                            path: 'src/index.ts',
                            type: 'file',
                            extension: '.ts',
                        },
                    ],
                },
            ];

            const nestedContext = {
                ...mockContext,
                fileTree: nestedFileTree,
            };
            const walker = new FileTreeWalker(nestedContext);
            const result = await walker.getFlattenedFileTree();

            // Should flatten all nested files
            expect(result).toHaveLength(2);
            expect(result[0].path).toBe('src/utils/helper.ts');
            expect(result[1].path).toBe('src/index.ts');
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
