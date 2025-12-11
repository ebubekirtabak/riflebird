import { FileNode, FileTreeOptions } from "@models/file-tree";

export type FilePattern = {
    /**
     * File naming patterns to match
     * Examples: ['*.component.tsx', '*.test.ts', '*.spec.ts']
     */
    patterns: string[];
    /**
     * File extensions to include
     * Examples: ['.tsx', '.ts', '.jsx', '.js']
     */
    extensions?: string[];
    /**
     * Description of the file type
     */
    description?: string;
};

export type FileType =
    | 'component'
    | 'test'
    | 'model'
    | 'util'
    | 'config'
    | 'hook'
    | 'page'
    | 'api'
    | 'style'
    | 'custom';

/**
 * Predefined file patterns for common file types
 */
export const FILE_PATTERNS: Record<FileType, FilePattern> = {
    component: {
        patterns: [
            '*.component.tsx',
            '*.component.ts',
            '*.component.jsx',
            '*.component.js',
            '*.[Cc]omponent.tsx',
            '*.[Cc]omponent.jsx',
        ],
        extensions: ['.tsx', '.jsx', '.ts', '.js'],
        description: 'React/Vue/Angular components',
    },
    test: {
        patterns: [
            '*.test.ts',
            '*.test.tsx',
            '*.test.js',
            '*.test.jsx',
            '*.spec.ts',
            '*.spec.tsx',
            '*.spec.js',
            '*.spec.jsx',
        ],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        description: 'Test files',
    },
    model: {
        patterns: ['*.model.ts', '*.model.js', '*.entity.ts', '*.schema.ts'],
        extensions: ['.ts', '.js'],
        description: 'Data models and entities',
    },
    util: {
        patterns: ['*.util.ts', '*.util.js', '*.helper.ts', '*.helper.js'],
        extensions: ['.ts', '.js'],
        description: 'Utility and helper functions',
    },
    config: {
        patterns: [
            '*.config.ts',
            '*.config.js',
            '*.config.mjs',
            '*.config.json',
            'tsconfig.json',
            'package.json',
        ],
        extensions: ['.ts', '.js', '.mjs', '.json'],
        description: 'Configuration files',
    },
    hook: {
        patterns: ['use*.ts', 'use*.tsx', 'use*.js', 'use*.jsx'],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        description: 'React hooks',
    },
    page: {
        patterns: [
            '*.page.tsx',
            '*.page.ts',
            '*.page.jsx',
            '*.page.js',
            'page.tsx',
            'page.ts',
        ],
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
        description: 'Page components',
    },
    api: {
        patterns: ['*.api.ts', '*.api.js', '*.service.ts', '*.service.js'],
        extensions: ['.ts', '.js'],
        description: 'API and service files',
    },
    style: {
        patterns: [
            '*.css',
            '*.scss',
            '*.sass',
            '*.less',
            '*.module.css',
            '*.module.scss',
        ],
        extensions: ['.css', '.scss', '.sass', '.less'],
        description: 'Style files',
    },
    custom: {
        patterns: [],
        extensions: [],
        description: 'Custom pattern',
    },
};

export type FindFilesByPatternOptions = FileTreeOptions & {
    /**
     * Case-sensitive pattern matching
     * @default false
     */
    caseSensitive?: boolean;
    /**
     * Include full file path in results
     * @default true
     */
    includeFullPath?: boolean;
    /**
     * Patterns to exclude
     * Examples: ['*.test.ts', 'dist/**']
     */
    excludePatterns?: string[];
    /**
     * Pre-built file tree to use instead of fetching from rootPath
     * If provided, rootPath parameter will be ignored
     */
    fileTree?: FileNode[];
};