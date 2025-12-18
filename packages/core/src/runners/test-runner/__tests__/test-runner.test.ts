import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractRenderedHTML, stripAnsiCodes, runTest, getReporterArgsByFramework, parseTestCommand } from '../index';
import type { TestRunResult, TestRunnerFramework } from '../index';
import { spawn } from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { setEncoding: vi.fn(), on: vi.fn() },
    stderr: { setEncoding: vi.fn(), on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  })),
}));

vi.mock('node:events', () => ({
  once: vi.fn().mockResolvedValue([0, null]),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@utils', () => ({
  ProjectFileWalker: vi.fn().mockImplementation(() => ({
    readFileFromProject: vi.fn().mockResolvedValue('{}'),
  })),
}));

describe('stripAnsiCodes', () => {
  it('should remove ANSI color codes', () => {
    const input = '\x1b[31mError:\x1b[0m Test failed';
    const expected = 'Error: Test failed';
    expect(stripAnsiCodes(input)).toBe(expected);
  });

  it('should remove complex ANSI sequences', () => {
    const input = 'FAIL \x1b[22m\x1b[49m \x1b[30m\x1b[42m unit \x1b[49m\x1b[39m test.tsx\x1b[2m > \x1b[22mshould work';
    const expected = 'FAIL   unit  test.tsx > should work';
    expect(stripAnsiCodes(input)).toBe(expected);
  });

  it('should handle strings without ANSI codes', () => {
    const input = 'Plain text without any codes';
    expect(stripAnsiCodes(input)).toBe(input);
  });

  it('should handle empty strings', () => {
    expect(stripAnsiCodes('')).toBe('');
  });

  it('should remove multiple ANSI codes in same string', () => {
    const input = '\x1b[31mRed\x1b[0m and \x1b[32mGreen\x1b[0m and \x1b[34mBlue\x1b[0m';
    const expected = 'Red and Green and Blue';
    expect(stripAnsiCodes(input)).toBe(expected);
  });
});

describe('parseTestCommand', () => {
  it('should parse npm command and add separator', () => {
    const { command, args } = parseTestCommand('npm test');
    expect(command).toBe('npm');
    expect(args).toEqual(['test', '--']);
  });

  it('should parse pnpm command without separator', () => {
    const { command, args } = parseTestCommand('pnpm run test');
    expect(command).toBe('pnpm');
    expect(args).toEqual(['run', 'test']);
  });

  it('should parse yarn command without separator', () => {
    const { command, args } = parseTestCommand('yarn test');
    expect(command).toBe('yarn');
    expect(args).toEqual(['test']);
  });

  it('should parse single word command', () => {
    const { command, args } = parseTestCommand('vitest');
    expect(command).toBe('vitest');
    expect(args).toEqual([]);
  });

  it('should parse command with multiple args', () => {
    const { command, args } = parseTestCommand('npx vitest run');
    expect(command).toBe('npx');
    expect(args).toEqual(['vitest', 'run']);
  });
});

