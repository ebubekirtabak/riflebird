import { Command, type CommandContext } from './base';

export type TargetInput = {
  description: string;
};

export type TargetOutput = {
  selector: string;
};

/**
 * Target command - Find element selector using AI
 * 
 * Example:
 * ```ts
 * const result = await targetCommand.execute({
 *   description: 'The login button with blue background'
 * });
 * console.log(result.selector); // 'button[data-testid="login-btn"]'
 * ```
 */
export class TargetCommand extends Command<TargetInput, TargetOutput> {
  constructor(context: CommandContext) {
    super(context);
  }

  async execute(input: TargetInput): Promise<TargetOutput> {
    this.validate(input);

    // AI finds best selector
    const selector = await this.context.adapter.findElement(input.description);

    return {
      selector,
    };
  }

  protected validate(input: TargetInput): void {
    if (!input.description || input.description.trim().length === 0) {
      throw new Error('Element description cannot be empty');
    }

    if (input.description.length < 5) {
      throw new Error('Element description must be at least 5 characters long');
    }
  }
}
