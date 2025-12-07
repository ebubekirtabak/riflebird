export type ScreenshotOptions = {
  path?: string;
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
};

export type TestFrameworkAdapter = {
  name: string;
  
  // Initialize browser/context
  init(config: unknown): Promise<void>;
  
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
  screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  
  // Element finding
  findElement(description: string): Promise<string>;
  
  // Cleanup
  close(): Promise<void>;
  
  generateTestCode(testPlan: TestPlan): Promise<string>;
};

export type TestPlan = {
  description: string;
  steps: TestStep[];
  assertions: Assertion[];
};

export type TestStep = {
  type: 'navigate' | 'click' | 'fill' | 'select' | 'wait';
  target?: string;
  value?: string;
  description: string;
};

export type Assertion = {
  type: 'visible' | 'text' | 'url' | 'count';
  target: string;
  expected: string | number | boolean;
};