describe('extractRenderedHTML', () => {
  it('should return empty string for successful tests', () => {
    const result: TestRunResult = {
      success: true,
      stdout: '<body>some html</body>',
      stderr: '',
      exitCode: 0,
      duration: 0,
      jsonReport: null,
    };

    expect(extractRenderedHTML(result)).toBe('');
  });

  it('should extract HTML from body tags in stderr', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: 'Error: Unable to find element\n\n<body><div>Hello World</div></body>',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    expect(extractRenderedHTML(result)).toBe('<body><div>Hello World</div></body>');
  });

  it('should extract HTML from accessible tree output', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
TestingLibraryElementError: Unable to find an accessible element with the role "button"

Here is the accessible tree of your document:

<body>
  <div>
    <span>Click me</span>
  </div>
</body>
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<body>');
    expect(html).toContain('<span>Click me</span>');
  });

  it('should extract HTML from screen.debug() output', () => {
    const result: TestRunResult = {
      success: false,
      stdout: `
console.log
  <body>
    <div data-testid="container">
      <button>Submit</button>
    </div>
  </body>
`,
      stderr: '',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<body>');
    expect(html).toContain('<button>Submit</button>');
  });

  it('should extract generic HTML content as fallback', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: 'Error rendering component\n<div class="error"><p>Something went wrong</p></div>',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<div class="error">');
    expect(html).toContain('<p>Something went wrong</p>');
  });

  it('should return empty string when no HTML found', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: 'Error: Test failed without any HTML output',
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    expect(extractRenderedHTML(result)).toBe('');
  });

  it('should handle complex React Testing Library output', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
AssertionError: expected 'Login' to equal 'Sign In'

<body>
  <div>
    <h1>Login</h1>
    <form>
      <input type="text" placeholder="Username" />
      <input type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  </div>
</body>
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<h1>Login</h1>');
    expect(html).toContain('<input type="text" placeholder="Username"');
    expect(html).toContain('<button type="submit">Login</button>');
  });

  it('should handle HTML with attributes and nested elements', () => {
    const result: TestRunResult = {
      success: false,
      stdout: '',
      stderr: `
Error: Element not found

<body>
  <div id="app" class="container">
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
    <main>
      <article data-testid="post-1">
        <h2>Blog Post Title</h2>
        <p>Content here</p>
      </article>
    </main>
  </div>
</body>
`,
      exitCode: 1,
      duration: 0,
      jsonReport: null,
    };

    const html = extractRenderedHTML(result);
    expect(html).toContain('<body>');
    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('data-testid="post-1"');
  });
});

describe('runTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass correct arguments for mocha framework', async () => {
    await runTest('npm', 'npm test', {
      cwd: '/tmp',
      testFilePath: '/tmp/test.js',
      framework: 'mocha',
    });

    const mockedSpawn = vi.mocked(spawn);
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    const args = mockedSpawn.mock.calls[0][1];

    // Assertions for Mocha args
    expect(args).toContain('--reporter');
    expect(args).toContain('json');

    const reporterOptionIndex = args?.indexOf('--reporter-option');
    expect(reporterOptionIndex).toBeGreaterThan(-1);
    expect(args?.[reporterOptionIndex! + 1]).toMatch(/^output=.*\.json$/);
  });

  it('should pass correct arguments for vitest framework', async () => {
    await runTest('npm', 'npm test', {
      cwd: '/tmp',
      testFilePath: '/tmp/test.js',
      framework: 'vitest',
    });

    const mockedSpawn = vi.mocked(spawn);
    const args = mockedSpawn.mock.calls[0][1];
    expect(args).toContain('--reporter=json');
  });

  it('should not add reporter args for unknown framework', async () => {
    await runTest('npm', 'npm test', {
      cwd: '/tmp',
      testFilePath: '/tmp/test.js',
      framework: 'unknown' as unknown as TestRunnerFramework,
    });

    const mockedSpawn = vi.mocked(spawn);
    const args = mockedSpawn.mock.calls[0][1];
    expect(args).not.toContain('--reporter=json');
    expect(args).not.toContain('--reporter');
  });
});

describe('getReporterArgsByFramework', () => {
  const params = { jsonReportPath: '/tmp/report.json' };

  it('should return correct args for vitest', () => {
    const args = getReporterArgsByFramework(params, 'vitest');
    expect(args).toEqual(['--reporter=json', '--outputFile=/tmp/report.json']);
  });

  it('should return correct args for jest', () => {
    const args = getReporterArgsByFramework(params, 'jest');
    expect(args).toEqual(['--json', '--outputFile=/tmp/report.json']);
  });

  it('should return correct args for mocha', () => {
    const args = getReporterArgsByFramework(params, 'mocha');
    expect(args).toEqual([
      '--reporter',
      'json',
      '--reporter-option',
      'output=/tmp/report.json',
    ]);
  });

  it('should be case insensitive', () => {
    const args = getReporterArgsByFramework(params, 'ViTest');
    expect(args).toEqual(['--reporter=json', '--outputFile=/tmp/report.json']);
  });

  it('should return empty array for unknown framework', () => {
    const args = getReporterArgsByFramework(params, 'unknown');
    expect(args).toEqual([]);
  });

  it('should return empty array when framework is undefined', () => {
    const args = getReporterArgsByFramework(params, undefined);
    expect(args).toEqual([]);
  });
});

