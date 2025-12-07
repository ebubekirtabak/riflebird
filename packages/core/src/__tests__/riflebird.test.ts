import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config loader used by Riflebird
vi.mock('../config/loader', () => {
  const mockedConfig = {
    ai: {
      provider: 'local',
      url: 'http://localhost:8080',
      apiKey: 'LOCAL_KEY',
      model: 'test-model',
      temperature: 0.2,
    },
    e2e: {
      framework: 'playwright',
    },
  };

  return {
    loadConfig: async () => mockedConfig,
    defineConfig: (c: unknown) => c,
  };
});

// Mock the Playwright adapter so we don't initialize real Playwright in tests
vi.mock('../adapters/playwright', () => {
  return {
    PlaywrightAdapter: class PlaywrightAdapter {
      constructor(public cfg: unknown) {}
      async init(_cfg?: unknown) {
        return Promise.resolve();
      }
      async generateTestCode(_plan: unknown) {
        return '/* generated test code */';
      }
      async findElement(_desc: string) {
        return 'selector';
      }
    },
  };
});

// After mocks are set up, import the class under test
import { Riflebird } from '../riflebird';

describe('Riflebird (local provider)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('posts to local AI endpoint with correct headers and body', async () => {
    // Spy on global.fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            steps: [{ action: 'click', selector: '#login' }],
            assertions: [{ type: 'visible', selector: '#dashboard' }],
          }),
        },
      }),
    });

    // Ensure global.fetch exists for the test
    (globalThis as unknown as { fetch?: (...args: unknown[]) => Promise<unknown> }).fetch = fetchMock;

    const rb = new Riflebird();
    await rb.init();

    // Call aim() which will trigger the local provider POST through AimCommand
    const description = 'Test login flow';
    await rb.aim(description);

    expect(fetchMock).toHaveBeenCalled();

    const calledWith = fetchMock.mock.calls[0];
    const url = calledWith[0] as string;
    const opts = calledWith[1] as {
      method: string;
      headers: Record<string, string>;
      body: string;
    };

    expect(url).toBe('http://localhost:8080/api/chat');

    expect(opts).toBeDefined();
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      options: { temperature: number };
    };
    expect(body.model).toBe('test-model');
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.2);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.some((m) => m.content.includes(description))).toBe(true);
  });
});
