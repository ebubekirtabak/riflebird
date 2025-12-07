import { describe, it, expect } from 'vitest';
import { stripMarkdownCodeBlocks } from '../markdown-util';

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
