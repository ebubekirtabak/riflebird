import { describe, it, expect, beforeEach } from 'vitest';
import { PromptTemplateBuilder, type PromptTemplateContext, type TemplateVariable } from '../prompt-template-builder';
import type { FrameworkInfo } from '@models/project-context';
import type { TestFile } from '@models';

describe('PromptTemplateBuilder', () => {
  let builder: PromptTemplateBuilder;

  beforeEach(() => {
    builder = new PromptTemplateBuilder();
  });

  describe('build', () => {
    it('should replace all standard placeholders', () => {
      const template = `
Framework: {{TEST_FRAMEWORK}}
Config: {{TEST_FRAMEWORK_CONFIG}}
Language: {{LANGUAGE_CONFIGURATIONS}}
Formatting: {{FORMATTING_RULES}}
Linting: {{LINTING_RULES}}
Code: {{CODE_SNIPPET}}
File: {{FILE_PATH}}
Test File: {{TEST_FILE_PATH}}
      `.trim();

      const targetFile: TestFile = {
        filePath: 'src/utils.ts',
        content: 'function add(a, b) { return a + b; }',
        testFilePath: 'src/utils.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: {
          name: 'vitest',
          version: '1.0.0',
          fileLang: 'typescript',
          configFilePath: 'vitest.config.ts',
          configContent: 'export default { test: { globals: true } }',
        },
        languageConfig: {
          name: 'typescript',
          fileLang: 'json',
          configFilePath: 'tsconfig.json',
          configContent: '{ "compilerOptions": {} }',
        },
        linterConfig: {
          name: 'eslint',
          fileLang: 'javascript',
          configFilePath: 'eslint.config.js',
          configContent: 'module.exports = { rules: {} }',
        },
        formatterConfig: {
          name: 'prettier',
          fileLang: 'json',
          configFilePath: '.prettierrc',
          configContent: '{ "semi": true }',
        },
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('Framework: vitest');
      expect(result).toContain('```typescript');
      expect(result).toContain('vitest.config.ts');
      expect(result).toContain('export default { test: { globals: true } }');
      expect(result).toContain('Code: function add(a, b) { return a + b; }');
      expect(result).toContain('File: src/utils.ts');
      expect(result).toContain('Test File: src/utils.test.ts');
    });

    it('should handle missing test framework with fallback', () => {
      const template = 'Framework: {{TEST_FRAMEWORK}}\nConfig: {{TEST_FRAMEWORK_CONFIG}}';

      const targetFile: TestFile = {
        filePath: 'src/fallback.ts',
        content: 'const x = 1;',
        testFilePath: 'src/fallback.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('Framework: unknown framework');
      expect(result).toContain('No specific configuration');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = '{{CODE_SNIPPET}} and {{CODE_SNIPPET}} again';

      const targetFile: TestFile = {
        filePath: 'src/example.ts',
        content: 'test code',
        testFilePath: 'src/example.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toBe('test code and test code again');
    });

    it('should replace custom variables', () => {
      const template = 'Framework: {{TEST_FRAMEWORK}}\nBrowser: {{BROWSER}}\nURL: {{BASE_URL}}';

      const targetFile: TestFile = {
        filePath: 'src/test.ts',
        content: 'const test = 1;',
        testFilePath: 'src/test.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'playwright' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        browser: 'chromium',
        base_url: 'https://example.com',
      };

      const result = builder.build(template, context);

      expect(result).toContain('Framework: playwright');
      expect(result).toContain('Browser: chromium');
      expect(result).toContain('URL: https://example.com');
    });

    it('should handle custom FrameworkInfo variables', () => {
      const template = 'Main: {{TEST_FRAMEWORK}}\nExtra: {{EXTRA_CONFIG}}';

      const extraConfig: FrameworkInfo = {
        name: 'cypress',
        fileLang: 'javascript',
        configFilePath: 'cypress.config.js',
        configContent: 'module.exports = {}',
      };

      const targetFile: TestFile = {
        filePath: 'src/main.ts',
        content: 'test',
        testFilePath: 'src/main.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'playwright' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        extra_config: extraConfig,
      };

      const result = builder.build(template, context);

      expect(result).toContain('Main: playwright');
      expect(result).toContain('```javascript');
      expect(result).toContain('cypress.config.js');
    });

    it('should format config with proper markdown code blocks', () => {
      const template = '{{TEST_FRAMEWORK_CONFIG}}';

      const targetFile: TestFile = {
        filePath: 'src/config.ts',
        content: 'test',
        testFilePath: 'src/config.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: {
          name: 'vitest',
          fileLang: 'typescript',
          configFilePath: 'vitest.config.ts',
          configContent: 'export default {}',
        },
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toMatch(/^```typescript\n\/\/ vitest\.config\.ts\nexport default {}\n```$/);
    });

    it('should handle empty config content with fallback message', () => {
      const template = '{{LANGUAGE_CONFIGURATIONS}}';

      const targetFile: TestFile = {
        filePath: 'src/empty.ts',
        content: 'test',
        testFilePath: 'src/empty.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'vitest' } as FrameworkInfo,
        languageConfig: {
          name: 'typescript',
          fileLang: 'json',
          configFilePath: 'tsconfig.json',
          configContent: '',
        },
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('No specific language configuration');
    });
  });

  describe('buildWithVariables', () => {
    it('should replace text type variables', () => {
      const template = 'Name: {{NAME}}, Age: {{AGE}}';

      const variables: TemplateVariable[] = [
        { placeholder: 'NAME', value: 'John Doe', type: 'text' },
        { placeholder: 'AGE', value: '30', type: 'text' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toBe('Name: John Doe, Age: 30');
    });

    it('should replace config type variables', () => {
      const template = 'Config: {{TEST_CONFIG}}';

      const config: FrameworkInfo = {
        name: 'vitest',
        fileLang: 'typescript',
        configFilePath: 'vitest.config.ts',
        configContent: 'export default {}',
      };

      const variables: TemplateVariable[] = [
        { placeholder: 'TEST_CONFIG', value: config, type: 'config' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toContain('```typescript');
      expect(result).toContain('vitest.config.ts');
      expect(result).toContain('export default {}');
    });

    it('should use fallback for undefined values', () => {
      const template = 'Value: {{VALUE}}';

      const variables: TemplateVariable[] = [
        { placeholder: 'VALUE', value: undefined, type: 'text', fallback: 'default value' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toBe('Value: default value');
    });

    it('should handle multiple variables with different types', () => {
      const template = 'Name: {{NAME}}\nConfig: {{CONFIG}}\nBrowser: {{BROWSER}}';

      const config: FrameworkInfo = {
        name: 'cypress',
        fileLang: 'javascript',
        configContent: 'module.exports = {}',
      };

      const variables: TemplateVariable[] = [
        { placeholder: 'NAME', value: 'E2E Test', type: 'text' },
        { placeholder: 'CONFIG', value: config, type: 'config' },
        { placeholder: 'BROWSER', value: 'chrome', type: 'text' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toContain('Name: E2E Test');
      expect(result).toContain('```javascript');
      expect(result).toContain('Browser: chrome');
    });

    it('should default to text type when type is not specified', () => {
      const template = 'Value: {{VALUE}}';

      const variables: TemplateVariable[] = [
        { placeholder: 'VALUE', value: 'simple text' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toBe('Value: simple text');
    });

    it('should handle empty variable array', () => {
      const template = 'Static {{VALUE}} text';
      const variables: TemplateVariable[] = [];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toBe('Static {{VALUE}} text');
    });

    it('should replace multiple occurrences of same variable', () => {
      const template = '{{NAME}} says hello. {{NAME}} says goodbye.';

      const variables: TemplateVariable[] = [
        { placeholder: 'NAME', value: 'Alice', type: 'text' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toBe('Alice says hello. Alice says goodbye.');
    });

    it('should use config fallback when value is undefined', () => {
      const template = 'Config: {{CONFIG}}';

      const variables: TemplateVariable[] = [
        { placeholder: 'CONFIG', value: undefined, type: 'config', fallback: 'No config available' },
      ];

      const result = builder.buildWithVariables(template, variables);

      expect(result).toContain('No config available');
    });
  });

  describe('formatConfig (private method via public API)', () => {
    it('should format config with all properties', () => {
      const template = '{{TEST_FRAMEWORK_CONFIG}}';

      const targetFile: TestFile = {
        filePath: 'src/jest-test.ts',
        content: 'test',
        testFilePath: 'src/jest-test.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: {
          name: 'jest',
          version: '29.0.0',
          fileLang: 'javascript',
          configFilePath: 'jest.config.js',
          configContent: 'module.exports = { testEnvironment: "node" }',
        },
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('```javascript');
      expect(result).toContain('// jest.config.js');
      expect(result).toContain('module.exports = { testEnvironment: "node" }');
      expect(result).toContain('```');
    });

    it('should handle missing fileLang gracefully', () => {
      const template = '{{TEST_FRAMEWORK_CONFIG}}';

      const targetFile: TestFile = {
        filePath: 'src/no-lang.ts',
        content: 'test',
        testFilePath: 'src/no-lang.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: {
          name: 'vitest',
          configFilePath: 'vitest.config.ts',
          configContent: 'export default {}',
        },
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('```');
      expect(result).toContain('vitest.config.ts');
      expect(result).toContain('export default {}');
    });

    it('should handle missing configFilePath', () => {
      const template = '{{TEST_FRAMEWORK_CONFIG}}';

      const targetFile: TestFile = {
        filePath: 'src/no-path.ts',
        content: 'test',
        testFilePath: 'src/no-path.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: {
          name: 'vitest',
          fileLang: 'typescript',
          configContent: 'export default {}',
        },
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('```typescript');
      expect(result).not.toContain('//');
      expect(result).toContain('export default {}');
    });
  });

  describe('integration scenarios', () => {
    it('should build complete unit test prompt', () => {
      const template = `
Generate a unit test for the following code using {{TEST_FRAMEWORK}}.

Test Framework Configuration:
{{TEST_FRAMEWORK_CONFIG}}

Language Configuration:
{{LANGUAGE_CONFIGURATIONS}}

Code to Test:
{{CODE_SNIPPET}}
      `.trim();

      const targetFile: TestFile = {
        filePath: 'src/sum.ts',
        content: 'export function sum(a: number, b: number): number { return a + b; }',
        testFilePath: 'src/sum.test.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: {
          name: 'vitest',
          fileLang: 'typescript',
          configFilePath: 'vitest.config.ts',
          configContent: 'export default { test: { globals: true } }',
        },
        languageConfig: {
          name: 'typescript',
          fileLang: 'json',
          configFilePath: 'tsconfig.json',
          configContent: '{ "compilerOptions": { "strict": true } }',
        },
        linterConfig: {
          name: 'eslint',
          fileLang: 'javascript',
          configContent: 'module.exports = {}',
        },
        formatterConfig: {
          name: 'prettier',
          fileLang: 'json',
          configContent: '{ "semi": true }',
        },
        targetFile,
      };

      const result = builder.build(template, context);

      expect(result).toContain('Generate a unit test');
      expect(result).toContain('using vitest');
      expect(result).toContain('vitest.config.ts');
      expect(result).toContain('tsconfig.json');
      expect(result).toContain('export function sum');
    });

    it('should build e2e test prompt with custom variables', () => {
      const template = `
Generate E2E test using {{TEST_FRAMEWORK}}.
Browser: {{BROWSER}}
URL: {{BASE_URL}}

Code:
{{CODE_SNIPPET}}
      `.trim();

      const targetFile: TestFile = {
        filePath: 'src/e2e.spec.ts',
        content: 'test("should login", async ({ page }) => { })',
        testFilePath: 'src/e2e.spec.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'playwright' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        browser: 'chromium',
        base_url: 'https://app.example.com',
      };

      const result = builder.build(template, context);

      expect(result).toContain('using playwright');
      expect(result).toContain('Browser: chromium');
      expect(result).toContain('URL: https://app.example.com');
      expect(result).toContain('should login');
    });
  });

  describe('package info formatting', () => {
    it('should format package info with all details', () => {
      const template = `
Package Manager: {{PACKAGE_MANAGER_TYPE}}
Test Command: {{PACKAGE_MANAGER_TEST_COMMAND}}
Package Info:
{{PACKAGE_INFO}}
      `.trim();

      const targetFile: TestFile = {
        filePath: 'src/test.ts',
        content: 'export const test = true;',
        testFilePath: 'src/test.spec.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'vitest' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        packageManager: {
          type: 'pnpm',
          testCommand: 'pnpm test',
          testScript: 'vitest',
          packageInfo: {
            name: 'my-project',
            version: '1.0.0',
            description: 'Test project',
            testFrameworks: ['vitest', '@testing-library/react'],
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              vitest: '^1.0.0',
              '@testing-library/react': '^14.0.0',
              typescript: '^5.0.0',
            },
            scripts: {
              test: 'vitest',
              'test:coverage': 'vitest --coverage',
              build: 'tsc',
              dev: 'vite',
            },
            engines: {
              node: '>=18.0.0',
            },
          },
        },
      };

      const result = builder.build(template, context);

      // Basic info
      expect(result).toContain('Package Manager: pnpm');
      expect(result).toContain('Test Command: pnpm test');

      // Package info
      expect(result).toContain('Name: my-project');
      expect(result).toContain('Version: 1.0.0');
      expect(result).toContain('Description: Test project');

      // Test frameworks
      expect(result).toContain('Test Frameworks:');
      expect(result).toContain('vitest, @testing-library/react');

      // Dev dependencies
      expect(result).toContain('Dev Dependencies:');
      expect(result).toContain('vitest@^1.0.0');
      expect(result).toContain('@testing-library/react@^14.0.0');

      // Dependencies
      expect(result).toContain('Dependencies:');
      expect(result).toContain('react@^18.2.0');

      // Scripts
      expect(result).toContain('Relevant Scripts:');
      expect(result).toContain('test: vitest');
      expect(result).toContain('test:coverage: vitest --coverage');

      // Engine
      expect(result).toContain('**Node Version:** >=18.0.0');
    });

    it('should handle missing package info gracefully', () => {
      const template = 'Package Info: {{PACKAGE_INFO}}';

      const targetFile: TestFile = {
        filePath: 'src/test.ts',
        content: 'export const test = true;',
        testFilePath: 'src/test.spec.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'vitest' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        packageManager: {
          type: 'npm',
          testCommand: 'npm test',
        },
      };

      const result = builder.build(template, context);

      expect(result).toContain('No package information available');
    });

    it('should limit dependency lists to 10 items', () => {
      const template = '{{PACKAGE_INFO}}';

      const targetFile: TestFile = {
        filePath: 'src/test.ts',
        content: 'export const test = true;',
        testFilePath: 'src/test.spec.ts',
        testContent: '',
      };

      // Create 15 dependencies
      const dependencies: Record<string, string> = {};
      for (let i = 1; i <= 15; i++) {
        dependencies[`package-${i}`] = `^${i}.0.0`;
      }

      const context: PromptTemplateContext = {
        testFramework: { name: 'vitest' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        packageManager: {
          type: 'npm',
          testCommand: 'npm test',
          packageInfo: {
            dependencies,
          },
        },
      };

      const result = builder.build(template, context);

      // Should show first 10
      expect(result).toContain('package-1@^1.0.0');
      expect(result).toContain('package-10@^10.0.0');

      // Should indicate there are more
      expect(result).toContain('... and 5 more');

      // Should not show all 15
      expect(result).not.toContain('package-15@^15.0.0');
    });

    it('should only show relevant scripts', () => {
      const template = '{{PACKAGE_INFO}}';

      const targetFile: TestFile = {
        filePath: 'src/test.ts',
        content: 'export const test = true;',
        testFilePath: 'src/test.spec.ts',
        testContent: '',
      };

      const context: PromptTemplateContext = {
        testFramework: { name: 'vitest' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        packageManager: {
          type: 'npm',
          testCommand: 'npm test',
          packageInfo: {
            scripts: {
              test: 'vitest',
              'test:unit': 'vitest run',
              'test:coverage': 'vitest --coverage',
              build: 'tsc',
              dev: 'vite',
              lint: 'eslint .',
              deploy: 'echo "deploying"',
              'random-script': 'echo "random"',
            },
          },
        },
      };

      const result = builder.build(template, context);

      // Should show test-related and build/dev/lint scripts
      expect(result).toContain('test: vitest');
      expect(result).toContain('test:unit: vitest run');
      expect(result).toContain('test:coverage: vitest --coverage');
      expect(result).toContain('build: tsc');
      expect(result).toContain('dev: vite');
      expect(result).toContain('lint: eslint .');

      // Should not show irrelevant scripts
      expect(result).not.toContain('deploy:');
      expect(result).not.toContain('random-script:');
    });
    it('should limit devDependency lists to 10 items', () => {
      const template = '{{PACKAGE_INFO}}';

      const targetFile: TestFile = {
        filePath: 'src/test.ts',
        content: 'export const test = true;',
        testFilePath: 'src/test.spec.ts',
        testContent: '',
      };

      // Create 15 devDependencies
      const devDependencies: Record<string, string> = {};
      for (let i = 1; i <= 15; i++) {
        devDependencies[`dev-dep-${i}`] = `^${i}.0.0`;
      }

      const context: PromptTemplateContext = {
        testFramework: { name: 'vitest' } as FrameworkInfo,
        languageConfig: { name: 'typescript' } as FrameworkInfo,
        linterConfig: { name: 'eslint' } as FrameworkInfo,
        formatterConfig: { name: 'prettier' } as FrameworkInfo,
        targetFile,
        packageManager: {
          type: 'npm',
          testCommand: 'npm test',
          packageInfo: {
            devDependencies,
          },
        },
      };

      const result = builder.build(template, context);

      // Should show first 10
      expect(result).toContain('dev-dep-1@^1.0.0');
      expect(result).toContain('dev-dep-10@^10.0.0');

      // Should indicate there are more
      expect(result).toContain('... and 5 more');

      // Should not show all 15
      expect(result).not.toContain('dev-dep-15@^15.0.0');
    });
  });

  describe('formatConfig (edge cases)', () => {
    // This targets line 97: return fallback ? ... : ''
    it('should return empty string if no config and no fallback', () => {
       // We can trigger this by passing a template that uses a config variable that is undefined in context
       // But wait, the standard template placeholders always have fallbacks in the build() method.
       // We need to use buildWithVariables with type='config' and NO fallback to hit line 97's empty string branch.
       // Or rely on the private method being called with undefined config.

       // Let's use buildWithVariables as it exposes formatConfig somewhat directly
       const variables: TemplateVariable[] = [
         { placeholder: 'MISSING_CONFIG', value: undefined, type: 'config' } // No fallback
       ];
       const template = 'Start|{{MISSING_CONFIG}}|End';
       const result = builder.buildWithVariables(template, variables);
       expect(result).toBe('Start||End');
    });

    // This targets line 101/104 coverage details if needed, but existing tests might cover it.
    // Let's add explicit test for variable fallback on non-string value (line 81)
    it('should use fallback for non-string values with text type', () => {
        // Line 81: const stringValue = typeof value === 'string' ? value : fallback || '';
        // We need value to NOT be a string (maybe undefined or object? types say value can be FrameworkInfo)
        // AND type is NOT 'config' (defaults to 'text')

       const variables: TemplateVariable[] = [
         {
             placeholder: 'WEIRD_VAR',
             value: { name: 'obj' } as unknown as string, // forcing non-string value for text type
             type: 'text',
             fallback: 'fallback-text'
         }
       ];
       const template = 'Val: {{WEIRD_VAR}}';
       const result = builder.buildWithVariables(template, variables);
       expect(result).toBe('Val: fallback-text');
    });
  });
});

