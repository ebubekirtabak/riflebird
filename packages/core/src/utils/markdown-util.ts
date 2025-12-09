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
 * Wrap file content in markdown code block with file path comment
 * @param filePath - Path to the file
 * @param content - File content
 * @returns Formatted markdown string
 */
export const wrapFileContent = (filePath: string, content: string): string => {
  return `\`\`\`\n// ${filePath}\n${content}\n\`\`\``;
}
