import { describe, it, expect } from 'vitest';
import { RiflebirdConfigSchema } from '../schema';
import type { RiflebirdConfig } from '../schema';

describe('config/schema', () => {
  describe('RiflebirdConfigSchema', () => {
    it('should validate minimal config', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        e2e: {
          framework: 'playwright' as const,
        },
      };

      const result = RiflebirdConfigSchema.parse(config);

      expect(result.ai.provider).toBe('openai');
      expect(result.e2e?.framework).toBe('playwright');
    });

    it('should apply default values for optional fields', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        e2e: {
          framework: 'playwright' as const,
        },
      };

      const result = RiflebirdConfigSchema.parse(config);

      expect(result.ai.temperature).toBe(0.2);
      expect(result.ai.model).toBe('gpt-4');
    });

    it('should validate unit testing configuration', () => {
      const config: RiflebirdConfig = {
        ai: {
          provider: 'openai',
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        e2e: {
          framework: 'playwright',
        },
        unitTesting: {
          enabled: true,
          framework: 'vitest',
          testOutputDir: 'tests/unit',
          testMatch: ['**/*.test.ts'],
          coverage: {
            enabled: true,
            provider: 'v8',
            threshold: {
              lines: 90,
              functions: 85,
              branches: 80,
              statements: 90,
            },
            include: ['src/**/*.ts'],
            exclude: ['**/*.test.ts', '**/*.spec.ts'],
            reporter: ['text', 'html', 'lcov'],
          },
          watch: false,
          globals: true,
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
          mockReset: true,
          restoreMocks: true,
          clearMocks: true,
          timeout: 10000,
        },
      };

      const result = RiflebirdConfigSchema.parse(config);

      expect(result.unitTesting?.enabled).toBe(true);
      expect(result.unitTesting?.framework).toBe('vitest');
      expect(result.unitTesting?.testOutputDir).toBe('tests/unit');
      expect(result.unitTesting?.coverage?.enabled).toBe(true);
      expect(result.unitTesting?.coverage?.threshold?.lines).toBe(90);
      expect(result.unitTesting?.environment).toBe('node');
    });

    it('should apply default values for unit testing config', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        e2e: {
          framework: 'playwright' as const,
        },
        unitTesting: {
          enabled: true,
        },
      };

      const result = RiflebirdConfigSchema.parse(config);

      expect(result.unitTesting?.framework).toBe('vitest');
      expect(result.unitTesting?.testOutputDir).toBe('./__tests__/');
      expect(result.unitTesting?.testMatch).toEqual(['**/*.test.ts', '**/*.spec.ts']);
      expect(result.unitTesting?.globals).toBe(true);
      expect(result.unitTesting?.environment).toBe('node');
      expect(result.unitTesting?.timeout).toBe(5000);
    });

    it('should validate coverage thresholds are between 0 and 100', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        e2e: {
          framework: 'playwright' as const,
        },
        unitTesting: {
          enabled: true,
          coverage: {
            enabled: true,
            provider: 'v8' as const,
            threshold: {
              lines: 150, // Invalid: > 100
              functions: 80,
              branches: 80,
              statements: 80,
            },
          },
        },
      };

      expect(() => RiflebirdConfigSchema.parse(config)).toThrow();
    });

    it('should accept all supported test frameworks', () => {
      const frameworks = ['vitest', 'jest', 'mocha', 'ava'] as const;

      frameworks.forEach((framework) => {
        const config = {
          ai: {
            provider: 'openai' as const,
            apiKey: 'sk-mock-key',
            model: 'gpt-4',
            temperature: 0.2,
          },
          framework: 'playwright' as const,
          unitTesting: {
            enabled: true,
            framework,
          },
        };

        const result = RiflebirdConfigSchema.parse(config);
        expect(result.unitTesting?.framework).toBe(framework);
      });
    });

    it('should accept all supported test environments', () => {
      const environments = ['node', 'jsdom', 'happy-dom'] as const;

      environments.forEach((environment) => {
        const config = {
          ai: {
            provider: 'openai' as const,
            apiKey: 'sk-mock-key',
            model: 'gpt-4',
            temperature: 0.2,
          },
          framework: 'playwright' as const,
          unitTesting: {
            enabled: true,
            environment,
          },
        };

        const result = RiflebirdConfigSchema.parse(config);
        expect(result.unitTesting?.environment).toBe(environment);
      });
    });

    it('should validate generation config with all options', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        e2e: {
          framework: 'playwright' as const,
        },
        generation: {
          outputDir: 'e2e/tests',
          naming: 'camelCase' as const,
          language: 'javascript' as const,
          includeComments: false,
          includeAssertions: true,
        },
      };

      const result = RiflebirdConfigSchema.parse(config);

      expect(result.generation?.outputDir).toBe('e2e/tests');
      expect(result.generation?.naming).toBe('camelCase');
      expect(result.generation?.language).toBe('javascript');
    });

    it('should validate documentation config', () => {
      const config = {
        ai: {
          provider: 'openai' as const,
          apiKey: 'sk-mock-key',
          model: 'gpt-4',
          temperature: 0.2,
        },
        documentation: {
          enabled: true,
          documentationOutputDir: 'docs/stories',
          documentationMatch: ['src/**/*.doc.tsx'],
        },
      };

      const result = RiflebirdConfigSchema.parse(config);

      expect(result.documentation?.enabled).toBe(true);
      expect(result.documentation?.documentationOutputDir).toBe('docs/stories');
      expect(result.documentation?.documentationMatch).toEqual(['src/**/*.doc.tsx']);
    });
  });
});
