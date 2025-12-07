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
