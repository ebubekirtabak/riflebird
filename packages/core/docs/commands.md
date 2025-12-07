# Command Architecture

Riflebird uses the **Command Pattern** to organize business logic for each CLI command. This provides clear separation of concerns, easier testing, and better maintainability.

## Architecture Overview

```
┌─────────────────┐
│   Riflebird     │ ← Main orchestrator class
│   (Facade)      │
└────────┬────────┘
         │
         ├─ Manages lifecycle (init, config, adapters)
         └─ Delegates to command instances
              │
              ├─ AimCommand    → Generate tests
              ├─ FireCommand   → Execute tests
              ├─ TargetCommand → Find selectors
              └─ ReloadCommand → Heal tests
```

## Benefits

1. **Single Responsibility**: Each command class handles one specific operation
2. **Testability**: Commands can be tested independently with mock contexts
3. **Extensibility**: New commands can be added without modifying existing code
4. **Reusability**: Commands can be used directly or through the Riflebird facade
5. **Type Safety**: Strong typing for inputs and outputs

## Command Structure

### Base Command

All commands extend the abstract `Command` base class:

```typescript
import { Command, type CommandContext } from '@riflebird/core';

export class MyCommand extends Command<InputType, OutputType> {
  async execute(input: InputType): Promise<OutputType> {
    this.validate(input);
    // Command logic here
  }

  protected validate(input: InputType): void {
    // Input validation
  }
}
```

### Command Context

Commands receive a shared context containing:

```typescript
type CommandContext = {
  config: RiflebirdConfig;      // User configuration
  adapter: TestFrameworkAdapter; // Framework adapter (Playwright, Cypress, etc.)
  aiClient: AIClient;            // AI provider client
};
```

## Available Commands

### 1. AimCommand - Generate Tests

Converts natural language descriptions into test code.

**Input:**
```typescript
type AimInput = {
  description: string;
};
```

**Output:**
```typescript
type AimOutput = {
  testCode: string;
  testPlan: TestPlan;
};
```

**Usage:**
```typescript
import { Riflebird } from '@riflebird/core';

const riflebird = new Riflebird();
await riflebird.init();

// Via facade
const testCode = await riflebird.aim('Test login with valid credentials');

// Direct command usage
import { AimCommand } from '@riflebird/core';
const aimCommand = new AimCommand(context);
const result = await aimCommand.execute({
  description: 'Test login with valid credentials'
});
console.log(result.testCode);
console.log(result.testPlan);
```

**Validation:**
- Description cannot be empty
- Description must be at least 10 characters

---

### 2. FireCommand - Execute Tests

Executes tests and analyzes project structure.

**Input:**
```typescript
type FireInput = {
  testPath: string;
};
```

**Output:**
```typescript
type FireOutput = {
  success: boolean;
  result?: string;
  error?: string;
};
```

**Usage:**
```typescript
// Via facade
await riflebird.fire('tests/login.spec.ts');

// Direct command usage
import { FireCommand } from '@riflebird/core';
const fireCommand = new FireCommand(context);
const result = await fireCommand.execute({
  testPath: 'tests/login.spec.ts'
});

if (result.success) {
  console.log('Test passed:', result.result);
} else {
  console.error('Test failed:', result.error);
}
```

**Features:**
- Analyzes project structure (components, file tree)
- Executes tests using the configured adapter
- Provides detailed error messages

**Validation:**
- Test path cannot be empty

---

### 3. TargetCommand - Find Selectors

Uses AI to find the best element selector based on description.

**Input:**
```typescript
type TargetInput = {
  description: string;
};
```

**Output:**
```typescript
type TargetOutput = {
  selector: string;
};
```

**Usage:**
```typescript
// Via facade
const selector = await riflebird.target('The blue login button');

// Direct command usage
import { TargetCommand } from '@riflebird/core';
const targetCommand = new TargetCommand(context);
const result = await targetCommand.execute({
  description: 'The blue login button'
});
console.log(result.selector); // 'button[data-testid="login-btn"]'
```

