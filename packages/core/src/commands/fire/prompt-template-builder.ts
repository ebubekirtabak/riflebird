import type { FrameworkInfo, TestFile } from '@models';

export type PromptTemplateContext = {
  testFramework?: FrameworkInfo;
  languageConfig: FrameworkInfo;
  linterConfig: FrameworkInfo;
  formatterConfig: FrameworkInfo;
  targetFile: TestFile;
  [key: string]: string | FrameworkInfo | TestFile | undefined;
};

export type TemplateVariable = {
  placeholder: string;
  value: string | FrameworkInfo | TestFile | undefined;
  type?: 'text' | 'config';
  fallback?: string;
};

/**
 * Builds AI prompts by replacing template placeholders with project-specific configurations
 *
 * This builder supports both predefined context (for common use cases) and custom variables
 * (for specialized templates), maintaining type safety while being flexible.
 */
export class PromptTemplateBuilder {
  /**
   * Build a prompt template with project-specific configurations
   * @param template - The base template string with placeholders like {{VARIABLE_NAME}}
   * @param context - Project context containing configurations and file content
   * @returns Processed template with all placeholders replaced
   */
  build(template: string, context: PromptTemplateContext): string {
    const { testFramework, languageConfig, linterConfig, formatterConfig, targetFile, ...customVars } = context;
    const { filePath, content, testFilePath } = targetFile;

    // Apply standard replacements
    let result = template
      .replace(/\{\{TEST_FRAMEWORK\}\}/g, testFramework?.name || 'unknown framework')
      .replace(/\{\{TEST_FRAMEWORK_CONFIG\}\}/g, this.formatConfig(testFramework, 'No specific configuration'))
      .replace(/\{\{LANGUAGE_CONFIGURATIONS\}\}/g, this.formatConfig(languageConfig, 'No specific language configuration'))
      .replace(/\{\{FORMATTING_RULES\}\}/g, this.formatConfig(formatterConfig, 'Follow project conventions'))
      .replace(/\{\{LINTING_RULES\}\}/g, this.formatConfig(linterConfig, 'Follow project linting rules'))
      .replace(/\{\{FILE_PATH\}\}/g, filePath)
      .replace(/\{\{TEST_FILE_PATH\}\}/g, testFilePath)
      .replace(/\{\{CODE_SNIPPET\}\}/g, content);

    // Apply custom variables if any
    for (const [key, value] of Object.entries(customVars)) {
      if (value !== undefined) {
        const placeholder = new RegExp(`\\{\\{${key.toUpperCase()}\\}\\}`, 'g');
        const formattedValue = typeof value === 'string' ? value : this.formatConfig(value as FrameworkInfo);
        result = result.replace(placeholder, formattedValue);
      }
    }

    return result;
  }

  /**
   * Build a template with fully custom variables (for specialized use cases)
   * @param template - The base template string
   * @param variables - Array of variable definitions
   * @returns Processed template
   */
  buildWithVariables(template: string, variables: TemplateVariable[]): string {
    let result = template;

    for (const variable of variables) {
      const { placeholder, value, type = 'text', fallback } = variable;
      const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');

      if (type === 'config' && typeof value !== 'string') {
        result = result.replace(regex, this.formatConfig(value as FrameworkInfo, fallback));
      } else {
        const stringValue = typeof value === 'string' ? value : fallback || '';
        result = result.replace(regex, stringValue);
      }
    }

    return result;
  }

  /**
   * Format framework/config information as a markdown code block
   * @param config - Framework configuration
   * @param fallback - Fallback message if config content is not available
   * @returns Formatted markdown code block
   */
  private formatConfig(config?: FrameworkInfo, fallback?: string): string {
    if (!config) {
      return fallback ? `\`\`\`\n${fallback}\n\`\`\`` : '';
    }

    const { fileLang, configFilePath, configContent } = config;
    const content = configContent || fallback || 'No configuration available';
    const header = configFilePath ? `// ${configFilePath}\n` : '';

    return `\`\`\`${fileLang || ''}\n${header}${content}\n\`\`\``;
  }
}
