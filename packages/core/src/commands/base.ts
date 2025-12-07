import type { RiflebirdConfig } from '@config/schema';
import type { TestFrameworkAdapter } from '@adapters/base';
import type { AIClient } from '@models/ai-client';

/**
 * Base context provided to all commands
 */
export type CommandContext = {
  config: RiflebirdConfig;
  adapter: TestFrameworkAdapter;
  aiClient: AIClient;
};

/**
 * Base class for all Riflebird commands
 */
export abstract class Command<TInput = unknown, TOutput = unknown> {
  constructor(protected context: CommandContext) {}

  /**
   * Execute the command
   */
  abstract execute(input: TInput): Promise<TOutput>;

  /**
   * Validate command input before execution
   */
  protected validate(_input: TInput): void {
    // Override in subclasses for validation
  }
}
