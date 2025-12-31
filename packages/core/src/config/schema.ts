import { z } from 'zod';
import {
  DEFAULT_FILE_EXCLUDE_PATTERNS,
  DEFAULT_COVERAGE_INCLUDE,
  DEFAULT_UNIT_TEST_PATTERNS,
} from './constants';

export const AIProviderSchema = z.enum([
  'openai',
  'anthropic',
  'gemini-cli',
  'local',
  'copilot-cli',
  'other',
]);

export const FrameworkSchema = z.enum(['playwright', 'cypress', 'puppeteer', 'webdriverio']);

export const UnitTestFrameworkSchema = z.enum(['vitest', 'jest', 'mocha', 'ava']);

export const CoverageProviderSchema = z.enum(['v8', 'istanbul']);

export const CoverageReporterSchema = z.enum(['text', 'html', 'json', 'lcov']);

export const TestEnvironmentSchema = z.enum(['node', 'jsdom', 'happy-dom']);

export const DocumentationFrameworkSchema = z.enum(['storybook']);

export const DocumentationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  framework: DocumentationFrameworkSchema.optional(),
  documentationOutputDir: z.string().optional().default('./stories/'),
  setupFiles: z.array(z.string()).default([]),
  documentationMatch: z.array(z.string()).default(['src/**/*.stories.{ts,tsx,js,jsx,vue}']),
});

// Base AI Config shared by all providers
export const BaseAIConfig = z.object({
  model: z.string({ required_error: 'Model name is required' }).min(1, 'Model name is required'),
  temperature: z.number().min(0).max(2).default(0.2),
});

// OpenAI Config
export const OpenAIConfig = BaseAIConfig.extend({
  provider: z.literal('openai'),
  apiKey: z.string().optional(),
}).superRefine(({ apiKey }, ctx) => {
  if (!apiKey || apiKey.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'OpenAI API key is required. Set it in config or OPENAI_API_KEY environment variable.',
      path: ['apiKey'],
    });
  } else if (!apiKey.startsWith('sk-')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OpenAI API key must start with "sk-".',
      path: ['apiKey'],
    });
  }
});

// Anthropic Config
export const AnthropicConfig = BaseAIConfig.extend({
  provider: z.literal('anthropic'),
  apiKey: z.string().optional(),
}).superRefine(({ apiKey }, ctx) => {
  if (!apiKey || apiKey.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Anthropic API key is required. Set it in config or ANTHROPIC_API_KEY environment variable.',
      path: ['apiKey'],
    });
  }
});

// Gemini CLI Config
export const GeminiCliConfig = BaseAIConfig.extend({
  provider: z.literal('gemini-cli'),
});

// Local Config
export const LocalConfig = BaseAIConfig.extend({
  provider: z.literal('local'),
  url: z
    .string({
      required_error:
        'URL is required for local AI provider (e.g., http://localhost:11434 for Ollama).',
    })
    .url('Invalid URL format'),
}).superRefine((data, ctx) => {
  try {
    const url = new URL(data.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Local AI provider URL must use http:// or https:// protocol',
        path: ['url'],
      });
    }
  } catch {
    // z.string().url() already handles format, but just in case
  }
});

// Other Config
export const OtherConfig = BaseAIConfig.extend({
  provider: z.literal('other'),
  apiKey: z
    .string({ required_error: 'API key is required for other AI providers.' })
    .min(1, 'API key is required for other AI providers.'),
  url: z
    .string({ required_error: 'URL is required for other AI providers.' })
    .url('Invalid URL format'),
}).superRefine((data, ctx) => {
  try {
    const url = new URL(data.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Other AI provider URL must use http:// or https:// protocol',
        path: ['url'],
      });
    }
  } catch {
    /* handled by z.url() */
  }
});

// Copilot CLI Config
export const CopilotCliConfig = BaseAIConfig.extend({
  provider: z.literal('copilot-cli'),
  copilotCli: z
    .object({
      args: z.array(z.string()).default([]),
    })
    .optional(),
});

// Use z.union instead of discriminatedUnion to allow superRefine (which creates ZodEffects)
export const AIConfigSchema = z.union([
  OpenAIConfig,
  AnthropicConfig,
  LocalConfig,
  OtherConfig,
  CopilotCliConfig,
  GeminiCliConfig,
]);

export const RiflebirdConfigSchema = z.object({
  // AI Configuration
  ai: AIConfigSchema,
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
      /** Directory where generated unit test files will be written */
      testOutputDir: z.string().default('./__tests__/'),
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
          exclude: z.array(z.string()).default([...DEFAULT_FILE_EXCLUDE_PATTERNS]),
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

  documentation: DocumentationConfigSchema.optional(),
});

export type RiflebirdConfig = z.infer<typeof RiflebirdConfigSchema>;
