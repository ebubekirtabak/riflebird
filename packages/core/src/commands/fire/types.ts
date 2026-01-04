export type TestType = 'e2e' | 'unit' | 'visual' | 'performance' | 'document';

/**
 * Scope filter for --all mode
 * - 'component': React/Vue components (*.tsx, *.vue, *.jsx)
 * - 'layout': Layout files
 * - 'page': Page/route files
 * - 'service': Service/API files
 * - 'util': Utility/helper files
 * - 'hook': React hooks
 * - 'store': State management files
 */
export type TestScope =
  | 'component'
  | 'layout'
  | 'page'
  | 'service'
  | 'util'
  | 'hook'
  | 'store'
  | 'document';

export type FireInput = {
  testPath?: string;
  all?: boolean;
  testTypes?: TestType[];
  scope?: TestScope;
  onProgress?: (current: number, total: number, file: string, elapsedMs: number) => void;
};

export type FireOutput = {
  success: boolean;
  result?: string;
  error?: string;
};
