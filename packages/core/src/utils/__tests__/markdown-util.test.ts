import { describe, it, expect } from 'vitest';
import { stripMarkdownCodeBlocks, convertMarkdownToJSON } from '../markdown-util';

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
