import { describe, it, expect } from 'vitest';
import {
  extractJsonFromResponse,
  extractContentFromResponse,
  extractJsonFromAIResponse,
} from '../json-extractor';

describe('utils/json-extractor', () => {
  describe('extractJsonFromResponse', () => {
    it('should parse plain JSON string', () => {
      const json = '{"key": "value", "number": 42}';
      const result = extractJsonFromResponse(json);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should extract JSON from markdown code block with json tag', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = extractJsonFromResponse(markdown);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from markdown code block without json tag', () => {
      const markdown = '```\n{"key": "value"}\n```';
      const result = extractJsonFromResponse(markdown);

      expect(result).toEqual({ key: 'value' });
    });

    it('should handle multiline JSON in markdown', () => {
      const markdown = '```json\n{\n  "key": "value",\n  "nested": {\n    "prop": true\n  }\n}\n```';
      const result = extractJsonFromResponse(markdown);

      expect(result).toEqual({
        key: 'value',
        nested: { prop: true },
      });
    });

    it('should handle JSON with extra whitespace', () => {
      const json = '  \n  {"key": "value"}  \n  ';
      const result = extractJsonFromResponse(json);

      expect(result).toEqual({ key: 'value' });
    });

    it('should throw error for invalid JSON', () => {
      const invalid = '{key: value}'; // Missing quotes

      expect(() => extractJsonFromResponse(invalid)).toThrow('Failed to parse JSON');
    });
  });

  describe('extractContentFromResponse', () => {
    it('should return string as-is', () => {
      const content = 'test content';
      const result = extractContentFromResponse(content);

      expect(result).toBe('test content');
    });

    it('should extract content from OpenAI response format', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'AI response content',
            },
          },
        ],
      };

      const result = extractContentFromResponse(response);
      expect(result).toBe('AI response content');
    });

    it('should extract content from local provider (Ollama) format', () => {
      const response = {
        message: {
          content: 'Local AI content',
        },
      };

      const result = extractContentFromResponse(response);
      expect(result).toBe('Local AI content');
    });

    it('should throw error for unsupported format', () => {
      const invalid = { unexpected: 'format' };

      expect(() => extractContentFromResponse(invalid)).toThrow(
        'Unable to extract content from AI response'
      );
    });
  });

  describe('extractJsonFromAIResponse', () => {
    it('should extract and parse JSON from OpenAI response', () => {
      const response = {
        choices: [
          {
            message: {
              content: '```json\n{"framework": "Next.js"}\n```',
            },
          },
        ],
      };

      const result = extractJsonFromAIResponse(response);
      expect(result).toEqual({ framework: 'Next.js' });
    });

    it('should extract and parse plain JSON from OpenAI response', () => {
      const response = {
        choices: [
          {
            message: {
              content: '{"framework": "React"}',
            },
          },
        ],
      };

      const result = extractJsonFromAIResponse(response);
      expect(result).toEqual({ framework: 'React' });
    });

    it('should handle complex nested JSON', () => {
      const response = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                framework: 'Next.js',
                libs: ['react', 'typescript'],
                config: { strict: true },
              }),
            },
          },
        ],
      };

      const result = extractJsonFromAIResponse(response);
      expect(result).toEqual({
        framework: 'Next.js',
        libs: ['react', 'typescript'],
        config: { strict: true },
      });
    });
  });
});