**Validation:**
- Description cannot be empty
- Description must be at least 5 characters

---

### 4. ReloadCommand - Heal Tests

Automatically fixes broken tests using AI analysis.

**Input:**
```typescript
type ReloadInput = {
  testPath: string;
  errorMessage?: string;
};
```

**Output:**
```typescript
type ReloadOutput = {
  fixedTestCode: string;
  changes: string[];
};
```

**Usage:**
```typescript
// Via facade
const fixedCode = await riflebird.reload('tests/login.spec.ts');

// Direct command usage
import { ReloadCommand } from '@riflebird/core';
const reloadCommand = new ReloadCommand(context);
const result = await reloadCommand.execute({
  testPath: 'tests/login.spec.ts',
  errorMessage: 'Selector not found: button#submit'
});
console.log(result.fixedTestCode);
console.log('Changes:', result.changes);
```

**Status:** 🚧 Not yet implemented

**Validation:**
- Test path cannot be empty

---

## Creating Custom Commands

You can create custom commands by extending the `Command` base class:

```typescript
import { Command, type CommandContext } from '@riflebird/core';

// Define input/output types
export type AnalyzeInput = {
  filePath: string;
  depth?: number;
};

export type AnalyzeOutput = {
  complexity: number;
  issues: string[];
};

// Implement command
export class AnalyzeCommand extends Command<AnalyzeInput, AnalyzeOutput> {
  constructor(context: CommandContext) {
    super(context);
  }

  async execute(input: AnalyzeInput): Promise<AnalyzeOutput> {
    // Validate input
    this.validate(input);

    // Access context
    const { config, adapter, aiClient } = this.context;

    // Use AI client
    const analysis = await aiClient.createChatCompletion({
      model: config.ai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a code analysis expert.',
        },
        {
          role: 'user',
          content: `Analyze file: ${input.filePath}`,
        },
      ],
    });

    // Return structured output
    return {
      complexity: 5,
      issues: ['Missing error handling'],
    };
  }

  protected validate(input: AnalyzeInput): void {
    if (!input.filePath) {
      throw new Error('File path is required');
    }
  }
}
```

## Testing Commands

Commands are easy to test in isolation:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AimCommand } from '@riflebird/core';

describe('AimCommand', () => {
  it('should generate test code', async () => {
    // Mock context
    const mockContext = {
      config: { ai: { model: 'gpt-4', temperature: 0.2 }, framework: 'playwright' },
      adapter: {
        generateTestCode: vi.fn().mockResolvedValue('test code'),
      },
      aiClient: {
        createChatCompletion: vi.fn().mockResolvedValue({ content: 'response' }),
      },
    };

    const command = new AimCommand(mockContext);
    const result = await command.execute({
      description: 'Test login functionality',
    });

    expect(result.testCode).toBe('test code');
    expect(mockContext.adapter.generateTestCode).toHaveBeenCalled();
  });

  it('should validate input', async () => {
    const command = new AimCommand(mockContext);
    
    await expect(
      command.execute({ description: '' })
    ).rejects.toThrow('Test description cannot be empty');
  });
});
```

## Best Practices

1. **Keep commands focused**: One command = one responsibility
2. **Validate inputs**: Use the `validate()` method for input validation
3. **Use strong types**: Define clear input/output types for each command
4. **Handle errors gracefully**: Wrap AI calls in try-catch blocks
5. **Document behavior**: Add JSDoc comments explaining what the command does
6. **Test independently**: Write unit tests for commands using mock contexts

## Migration from Old Structure

**Before (Riflebird methods):**
```typescript
class Riflebird {
  async aim(description: string): Promise<string> {
    const testPlan = await this.generateTestPlan(description);
    return await this.adapter.generateTestCode(testPlan);
  }
}
```

**After (Command classes):**
```typescript
class Riflebird {
  private aimCommand: AimCommand;
  
  async aim(description: string): Promise<string> {
    const result = await this.aimCommand.execute({ description });
    return result.testCode;
  }
}
```

The Riflebird class now acts as a **facade**, providing a simple API while delegating to specialized command objects.
