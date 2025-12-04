import { Command, type CommandContext } from './base';
import type { TestPlan } from '../adapters/base';

export type AimInput = {
  description: string;
};

export type AimOutput = {
  testCode: string;
  testPlan: TestPlan;
};

/**
 * Aim command - Generate test code from natural language description
 * 
 * Example:
 * ```ts
 * const result = await aimCommand.execute({
 *   description: 'Test login functionality with valid credentials'
 * });
 * console.log(result.testCode);
 * ```
 */
export class AimCommand extends Command<AimInput, AimOutput> {
  constructor(context: CommandContext) {
    super(context);
  }

  async execute(input: AimInput): Promise<AimOutput> {
    this.validate(input);

    // Generate test plan with AI
    const testPlan = await this.generateTestPlan(input.description);

    // Convert to framework-specific code
    const testCode = await this.context.adapter.generateTestCode(testPlan);

    return {
      testCode,
      testPlan,
    };
  }

  protected validate(input: AimInput): void {
    if (!input.description || input.description.trim().length === 0) {
      throw new Error('Test description cannot be empty');
    }

    if (input.description.length < 10) {
      throw new Error('Test description must be at least 10 characters long');
    }
  }

  private async generateTestPlan(description: string): Promise<TestPlan> {
    try {
      await this.context.aiClient.createChatCompletion({
        model: this.context.config.ai.model,
        temperature: this.context.config.ai.temperature,
        messages: [
          {
            role: 'system',
            content: `You are a test planning expert for ${this.context.config.framework}. Generate a structured test plan from the description.`,
          },
          {
            role: 'user',
            content: `Create a test plan for: ${description}`,
          },
        ],
      });
    } catch (err) {
      // Surface provider errors with context
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AI provider error while generating test plan: ${message}`);
    }

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
