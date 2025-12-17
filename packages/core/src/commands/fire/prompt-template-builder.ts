import type { FrameworkInfo, TestFile } from '@models';
import type { PackageManager } from '@models/project-context';

export type PromptTemplateContext = {
  testFramework?: FrameworkInfo;
  languageConfig: FrameworkInfo;
  linterConfig: FrameworkInfo;
  formatterConfig: FrameworkInfo;
  targetFile: TestFile;
  packageManager?: PackageManager;
  [key: string]: string | FrameworkInfo | TestFile | PackageManager | undefined;
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
    const { testFramework, languageConfig, linterConfig, formatterConfig, targetFile, packageManager, ...customVars } = context;
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
      .replace(/\{\{CODE_SNIPPET\}\}/g, content)
      // todo add dependencies and dev dependencies as toon
      .replace(/\{\{PACKAGE_MANAGER_TYPE\}\}/g, packageManager?.type || 'npm')
      .replace(/\{\{PACKAGE_MANAGER_TEST_COMMAND\}\}/g, packageManager?.testCommand || 'npm test')
      .replace(/\{\{PACKAGE_MANAGER_TEST_SCRIPT\}\}/g, packageManager?.testScript || 'test')
      .replace(/\{\{PACKAGE_INFO\}\}/g, this.formatPackageInfo(packageManager));

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

  /**
   * Format package.json information in a readable format
   * @param packageManager - Package manager configuration with full package info
   * @returns Formatted package information for AI context
   */
  private formatPackageInfo(packageManager?: PackageManager): string {
    if (!packageManager?.packageInfo) {
      return 'No package information available';
    }

    const { packageInfo } = packageManager;
    const sections: string[] = [];

    // Project metadata
    if (packageInfo.name || packageInfo.version || packageInfo.description) {
      sections.push('**Project:**');
      if (packageInfo.name) sections.push(`- Name: ${packageInfo.name}`);
      if (packageInfo.version) sections.push(`- Version: ${packageInfo.version}`);
      if (packageInfo.description) sections.push(`- Description: ${packageInfo.description}`);
    }

    // Detected test frameworks
    if (packageInfo.testFrameworks && packageInfo.testFrameworks.length > 0) {
      sections.push('\n**Test Frameworks:**');
      sections.push(`- ${packageInfo.testFrameworks.join(', ')}`);
    }

    // Key dependencies (limit to most relevant for testing)
    if (packageInfo.devDependencies && Object.keys(packageInfo.devDependencies).length > 0) {
      sections.push('\n**Dev Dependencies:**');
      const deps = Object.entries(packageInfo.devDependencies)
        .slice(0, 10) // Limit to first 10
        .map(([name, version]) => `- ${name}@${version}`)
        .join('\n');
      sections.push(deps);

      const remaining = Object.keys(packageInfo.devDependencies).length - 10;
      if (remaining > 0) {
        sections.push(`- ... and ${remaining} more`);
      }
    }

    // Dependencies (limit to most relevant)
    if (packageInfo.dependencies && Object.keys(packageInfo.dependencies).length > 0) {
      sections.push('\n**Dependencies:**');
      const deps = Object.entries(packageInfo.dependencies)
        .slice(0, 10) // Limit to first 10
        .map(([name, version]) => `- ${name}@${version}`)
        .join('\n');
      sections.push(deps);

      const remaining = Object.keys(packageInfo.dependencies).length - 10;
      if (remaining > 0) {
        sections.push(`- ... and ${remaining} more`);
      }
    }

    // Useful scripts
    if (packageInfo.scripts) {
      const relevantScripts = ['test', 'test:unit', 'test:watch', 'test:coverage', 'build', 'dev', 'lint'];
      const foundScripts = Object.entries(packageInfo.scripts)
        .filter(([name]) => relevantScripts.includes(name))
        .map(([name, script]) => `- ${name}: ${script}`)
        .join('\n');

      if (foundScripts) {
        sections.push('\n**Relevant Scripts:**');
        sections.push(foundScripts);
      }
    }

    // Node engine requirements
    if (packageInfo.engines?.node) {
      sections.push(`\n**Node Version:** ${packageInfo.engines.node}`);
    }

    return sections.join('\n');
  }
}
