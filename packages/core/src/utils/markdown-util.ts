import { languageMap } from "./constants";

export const stripMarkdownCodeBlocks = (content: string): string => {
  // Remove markdown code blocks (```typescript, ```javascript, ```, etc.)
  let cleaned = content.trim();

  const codeBlockRegex = /```[\w]*\n?([\s\S]*?)\n?```/;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    return match[1].trim();
  }

  return cleaned;
}

/**
 * Remove LLM narrative comments and progress indicators from generated code
 * This removes lines that LLMs sometimes add as commentary before the actual code
 *
 * Examples of patterns removed:
 * - "Searching for the component file to test..."
 * - "✔ Glob "src/components/**""
 * - "   └ 33 files found"
 * - Lines with checkmarks (✔, ✓), crosses (✗, ✘), arrows (→, └, ├)
 * - Descriptive sentences ending with periods before import statements
 *
 * @param content - Code content that may contain LLM comments
 * @returns Cleaned code without LLM narrative comments
 */
export const stripLLMComments = (content: string): string => {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let foundCodeStart = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines at the beginning
    if (!foundCodeStart && trimmedLine === '') {
      continue;
    }

    // Patterns that indicate LLM commentary (not actual code)
    const isLLMComment =
      // Lines with checkmarks, crosses, or tree characters
      /^[✔✓✗✘→└├─│]/.test(trimmedLine) ||
      // Lines that look like progress indicators (e.g., "   └ 33 files found")
      /^\s+[└├─│]/.test(line) ||
      // Lines that are descriptive sentences (end with period, no code-like syntax)
      // But avoid matching JSDoc comments or string literals
      (/\.$/.test(trimmedLine) &&
        !trimmedLine.startsWith('//') &&
        !trimmedLine.startsWith('*') &&
        !trimmedLine.startsWith('import') &&
        !trimmedLine.startsWith('export') &&
        !trimmedLine.includes('=') &&
        !trimmedLine.includes('{') &&
        !trimmedLine.includes('}') &&
        !trimmedLine.includes(';')) ||
      // Lines that look like task descriptions or explanations
      (/^(Searching|Finding|Looking|Reading|Writing|Creating|Generating|Analyzing)/i.test(trimmedLine) &&
        !trimmedLine.includes('(') &&
        !trimmedLine.includes('='));

    // If we find actual code, mark that we've started
    if (!foundCodeStart && !isLLMComment && trimmedLine !== '') {
      foundCodeStart = true;
    }

    // Only include lines after we've found code start, and skip LLM comments
    if (foundCodeStart && !isLLMComment) {
      cleanedLines.push(line);
    } else if (!foundCodeStart && isLLMComment) {
      // Skip LLM comments before code starts
      continue;
    }
  }

  return cleanedLines.join('\n').trim();
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

export const cleanCodeContent = (content: string): string => {
  let cleanContent = stripMarkdownCodeBlocks(content);
  cleanContent = stripLLMComments(cleanContent);
  return cleanContent;
}
