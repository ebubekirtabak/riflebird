import { describe, it, expect } from 'vitest';
import { SecretScanner } from '../secret-scanner';

describe('SendGrid and Third-Party Service Keys', () => {
  it('should detect SendGrid API keys', () => {
    const code = `
const sendgridKey = 'SG.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
const config = {
  apiKey: 'SG.1234567890abcdefghijklmnopqrstuvwxyz1234567890ABC'
};
    `.trim();

    const result = SecretScanner.scanForSecrets(code);
    const sanitized = SecretScanner.sanitize(code);

    // Should detect both SendGrid keys
    expect(result.length).toBe(2);
    expect(result.every(s => s.type === 'SENDGRID_KEY')).toBe(true);
    expect(sanitized.sanitizedCode).toContain('[REDACTED_SENDGRID_KEY');
    expect(sanitized.sanitizedCode).not.toContain('SG.abc123');
  });

  it('should detect Twilio Account SIDs', () => {
    const code = `const twilioSid = 'ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';`;

    const result = SecretScanner.scanForSecrets(code);
    const sanitized = SecretScanner.sanitize(code);

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('TWILIO_KEY');
    expect(sanitized.sanitizedCode).toContain('[REDACTED_TWILIO_KEY');
    expect(sanitized.sanitizedCode).not.toContain('ACa1b2c3');
  });

  it('should detect Stripe API keys', () => {
    // Use dynamic string construction to avoid triggering GitHub's push protection
    // while still testing the actual Stripe pattern detection
    const prefix1 = 'sk' + '_live' + '_';
    const prefix2 = 'sk' + '_test' + '_';
    const prefix3 = 'pk' + '_live' + '_';
    const suffix = 'A'.repeat(24); // Minimum 24 chars required by pattern

    const code = `
const liveKey = '${prefix1}${suffix}';
const testKey = '${prefix2}${suffix}';
const pubKey = '${prefix3}${suffix}';
    `.trim();

    const result = SecretScanner.scanForSecrets(code);
    const sanitized = SecretScanner.sanitize(code);

    // Should detect all 3 Stripe keys (live secret, test secret, live publishable)
    expect(result.length).toBe(3);
    expect(result.every((s) => s.type === 'STRIPE_KEY')).toBe(true);
    expect(sanitized.sanitizedCode).toMatch(/\[REDACTED_STRIPE_KEY_[a-f0-9]{6}\]/);
    expect(sanitized.sanitizedCode).not.toContain(prefix1 + suffix);
  });

  it('should detect Mailgun API keys', () => {
    const code = `const mailgunKey = 'key-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';`;

    const result = SecretScanner.scanForSecrets(code);
    const sanitized = SecretScanner.sanitize(code);

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('MAILGUN_KEY');
    expect(sanitized.sanitizedCode).toContain('[REDACTED_MAILGUN_KEY');
    expect(sanitized.sanitizedCode).not.toContain('key-1a2b3c4d');
  });

  it('should validate Stripe pattern regex requirements', () => {
    // Test that pattern requires minimum 24 characters after prefix
    const tooShort = 'sk' + '_live' + '_' + 'A'.repeat(23); // 23 chars - should NOT match
    const exactMin = 'sk' + '_live' + '_' + 'A'.repeat(24); // 24 chars - should match
    const longer = 'sk' + '_test' + '_' + 'B'.repeat(50); // 50 chars - should match

    const codeTooShort = `const key = '${tooShort}';`;
    const codeExactMin = `const key = '${exactMin}';`;
    const codeLonger = `const key = '${longer}';`;

    // Too short should not be detected
    expect(SecretScanner.scanForSecrets(codeTooShort).length).toBe(0);

    // Exact minimum and longer should be detected
    expect(SecretScanner.scanForSecrets(codeExactMin).length).toBe(1);
    expect(SecretScanner.scanForSecrets(codeLonger).length).toBe(1);
  });
});
