import { loadConfig } from './config/loader';
import type { RiflebirdConfig } from './config/schema';
import type { TestFrameworkAdapter } from './adapters/base';
import { PlaywrightAdapter } from './adapters/playwright';
import { CypressAdapter } from './adapters/cypress';
import type OpenAI from 'openai';
import { createAIClient, type AIClient } from './helpers/ai-client';
import {
  AimCommand,
  FireCommand,
  TargetCommand,
  ReloadCommand,
  type CommandContext,
} from './commands';

export class Riflebird {
  private config!: RiflebirdConfig;
  private adapter!: TestFrameworkAdapter;
  private aiClient!: AIClient;
  private _openaiInstance?: OpenAI;

  // Command instances
  private aimCommand!: AimCommand;
  private fireCommand!: FireCommand;
  private targetCommand!: TargetCommand;
  private reloadCommand!: ReloadCommand;

  constructor(_configPath?: string) {
    // Config loaded during init
  }

  async init(configPath?: string) {
    this.config = await loadConfig(configPath);

    // Initialize AI client using helper
    const { client, openaiInstance } = await createAIClient(this.config.ai);
    this.aiClient = client;
    this._openaiInstance = openaiInstance;

    this.adapter = this.createAdapter();

    await this.adapter.init(this.config);

    // Initialize commands with shared context
    const context: CommandContext = {
      config: this.config,
      adapter: this.adapter,
      aiClient: this.aiClient,
    };

    this.aimCommand = new AimCommand(context);
    this.fireCommand = new FireCommand(context);
    this.targetCommand = new TargetCommand(context);
    this.reloadCommand = new ReloadCommand(context);
  }

  private createAdapter(): TestFrameworkAdapter {
    const framework = this.config.e2e?.framework;
    if (!framework) {
      throw new Error('E2E framework not configured');
    }

    switch (framework) {
      case 'playwright':
        return new PlaywrightAdapter(this.config);
      case 'cypress':
        return new CypressAdapter(this.config);
      case 'puppeteer':
        throw new Error('Puppeteer adapter not implemented yet');
      case 'webdriverio':
        throw new Error('WebDriverIO adapter not implemented yet');
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }
  }

  /**
   * Generate test code from natural language description
   */
  async aim(description: string): Promise<string> {
    const result = await this.aimCommand.execute({ description });
    return result.testCode;
  }

  /**
   * Execute tests and analyze project structure
   */
  async fire(testPath: string): Promise<void> {
    await this.fireCommand.execute({ testPath });
  }

  async watch(): Promise<void> {
    throw new Error('Watch mode not yet implemented');
  }

  /**
   * Find element selector using AI
   */
  async target(description: string): Promise<string> {
    const result = await this.targetCommand.execute({ description });
    return result.selector;
  }

  /**
   * Heal broken tests using AI
   */
  async reload(testPath: string): Promise<string> {
    const result = await this.reloadCommand.execute({ testPath });
    return result.fixedTestCode;
  }
}
