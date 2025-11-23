import { loadConfig } from './config/loader';
import { RiflebirdConfig } from './config/schema';
import { TestFrameworkAdapter, TestPlan } from './adapters/base';
import { PlaywrightAdapter } from './adapters/playwright';
import { CypressAdapter } from './adapters/cypress';
import OpenAI from 'openai';

export class Riflebird {
  private config!: RiflebirdConfig;
  private adapter!: TestFrameworkAdapter;
  private ai!: OpenAI;

  constructor(_configPath?: string) {
    // Config loaded during init
  }

  async init(configPath?: string) {
    // Load config
    this.config = await loadConfig(configPath);

    // Initialize AI
    this.ai = new OpenAI({ apiKey: this.config.ai.apiKey });

    // Select adapter based on config
    this.adapter = this.createAdapter();

    await this.adapter.init(this.config);
  }

  private createAdapter(): TestFrameworkAdapter {
    switch (this.config.framework) {
      case 'playwright':
        return new PlaywrightAdapter(this.config);
      case 'cypress':
        return new CypressAdapter(this.config);
      case 'puppeteer':
        // return new PuppeteerAdapter(this.config);
        throw new Error('Puppeteer adapter not implemented yet');
      case 'webdriverio':
        // return new WebDriverIOAdapter(this.config);
        throw new Error('WebDriverIO adapter not implemented yet');
      default:
        throw new Error(`Unknown framework: ${this.config.framework}`);
    }
  }

  async aim(description: string): Promise<string> {
    // Generate test plan with AI
    const testPlan = await this.generateTestPlan(description);

    // Convert to framework-specific code
    const testCode = await this.adapter.generateTestCode(testPlan);

    return testCode;
  }

  async fire(_testPath: string): Promise<void> {
    // Execute test (framework-specific)
    // For Playwright: actually run
    // For Cypress: generate command to run
    throw new Error('fire method not yet implemented');
  }

  async target(description: string): Promise<string> {
    // AI finds best selector
    return await this.adapter.findElement(description);
  }

  async reload(_testPath: string): Promise<string> {
    // AI heals broken test
    // ... healing logic
    throw new Error('reload method not yet implemented');
  }

  private async generateTestPlan(description: string): Promise<TestPlan> {
    await this.ai.chat.completions.create({
      model: this.config.ai.model,
      temperature: this.config.ai.temperature,
      messages: [
        {
          role: 'system',
          content: `You are a test planning expert for ${this.config.framework}. Generate a structured test plan from the description.`,
        },
        {
          role: 'user',
          content: `Create a test plan for: ${description}`,
        },
      ],
    });

    // Parse AI response into TestPlan
    // For now, return a placeholder
    const testPlan: TestPlan = {
      description,
      steps: [],
      assertions: [],
    };

    return testPlan;
  }
}