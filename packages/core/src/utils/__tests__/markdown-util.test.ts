import { describe, it, expect } from 'vitest';
import { stripMarkdownCodeBlocks, convertMarkdownToJSON, wrapFileContent } from '../markdown-util';

describe('stripMarkdownCodeBlocks', () => {
  it('should strip markdown code block with language identifier', () => {
    const input = '```typescript\nconst x = 1;\nconsole.log(x);\n```';
    const expected = 'const x = 1;\nconsole.log(x);';

    expect(stripMarkdownCodeBlocks(input)).toBe(expected);
  });

  it('should strip markdown code block without language identifier', () => {
    const input = '```\nconst x = 1;\n```';
    const expected = 'const x = 1;';

    expect(stripMarkdownCodeBlocks(input)).toBe(expected);
  });

  it('should return content as-is when no code block markers present', () => {
    const input = 'const x = 1;\nconsole.log(x);';

    expect(stripMarkdownCodeBlocks(input)).toBe(input);
  });

  it('should handle empty content', () => {
    const input = '';

    expect(stripMarkdownCodeBlocks(input)).toBe('');
  });

  it('should trim whitespace from content without code blocks', () => {
    const input = '  const x = 1;  ';
    const expected = 'const x = 1;';

    expect(stripMarkdownCodeBlocks(input)).toBe(expected);
  });

  it('should handle code block with javascript identifier', () => {
    const input = '```javascript\nfunction test() {\n  return true;\n}\n```';
    const expected = 'function test() {\n  return true;\n}';

    expect(stripMarkdownCodeBlocks(input)).toBe(expected);
  });
});

describe('convertMarkdownToJSON', () => {
  it('should parse valid JSON from markdown code block', () => {
    const input = '```json\n{"name": "test", "value": 42}\n```';
    const expected = { name: 'test', value: 42 };

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });

  it('should parse JSON without markdown code block', () => {
    const input = '{"name": "test", "value": 42}';
    const expected = { name: 'test', value: 42 };

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });

  it('should parse JSON array from markdown', () => {
    const input = '```json\n[1, 2, 3, 4, 5]\n```';
    const expected = [1, 2, 3, 4, 5];

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });

  it('should parse nested JSON objects', () => {
    const input = '```json\n{"user": {"name": "John", "age": 30}, "active": true}\n```';
    const expected = { user: { name: 'John', age: 30 }, active: true };

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });

  it('should handle JSON with whitespace in code block', () => {
    const input = '```json\n  {"key": "value"}  \n```';
    const expected = { key: 'value' };

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });

  it('should throw error for invalid JSON', () => {
    const input = '```json\n{invalid json}\n```';

    expect(() => convertMarkdownToJSON(input)).toThrow();
  });

  it('should throw error for empty content', () => {
    const input = '';

    expect(() => convertMarkdownToJSON(input)).toThrow();
  });

  it('should parse JSON with different language identifiers', () => {
    const input = '```javascript\n{"type": "module"}\n```';
    const expected = { type: 'module' };

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });

  it('should handle JSON with special characters', () => {
    const input = '```json\n{"text": "Hello\\nWorld", "emoji": "🚀"}\n```';
    const expected = { text: 'Hello\nWorld', emoji: '🚀' };

    expect(convertMarkdownToJSON(input)).toEqual(expected);
  });
});

describe('wrapFileContent', () => {
  it('should wrap content with file path comment and infer language from extension', () => {
    const filePath = 'src/utils/helper.ts';
    const content = 'export function add(a: number, b: number) {\n  return a + b;\n}';
    const expected = '```typescript\n// src/utils/helper.ts\nexport function add(a: number, b: number) {\n  return a + b;\n}\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should infer javascript language for .js files', () => {
    const filePath = 'src/utils/helper.js';
    const content = 'export function add(a, b) { return a + b; }';
    const expected = '```javascript\n// src/utils/helper.js\nexport function add(a, b) { return a + b; }\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should infer python language for .py files', () => {
    const filePath = 'scripts/deploy.py';
    const content = 'def deploy():\n    print("Deploying...")';
    const expected = '```python\n// scripts/deploy.py\ndef deploy():\n    print("Deploying...")\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should infer json language for .json files', () => {
    const filePath = 'config/settings.json';
    const content = '{"port": 3000}';
    const expected = '```json\n// config/settings.json\n{"port": 3000}\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should allow manual language override', () => {
    const filePath = 'src/utils/helper.ts';
    const content = 'const x = 1;';
    const expected = '```plaintext\n// src/utils/helper.ts\nconst x = 1;\n```';

    expect(wrapFileContent(filePath, content, 'plaintext')).toBe(expected);
  });

  it('should handle empty content', () => {
    const filePath = 'src/empty.ts';
    const content = '';
    const expected = '```typescript\n// src/empty.ts\n\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should handle multiline content with language inference', () => {
    const filePath = 'src/component.tsx';
    const content = 'import React from "react";\n\nexport const Button = () => {\n  return <button>Click me</button>;\n};';
    const expected = '```typescript\n// src/component.tsx\nimport React from "react";\n\nexport const Button = () => {\n  return <button>Click me</button>;\n};\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should preserve content with special characters', () => {
    const filePath = 'test/data.json';
    const content = '{"emoji": "🎯", "text": "Hello\\nWorld"}';
    const expected = '```json\n// test/data.json\n{"emoji": "🎯", "text": "Hello\\nWorld"}\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should handle files with no extension gracefully', () => {
    const filePath = 'Makefile';
    const content = 'build:\n\techo "Building..."';
    const expected = '```\n// Makefile\nbuild:\n\techo "Building..."\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should handle files with unknown extensions', () => {
    const filePath = 'data.xyz';
    const content = 'some content';
    const expected = '```\n// data.xyz\nsome content\n```';

    expect(wrapFileContent(filePath, content)).toBe(expected);
  });

  it('should infer language for common config files', () => {
    const testCases = [
      { filePath: 'config.yaml', expected: 'yaml' },
      { filePath: 'style.css', expected: 'css' },
      { filePath: 'index.html', expected: 'html' },
      { filePath: 'script.sh', expected: 'bash' },
    ];

    testCases.forEach(({ filePath, expected: lang }) => {
      const content = 'test content';
      const result = wrapFileContent(filePath, content);
      expect(result).toContain(`\`\`\`${lang}\n`);
    });
  });
});
