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

    // High-confidence LLM artifacts that should always be stripped
    // Checkmarks, crosses, tree characters, or explicit progress indicators
    const isHighConfidenceArtifact =
      /^[\u2714\u2713\u2717\u2718\u2192\u2514\u251c\u2500\u2502]/.test(trimmedLine) || // ✔, ✓, ✗, ✘, →, └, ├, ─, │
      /^\s+[└├─│]/.test(line);

    if (isHighConfidenceArtifact) {
      continue;
    }

    if (foundCodeStart) {
      // PHASE 2: Code Phase
      // Once we've found the start of code, we are conservative.
      // We only strip high-confidence artifacts (handled above).
      // We process everything else as code.
      cleanedLines.push(line);
    } else {
      // PHASE 1: Preamble Phase
      // We are looking for the start of code.
      // logic is aggressive here to strip "Here is the code:" chatter.

      const isPreambleComment =
        // Lines that are descriptive sentences (end with period, no code-like syntax)
        (/\.$/.test(trimmedLine) &&
          !trimmedLine.startsWith('//') &&
          !trimmedLine.startsWith('*') &&
          !trimmedLine.startsWith('import') &&
          !trimmedLine.startsWith('export') &&
          !trimmedLine.includes('=') &&
          !trimmedLine.includes('{') &&
          !trimmedLine.includes('}') &&
          !trimmedLine.includes(';') &&
          // Extra safety: sentences usually don't have parens unless explaining code
          // But code often has parens.
          !trimmedLine.includes('(') &&
          !trimmedLine.includes(')')) ||
        // Lines that look like task descriptions or explanations
        // We include common preamble starters like "Here", "This" to catch sentences with parens that fail the period check.
        (/^(Searching|Finding|Looking|Reading|Writing|Creating|Generating|Analyzing|Here|This|The|Note|Please)/i.test(trimmedLine) &&
          !trimmedLine.includes('=') &&
          // Allow parens in these comments IF they have spaces (e.g. "Searching for (file)"),
          // but protect function calls like "Searching(x)" or "Searching.call()".
          (!trimmedLine.includes('(') || /\s/.test(trimmedLine)));

      if (!isPreambleComment) {
        // Not a known comment pattern, so assume it's code
        foundCodeStart = true;
        cleanedLines.push(line);
      }
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
