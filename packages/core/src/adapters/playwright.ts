// packages/core/src/adapters/playwright.ts
import { chromium, Browser, Page, PageScreenshotOptions } from 'playwright';
import { TestFrameworkAdapter, TestPlan } from './base';
import { RiflebirdConfig } from '../config/schema';

export class PlaywrightAdapter implements TestFrameworkAdapter {
  name = 'playwright';
  private browser?: Browser;
  private page?: Page;
  private config: RiflebirdConfig['e2e'];

  constructor(config: RiflebirdConfig) {
    this.config = config.e2e;
  }

  async init() {
    this.browser = await chromium.launch({
      headless: this.config?.playwright?.headless ?? false,
    });

    const context = await this.browser.newContext({
      viewport: this.config?.playwright?.viewport,
    });

    this.page = await context.newPage();

    if (this.config?.playwright?.baseURL) {
      this.page.setDefaultTimeout(this.config?.playwright?.timeout ?? 30000);
    }
  }

  async goto(url: string) {
    await this.page!.goto(url);
  }

  async click(selector: string) {
    await this.page!.click(selector);
  }

  async fill(selector: string, text: string) {
    await this.page!.fill(selector, text);
  }

  async select(selector: string, value: string) {
    await this.page!.selectOption(selector, value);
  }

  async expectVisible(selector: string) {
    await this.page!.locator(selector).waitFor({ state: 'visible' });
  }

  async expectText(selector: string, text: string) {
    const element = this.page!.locator(selector);
    await element.waitFor();
    const actualText = await element.textContent();
    if (!actualText?.includes(text)) {
      throw new Error(`Expected text "${text}" not found`);
    }
  }

  async expectURL(pattern: string | RegExp) {
    await this.page!.waitForURL(pattern);
  }

  async screenshot(options?: PageScreenshotOptions): Promise<Buffer> {
    return await this.page!.screenshot(options);
  }

  async findElement(_description: string): Promise<string> {
    // AI-powered element finding
    // (integrate with GPT-4 Vision)
    return 'button:has-text("Login")'; // placeholder
  }

  async close() {
    await this.browser?.close();
  }

  async generateTestCode(testPlan: TestPlan): Promise<string> {
    const imports = `import { test, expect } from '@playwright/test';\n\n`;

    const testBody = `test('${testPlan.description}', async ({ page }) => {\n`;

    const steps = testPlan.steps
      .map((step) => {
        switch (step.type) {
          case 'navigate':
            return `  await page.goto('${step.target}');`;
          case 'click':
            return `  await page.click('${step.target}');`;
          case 'fill':
            return `  await page.fill('${step.target}', '${step.value}');`;
          case 'select':
            return `  await page.selectOption('${step.target}', '${step.value}');`;
          default:
            return `  // ${step.description}`;
        }
      })
      .join('\n');

    const assertions = testPlan.assertions
      .map((assertion) => {
        switch (assertion.type) {
          case 'visible':
            return `  await expect(page.locator('${assertion.target}')).toBeVisible();`;
          case 'text':
            return `  await expect(page.locator('${assertion.target}')).toHaveText('${assertion.expected}');`;
          case 'url':
            return `  await expect(page).toHaveURL(/${assertion.expected}/);`;
          default:
            return '';
        }
      })
      .join('\n');

    return `${imports}${testBody}${steps}\n\n${assertions}\n});`;
  }
}
