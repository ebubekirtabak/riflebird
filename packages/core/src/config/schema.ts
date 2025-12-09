import { z } from 'zod';

export const AIProviderSchema = z.enum(['openai', 'anthropic', 'local', 'copilot-cli']);

export const FrameworkSchema = z.enum([
  'playwright',
  'cypress',
  'puppeteer',
  'webdriverio',
]);

export const UnitTestFrameworkSchema = z.enum(['vitest', 'jest', 'mocha', 'ava']);

export const CoverageProviderSchema = z.enum(['v8', 'istanbul']);

export const CoverageReporterSchema = z.enum(['text', 'html', 'json', 'lcov']);

export const TestEnvironmentSchema = z.enum(['node', 'jsdom', 'happy-dom']);

// Test file patterns
export const DEFAULT_UNIT_TEST_PATTERNS = ['**/*.test.ts', '**/*.spec.ts'] as const;
export const DEFAULT_E2E_TEST_PATTERNS = ['**/*.e2e.ts', '**/*.e2e-spec.ts'] as const;

// Coverage patterns
export const DEFAULT_COVERAGE_INCLUDE = ['src/**/*.ts', 'src/**/*.tsx'] as const;
export const DEFAULT_COVERAGE_EXCLUDE = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.e2e.ts',
  '**/*.e2e-spec.ts',
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/__tests__/**',
  '**/__mocks__/**',
] as const;

export const RiflebirdConfigSchema = z.object({
  // AI Configuration
  ai: z.object({
    provider: AIProviderSchema,
    apiKey: z.string().optional(),
    model: z.string().default('gpt-4o-mini'),
    url: z.string().url().optional(),
    temperature: z.number().min(0).max(2).default(0.2),
    copilotCli: z
      .object({
        args: z.array(z.string()).default([]),
      })
      .optional(),
  }),
  e2e: z
    .object({
      framework: FrameworkSchema,
      playwright: z
        .object({
          browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
          headless: z.boolean().default(false),
          viewport: z
            .object({
              width: z.number().default(1280),
              height: z.number().default(720),
            })
            .optional(),
          baseURL: z.string().url().optional(),
          timeout: z.number().default(30000),
        })
        .optional(),

      cypress: z
        .object({
          baseUrl: z.string().url().optional(),
          viewportWidth: z.number().default(1280),
          viewportHeight: z.number().default(720),
          video: z.boolean().default(false),
          screenshotOnRunFailure: z.boolean().default(true),
        })
        .optional(),

      puppeteer: z
        .object({
          headless: z.boolean().default(false),
          defaultViewport: z
            .object({
              width: z.number().default(1280),
              height: z.number().default(720),
            })
            .optional(),
          args: z.array(z.string()).default([]),
        })
        .optional(),

      webdriverio: z
        .object({
          baseUrl: z.string().url().optional(),
          capabilities: z.object({}).passthrough().optional(),
        })
        .optional(),
    })
    .optional(),

  // Test Generation
  generation: z
    .object({
      outputDir: z.string().default('tests/e2e'),
      naming: z.enum(['kebab-case', 'camelCase', 'PascalCase']).default('kebab-case'),
      language: z.enum(['typescript', 'javascript']).default('typescript'),
      includeComments: z.boolean().default(true),
      includeAssertions: z.boolean().default(true),
    })
    .optional(),

  healing: z
    .object({
      enabled: z.boolean().default(true),
      mode: z.enum(['auto', 'manual', 'off']).default('auto'),
      maxRetries: z.number().default(3),
      strategy: z.enum(['smart', 'visual', 'text', 'hybrid']).default('smart'),
    })
    .optional(),

  visual: z
    .object({
      enabled: z.boolean().default(true),
      threshold: z.number().min(0).max(1).default(0.1),
      ignoreRegions: z.array(z.object({})).default([]),
      updateBaselines: z.boolean().default(false),
    })
    .optional(),

  selectors: z
    .object({
      strategy: z.enum(['smart', 'css', 'xpath', 'text', 'aria']).default('smart'),
      fallback: z.array(z.string()).default(['text', 'aria', 'css']),
      timeout: z.number().default(5000),
    })
    .optional(),

  reporting: z
    .object({
      format: z.array(z.enum(['html', 'json', 'junit', 'allure'])).default(['html']),
      outputDir: z.string().default('test-results'),
      screenshots: z.enum(['always', 'on-failure', 'off']).default('on-failure'),
      video: z.enum(['always', 'on-failure', 'off']).default('on-failure'),
      aiSummary: z.boolean().default(true),
    })
    .optional(),

  ci: z
    .object({
      enabled: z.boolean().default(false),
      parallel: z.number().default(1),
      retries: z.number().default(0),
      failFast: z.boolean().default(false),
    })
    .optional(),

  unitTesting: z
    .object({
      enabled: z.boolean().default(false),
      framework: UnitTestFrameworkSchema.default('vitest'),
      testDir: z.string().default('tests/unit'),
      testMatch: z.array(z.string()).default([...DEFAULT_UNIT_TEST_PATTERNS]),
      coverage: z
        .object({
          enabled: z.boolean().default(true),
          provider: CoverageProviderSchema.default('v8'),
          threshold: z
            .object({
              lines: z.number().min(0).max(100).default(80),
              functions: z.number().min(0).max(100).default(80),
              branches: z.number().min(0).max(100).default(80),
              statements: z.number().min(0).max(100).default(80),
            })
            .optional(),
          include: z.array(z.string()).default([...DEFAULT_COVERAGE_INCLUDE]),
          exclude: z.array(z.string()).default([...DEFAULT_COVERAGE_EXCLUDE]),
          reporter: z.array(CoverageReporterSchema).default(['text', 'html']),
        })
        .optional(),
      watch: z.boolean().default(false),
      globals: z.boolean().default(true),
      environment: TestEnvironmentSchema.default('node'),
      setupFiles: z.array(z.string()).default([]),
      mockReset: z.boolean().default(true),
      restoreMocks: z.boolean().default(true),
      clearMocks: z.boolean().default(true),
      timeout: z.number().default(5000),
    })
    .optional(),
});

export type RiflebirdConfig = z.infer<typeof RiflebirdConfigSchema>;
