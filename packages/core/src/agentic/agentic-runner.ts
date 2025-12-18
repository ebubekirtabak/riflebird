import path from 'path';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import {
  info,
  debug,
  ProjectFileWalker,
  stripMarkdownCodeBlocks,
  cleanCodeContent,
  getRelatedExtensions
} from '@utils';
import { AgenticFileRequest, AgenticGenerateResponse, AgenticOptions, AgenticResponse } from './types';


export function isFileRequest(response: AgenticResponse): response is AgenticFileRequest {
  return response.action === 'request_files';
}

export class AgenticRunner {
  private fileWalker: ProjectFileWalker;

  constructor(private options: AgenticOptions) {
    this.fileWalker = new ProjectFileWalker({ projectRoot: options.projectRoot });
  }

  async run(
    initialPrompt: string,
    onSuccess?: (response: AgenticGenerateResponse) => Promise<string | null>
  ): Promise<string> {
    const { maxIterations = 5 } = this.options;
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: initialPrompt }
    ];

    for (let i = 0; i < maxIterations; i++) {
      const step = await this.performTurn(messages, onSuccess);

      if (step.complete) {
        return step.result;
      }

      const { content, files } = step;

      // Handle file request
      info(`Agent requested files: ${files.join(', ')}`);

      // Add assistant's request to history
      messages.push({ role: 'assistant', content });

      let fileContext = '';
      for (const filePath of files) {
        const { content, resolvedPath, errorMsg } = await this.resolveFile(filePath);

        if (content !== null) {
          const header = resolvedPath !== filePath
            ? `\n--- FILE: ${filePath} (Resolved to ${resolvedPath}) ---\n`
            : `\n--- FILE: ${filePath} ---\n`;
          fileContext += `${header}${content}\n`;
        } else {
          fileContext += `\n--- FILE: ${filePath} ---\n[Error reading file: ${errorMsg}]\n`;
        }
      }

      // specific instructions for next turn
      const nextUserMessage = `Here are the requested files:\n${fileContext}\n\nPlease proceed with generating the solution, or request more files if absolutely necessary.`;

      messages.push({ role: 'user', content: nextUserMessage });
    }

    throw new Error(`Agent failed to generate result after ${maxIterations} iterations`);
  }

  private async performTurn(
    messages: ChatCompletionMessageParam[],
    onSuccess?: (response: AgenticGenerateResponse) => Promise<string | null>
  ): Promise<{ complete: true; result: string } | { complete: false; content: string; files: string[] }> {
    const { model, temperature, provider } = this.options.config.ai;
    const response = await this.options.aiClient.createChatCompletion({
      model,
      temperature,
      messages,
    });

    const { choices = [] } = response;
    if (choices.length === 0) {
      throw new Error('AI did not return any choices');
    }

    const content = choices[0].message.content;
    if (!content || typeof content !== 'string') {
      throw new Error(`${provider} AI returned empty or invalid content`);
    }

    let parsedResponse: AgenticResponse;
    try {
      parsedResponse = JSON.parse(stripMarkdownCodeBlocks(content));
    } catch {
      // Fallback: if valid code block found, treat as implicit success/generation
      debug(`${provider} AI Failed to parse JSON: ${content}`);
      throw new Error(`${provider} AI response was not valid JSON`);
    }

    // If prompt logic or customized checking determines this is a final result
    if (!isFileRequest(parsedResponse)) {
      if (onSuccess) {
        const result = await onSuccess(parsedResponse);
        if (result) return { complete: true, result };
      }

      return { complete: true, result: cleanCodeContent(parsedResponse.code) };
    }

    return { complete: false, content, files: parsedResponse.files };
  }

  private async resolveFile(filePath: string): Promise<{
    content: string | null;
    resolvedPath: string;
    errorMsg: string;
  }> {
    let content: string | null = null;
    let resolvedPath = filePath;
    let errorMsg = '';

    try {
      content = await this.fileWalker.readFileFromProject(filePath);
    } catch (err) {
      // Attempt recovery by trying related extensions
      const ext = path.extname(filePath);
      const extensions = getRelatedExtensions(ext);
      const base = ext ? filePath.slice(0, -ext.length) : filePath;

      for (const tryExt of extensions) {
        if (tryExt === ext) continue;
        const tryPath = base + tryExt;
        try {
          content = await this.fileWalker.readFileFromProject(tryPath);
          resolvedPath = tryPath;
          break;
        } catch { /* ignore */ }
      }

      if (!content) {
        errorMsg = err instanceof Error ? err.message : String(err);
      }
    }

    return { content, resolvedPath, errorMsg };
  }
}
