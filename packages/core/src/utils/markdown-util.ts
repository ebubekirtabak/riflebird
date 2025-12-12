import { languageMap } from "./constants";

export const stripMarkdownCodeBlocks = (content: string): string => {
  // Remove markdown code blocks (```typescript, ```javascript, ```, etc.)
  let cleaned = content.trim();

  const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    return match[1].trim();
  }

  return cleaned;
}

export const convertMarkdownToJSON = (content: string): JSON => {
  const cleanedContent = stripMarkdownCodeBlocks(content);
  return JSON.parse(cleanedContent);
}

/**
 * Infer language identifier from file extension for markdown code blocks
 */
function inferLanguageFromExtension(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return languageMap[ext || ''] || '';
}


/**
 * Wrap file content in markdown code block with file path comment
 * @param filePath - Path to the file
 * @param content - File content
 * @param language - Optional language identifier (auto-inferred from file extension if not provided)
 * @returns Formatted markdown string with syntax highlighting
 */
export const wrapFileContent = (filePath: string, content: string, language?: string): string => {
  const lang = language || inferLanguageFromExtension(filePath);
  return `\`\`\`${lang}\n// ${filePath}\n${content}\n\`\`\``;
}
