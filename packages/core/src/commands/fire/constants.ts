import type { TestType, TestScope } from '../fire-command';

export const SUPPORTED_TEST_TYPES: TestType[] = ['unit'];

export const ALL_TEST_TYPES: TestType[] = ['unit', 'e2e', 'visual', 'performance'];

export const SUPPORTED_TEST_SCOPES: TestScope[] = ['component', 'layout', 'page', 'service', 'util', 'hook', 'store'];
