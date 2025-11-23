export interface TestFrameworkAdapter {
  name: string;
  
  // Initialize browser/context
  init(config: any): Promise<void>;
  
  // Navigation
  goto(url: string): Promise<void>;
  
  // Actions
  click(selector: string): Promise<void>;
  fill(selector: string, text: string): Promise<void>;
  select(selector: string, value: string): Promise<void>;
  
  // Assertions
  expectVisible(selector: string): Promise<void>;
  expectText(selector: string, text: string): Promise<void>;
  expectURL(pattern: string | RegExp): Promise<void>;
  
  // Screenshot
  screenshot(options?: any): Promise<Buffer>;
  
  // Element finding
  findElement(description: string): Promise<string>;
  
  // Cleanup
  close(): Promise<void>;
  
  // Code generation (framework-specific syntax)
  generateTestCode(testPlan: TestPlan): Promise<string>;
}

export interface TestPlan {
  description: string;
  steps: TestStep[];
  assertions: Assertion[];
}

export interface TestStep {
  type: 'navigate' | 'click' | 'fill' | 'select' | 'wait';
  target?: string;
  value?: string;
  description: string;
}

export interface Assertion {
  type: 'visible' | 'text' | 'url' | 'count';
  target: string;
  expected: any;
}