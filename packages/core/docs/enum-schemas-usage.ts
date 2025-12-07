// Example: Using exported enum schemas from @riflebird/core
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  AIProviderSchema,
  FrameworkSchema,
  UnitTestFrameworkSchema,
  CoverageProviderSchema,
  CoverageReporterSchema,
  TestEnvironmentSchema,
} from '@riflebird/core';

// ✅ You can now use these schemas to:

// 1. Validate values
const isValidFramework = FrameworkSchema.safeParse('playwright'); // { success: true, data: 'playwright' }
const isInvalidFramework = FrameworkSchema.safeParse('invalid'); // { success: false, error: ... }

// 2. Get all valid options
const allFrameworks = FrameworkSchema.options; // ['playwright', 'cypress', 'puppeteer', 'webdriverio']
const allUnitTestFrameworks = UnitTestFrameworkSchema.options; // ['vitest', 'jest', 'mocha', 'ava']
const allAIProviders = AIProviderSchema.options; // ['openai', 'anthropic', 'local']

// 3. Type inference
type Framework = z.infer<typeof FrameworkSchema>; // 'playwright' | 'cypress' | 'puppeteer' | 'webdriverio'
type UnitTestFramework = z.infer<typeof UnitTestFrameworkSchema>; // 'vitest' | 'jest' | 'mocha' | 'ava'
type AIProvider = z.infer<typeof AIProviderSchema>; // 'openai' | 'anthropic' | 'local'

// 4. Use in your own validation schemas
import { z } from 'zod';

const MyConfigSchema = z.object({
  e2eFramework: FrameworkSchema,
  unitFramework: UnitTestFrameworkSchema,
  aiProvider: AIProviderSchema,
});

export { allFrameworks, allUnitTestFrameworks, allAIProviders };
