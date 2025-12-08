import { describe, it, expect, afterEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';

describe('SecretScanner - unit tests', () => {
  afterEach(() => {
    // Ensure any monkeypatches are cleared by restoring original implementation if present
    // (some tests temporarily override scanForSecrets)
    // @ts-ignore
    if (SecretScanner.__originalScanForSecrets) {
      // @ts-ignore
      SecretScanner.scanForSecrets = SecretScanner.__originalScanForSecrets;
      // @ts-ignore
      delete SecretScanner.__originalScanForSecrets;
    }
  });

  it('detects sk- API keys and redacts with hash placeholder', () => {
    const code = `const key = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";`;

    const found = SecretScanner.scanForSecrets(code);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((s) => s.type === 'API_KEY')).toBe(true);

    const sanitized = SecretScanner.sanitize(code);
    expect(sanitized.sanitizedCode).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
  });

  it('detects provider keys: SendGrid, Twilio, Stripe, Mailgun', () => {
    // Use non-placeholder characters (avoid 'xxx' and similar) and build
    // the actual string literals so the scanner detects them in the code text.
    const sgKey = 'SG.' + 'A'.repeat(32);
    const twKey = 'AC' + 'a'.repeat(32);
    const skKey = 'sk_live_' + 'A'.repeat(24);
    const mgKey = 'key-' + 'a'.repeat(32);

    const code = `
const sg = '${sgKey}';
const tw = '${twKey}';
const sk = '${skKey}';
const mg = '${mgKey}';
    `.trim();

    const found = SecretScanner.scanForSecrets(code);
    const types = found.map((s) => s.type);
    expect(types).toContain('SENDGRID_KEY');
    expect(types).toContain('TWILIO_KEY');
    expect(types).toContain('STRIPE_KEY');
    expect(types).toContain('MAILGUN_KEY');
  });

  it('filters false positives (placeholder/example values)', () => {
    const code = `const k = 'your_api_key_here'; const t = "EXAMPLE";`;
    const found = SecretScanner.scanForSecrets(code);
    expect(found.length).toBe(0);
  });

  it('respects file extension and exclude patterns in shouldScanFile', () => {
    expect(SecretScanner.shouldScanFile('src/api-client.ts')).toBe(true);
    expect(SecretScanner.shouldScanFile('node_modules/some/pkg/index.js')).toBe(false);
    expect(SecretScanner.shouldScanFile('dist/bundle.min.js')).toBe(false);
    expect(SecretScanner.shouldScanFile('config/.env')).toBe(true);
  });

  it('handles empty input and malformed input gracefully', () => {
    expect(SecretScanner.scanForSecrets('')).toEqual([]);
    // Non-string input is not a supported API; ensure no throw for stringified input
    expect(SecretScanner.scanForSecrets(String(null))).toEqual([]);
  });

  it('produces stable hash placeholders for identical secrets', () => {
    const secret = 'sk-1111111111111111111111aaaa';
    const code = `const a = "${secret}"; const b = "${secret}";`;

    const result = SecretScanner.sanitize(code);
    const matches = result.sanitizedCode.match(/\[REDACTED_[A-Z_]+_[a-f0-9]{6}\]/g) || [];
    expect(matches.length).toBe(2);
    expect(matches[0]).toBe(matches[1]); // same placeholder for identical secret
  });

  it('handles overlapping detected secrets by applying earliest/longest match', () => {
    const code = 'xxxxSECRET12345yyyy';

    // Monkeypatch scanForSecrets to return overlapping detections
    // Save original
    // @ts-ignore
    SecretScanner.__originalScanForSecrets = SecretScanner.scanForSecrets;
    // @ts-ignore
    SecretScanner.scanForSecrets = () => {
      return [
        {
          type: 'API_KEY' as const,
          value: 'SECRET12345',
          start: 4,
          end: 15,
          line: 1,
          column: 5,
          description: 'fake',
          redactedValue: '[REDACTED_API_KEY_aaaaaa]',
        },
        {
          type: 'TWILIO_KEY' as const,
          value: 'CRET1',
          start: 6,
          end: 11,
          line: 1,
          column: 7,
          description: 'fake',
          redactedValue: '[REDACTED_TWILIO_KEY_bbbbbb]',
        },
      ];
    };

    // Call sanitize; the implementation should apply the first (earliest/longest)
    const sanitized = SecretScanner.sanitize(code);
    expect(sanitized.sanitizedCode).toContain('[REDACTED_API_KEY_aaaaaa]');
    expect(sanitized.sanitizedCode).not.toContain('[REDACTED_TWILIO_KEY_bbbbbb]');
  });
});
