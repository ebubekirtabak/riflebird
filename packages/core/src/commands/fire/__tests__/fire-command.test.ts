import { describe, it, expect, vi } from 'vitest';
import { FireCommand } from '../../fire-command';
import { CommandContext } from '../../base';

vi.mock('../document-handler', () => ({
  DocumentHandler: vi.fn(),
}));

vi.mock('../unit-test-writer', () => ({
  UnitTestWriter: vi.fn(),
}));

vi.mock('@utils', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  findProjectRoot: vi.fn(),
  findFilesByPatternInFileTree: vi.fn(),
}));

describe('FireCommand', () => {
  const mockContext = {} as CommandContext;

  it('should be instantiable', () => {
    const fireCommand = new FireCommand(mockContext);
    expect(fireCommand).toBeInstanceOf(FireCommand);
  });
});
