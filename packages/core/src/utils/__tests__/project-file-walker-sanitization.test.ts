import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectFileWalker } from '../project-file-walker';
import { sanitizationLogger } from '../../security/sanitization-logger';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ProjectFileWalker - Secret Sanitization Integration', () => {
  let tempDir: string;
  let fileWalker: ProjectFileWalker;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'riflebird-test-'));
    fileWalker = new ProjectFileWalker({ projectRoot: tempDir });

    // Clear sanitization logger
    sanitizationLogger.clear();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should sanitize secrets when reading files', async () => {
    const testFile = 'test-config.ts';
    const codeWithSecrets = `
export const config = {
  apiKey: "sk-1234567890abcdefghijklmnopqrstuvwxyz123456",
  awsAccessKey: "AKIAINVALIDKEY000001",
  githubToken: "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
  dbUrl: "postgres://admin:secretpass123@db.production.com:5432/mydb"
};
    `.trim();

    // Write test file
    await fs.writeFile(path.join(tempDir, testFile), codeWithSecrets, 'utf-8');

    // Read through ProjectFileWalker (should sanitize)
    const sanitizedContent = await fileWalker.readFileFromProject(testFile);

    // Verify secrets are redacted (using hash-based identifiers, not specific suffixes)
    expect(sanitizedContent).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
    expect(sanitizedContent).toMatch(/\[REDACTED_AWS_KEY_[a-f0-9]{6}\]/);
    expect(sanitizedContent).toMatch(/\[REDACTED_GITHUB_TOKEN_[a-f0-9]{6}\]/);
    expect(sanitizedContent).toMatch(/\[REDACTED_DATABASE_URL_[a-f0-9]{6}\]/);

    // Verify original secrets are NOT in sanitized content
    expect(sanitizedContent).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
    expect(sanitizedContent).not.toContain('AKIAINVALIDKEY000001');
    expect(sanitizedContent).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(sanitizedContent).not.toContain('secretpass123');
  });

  it('should log sanitization events', async () => {
    const testFile = 'api-client.js';
    const codeWithSecret = `
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
fetch('/api/data', { headers: { 'Authorization': \`Bearer \${apiKey}\` } });
    `.trim();

    await fs.writeFile(path.join(tempDir, testFile), codeWithSecret, 'utf-8');

    // Clear previous stats
    const statsBefore = sanitizationLogger.getStatistics();
    const eventsBefore = statsBefore.totalEvents;

    // Read file (triggers sanitization)
    await fileWalker.readFileFromProject(testFile);

    // Check that sanitization was logged
    const stats = sanitizationLogger.getStatistics();
    expect(stats.totalEvents).toBeGreaterThan(eventsBefore);
    expect(stats.totalSecretsDetected).toBeGreaterThan(0);
    expect(stats.secretsByType.API_KEY).toBeGreaterThan(0);
  });

  it('should not modify files without secrets', async () => {
    const testFile = 'clean-code.ts';
    const cleanCode = `
export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}
    `.trim();

    await fs.writeFile(path.join(tempDir, testFile), cleanCode, 'utf-8');

    const result = await fileWalker.readFileFromProject(testFile);

    // Should return unchanged
    expect(result).toBe(cleanCode);

    // Should not log any sanitization
    const stats = sanitizationLogger.getStatistics();
    expect(stats.totalSecretsDetected).toBe(0);
  });

  it('should ignore false positive patterns', async () => {
    const testFile = 'example-code.ts';
    const codeWithFalsePositives = `
// Configuration example
const config = {
  apiKey: "your_api_key_here",
  testKey: "test-api-key-12345",
  exampleToken: "EXAMPLEKEYEXAMPLE123"
};
    `.trim();

    await fs.writeFile(path.join(tempDir, testFile), codeWithFalsePositives, 'utf-8');

    const result = await fileWalker.readFileFromProject(testFile);

    // False positives should NOT be redacted
    expect(result).toContain('your_api_key_here');
    expect(result).toContain('test-api-key-12345');
    expect(result).toContain('EXAMPLEKEYEXAMPLE123');
    expect(result).not.toContain('[REDACTED_');
  });

  it('should handle multiple secrets in single file', async () => {
    const testFile = 'multi-secret.config.js';
    const configFile = `
module.exports = {
  apiKey: "sk-1234567890abcdefghijklmnopqrstuvwxyz123456",
  awsAccessKeyId: "AKIAINVALIDKEY000002",
  githubToken: "ghp_realtoken123456789abcdefghijklmno",
  databaseUrl: "postgres://user:pass123@prod.db.com/myapp",
  jwtSecret: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
};
    `.trim();

    await fs.writeFile(path.join(tempDir, testFile), configFile, 'utf-8');

    const result = await fileWalker.readFileFromProject(testFile);

    // Check that at least some secrets were detected and redacted
    expect(result).toContain('[REDACTED_');

    // Verify specific ones we know match current patterns (hash-based identifiers)
    expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
    expect(result).toMatch(/\[REDACTED_DATABASE_URL_[a-f0-9]{6}\]/);
    expect(result).toMatch(/\[REDACTED_JWT_TOKEN_[a-f0-9]{6}\]/);

    // Original secrets should not be present
    expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
    expect(result).not.toContain('pass123');
  });

  it('should preserve code structure after sanitization', async () => {
    const testFile = 'structured-code.ts';
    const structuredCode = `
class ApiClient {
  private apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";

  constructor() {
    this.init();
  }

  async fetchData() {
    return fetch('/api', {
      headers: { 'X-API-Key': this.apiKey }
    });
  }
}
    `.trim();

    await fs.writeFile(path.join(tempDir, testFile), structuredCode, 'utf-8');

    const result = await fileWalker.readFileFromProject(testFile);

    // Structure should be preserved
    expect(result).toContain('class ApiClient');
    expect(result).toContain('private apiKey =');
    expect(result).toContain('constructor()');
    expect(result).toContain('async fetchData()');

    // Secret should be redacted (hash-based identifier)
    expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
    expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
  });

  describe('Edge Cases', () => {
    /**
     * Edge case tests verify robust secret detection across various contexts.
     *
     * Pattern capabilities:
     * - ✅ Standalone detection: sk- API keys, GitHub tokens, AWS keys, DB URLs, JWT, Stripe, SendGrid, Twilio, Mailgun
     * - ✅ Context-aware: Generic API keys with context keywords (apiKey, api_key, apikey)
     * - ✅ Works in: comments, URLs, JSON, template literals, different quote types
     * - ✅ Multiline: Private keys, certificates
     * - ⚠️  Limitation: Base64 encoded secrets not detected (can't detect all encodings)
     *
     * Design philosophy: Maximize detection while maintaining precision.
     * Standalone patterns for known formats (sk-, ghp_, AKIA, SG., etc.)
     * reduce false positives without sacrificing security.
     */

    it('should handle empty files', async () => {
      const testFile = 'empty.ts';
      await fs.writeFile(path.join(tempDir, testFile), '', 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      expect(result).toBe('');
      expect(sanitizationLogger.getStatistics().totalSecretsDetected).toBe(0);
    });

    it('should handle files with only whitespace', async () => {
      const testFile = 'whitespace.ts';
      const content = '   \n\n\t\t  \n   ';
      await fs.writeFile(path.join(tempDir, testFile), content, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      expect(result).toBe(content);
    });

    it('should handle secrets in comments', async () => {
      const testFile = 'commented-secrets.ts';
      const code = `
// TODO: Replace with actual key: sk-1234567890abcdefghijklmnopqrstuvwxyz123456
/*
 * Production AWS key: AKIAINVALIDKEY000003
 * Don't commit this!
 */
const placeholder = "safe-value";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // Both secrets should be detected - AWS keys and sk- API keys have standalone patterns
      expect(result).toMatch(/\[REDACTED_AWS_KEY_[a-f0-9]{6}\]/);
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('AKIAINVALIDKEY000003');
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
    });

    it('should handle secrets in template literals', async () => {
      const testFile = 'template-literals.ts';
      const code = `
const apiUrl = \`https://api.example.com?key=sk-1234567890abcdefghijklmnopqrstuvwxyz123456\`;
const msg = \`Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz\`;
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // Both secrets detected with standalone patterns
      expect(result).toMatch(/\[REDACTED_GITHUB_TOKEN_[a-f0-9]{6}\]/);
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
      expect(result).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should handle secrets in JSON strings', async () => {
      const testFile = 'json-data.json';
      const json = JSON.stringify({
        apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz123456',
        config: {
          githubToken: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
          database: 'postgres://user:password123@localhost/db',
        },
      }, null, 2);

      await fs.writeFile(path.join(tempDir, testFile), json, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // All three secrets detected - GitHub token, DB URL, and sk- API key
      expect(result).toMatch(/\[REDACTED_GITHUB_TOKEN_[a-f0-9]{6}\]/);
      expect(result).toContain('[REDACTED_DATABASE_URL');
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
      expect(result).not.toContain('password123');
    });

    it('should handle secrets on same line', async () => {
      const testFile = 'same-line.ts';
      const code = `const k1="sk-1234567890abcdefghijklmnopqrstuvwxyz123456";const k2="ghp_1234567890abcdefghijklmnopqrstuvwxyz";`;

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // Both secrets detected with standalone patterns
      expect(result).toMatch(/\[REDACTED_GITHUB_TOKEN_[a-f0-9]{6}\]/);
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
    });

    it('should handle multiline secrets (private keys)', async () => {
      const testFile = 'private-key.pem';
      // Pattern requires matching END tag, provide complete key
      const key = `-----BEGIN RSA PRIVATE KEY-----
ThisIsNotARealPrivateKeyJustForTestingPurposesInvalidData123
-----END RSA PRIVATE KEY-----`;

      await fs.writeFile(path.join(tempDir, testFile), key, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // Private key should be detected and redacted (hash-based identifier)
      expect(result).toMatch(/\[REDACTED_PRIVATE_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('ThisIsNotARealPrivateKey');
      expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
    });

    it('should handle secrets with special characters', async () => {
      const testFile = 'special-chars.ts';
      const code = `
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const apiKey = "sk-1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      expect(result).toContain('[REDACTED_JWT_TOKEN_');
      expect(result).toContain('[REDACTED_API_KEY_');
      expect(result).not.toContain('ABCDEFGHIJ');
    });

    it('should handle very long files', async () => {
      const testFile = 'large-file.ts';
      const secretLine = 'const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";';
      const normalLine = 'const x = 42;\n';
      // Create a large file with secret at line 5000
      const lines = Array(4999).fill(normalLine).join('');
      const content = lines + secretLine + '\n' + Array(5000).fill(normalLine).join('');

      await fs.writeFile(path.join(tempDir, testFile), content, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
    });

    it('should handle consecutive secrets', async () => {
      const testFile = 'consecutive.ts';
      const code = `
const key1 = "sk-1111111111111111111111111111111111111111";
const key2 = "sk-2222222222222222222222222222222222222222";
const key3 = "sk-3333333333333333333333333333333333333333";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // All three sk- prefixed keys detected with standalone pattern
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('sk-1111111111111111111111111111111111111111');
      expect(result).not.toContain('sk-2222222222222222222222222222222222222222');
      expect(result).not.toContain('sk-3333333333333333333333333333333333333333');
    });

    it('should handle secrets in different quote types', async () => {
      const testFile = 'quotes.ts';
      const code = `
const single = 'sk-1234567890abcdefghijklmnopqrstuvwxyz123456';
const double = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
const backtick = \`sk-1234567890abcdefghijklmnopqrstuvwxyz123456\`;
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // All three quotes should have sk- API key detected (all same value = same hash)
      const redactedCount = (result.match(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/g) || []).length;
      expect(redactedCount).toBe(3);
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
    });

    it('should handle base64 encoded secrets', async () => {
      const testFile = 'base64.ts';
      // Base64 of "sk-1234567890abcdefghijklmnopqrstuvwxyz123456"
      const code = `
const encoded = "c2stMTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2";
const raw = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // Raw sk- key is detected with standalone pattern
      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
      // Base64 won't match pattern (expected - can't detect all encodings)
      expect(result).toContain('c2stMTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2');
    });

    it('should handle secrets in environment variable format', async () => {
      const testFile = 'env-config.ts';
      // Test with proper context keywords that match patterns
      const code = `
// Configuration loading
const api_key = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
const github_token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
const database_url = "postgres://user:password@localhost:5432/mydb";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // All three should be detected - api_key, github_token, and database_url match patterns
      expect(result).toContain('[REDACTED_API_KEY');
      expect(result).toContain('[REDACTED_GITHUB_TOKEN');
      expect(result).toContain('[REDACTED_DATABASE_URL');
      expect(result).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz123456');
      expect(result).not.toContain('password');
      expect(result).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should handle already redacted values', async () => {
      const testFile = 'already-sanitized.ts';
      const code = `
const key1 = "[REDACTED_API_KEY_abc123]";
const key2 = "[REDACTED_AWS_KEY_def456]";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      // Should remain unchanged (no double redaction)
      expect(result).toBe(code);
    });

    it('should handle unicode and emoji in file with secrets', async () => {
      const testFile = 'unicode.ts';
      const code = `
// 🔑 Secret key below
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
const message = "Hello 世界 🌍";
      `.trim();

      await fs.writeFile(path.join(tempDir, testFile), code, 'utf-8');

      const result = await fileWalker.readFileFromProject(testFile);

      expect(result).toMatch(/\[REDACTED_API_KEY_[a-f0-9]{6}\]/);
      expect(result).toContain('🔑');
      expect(result).toContain('世界');
      expect(result).toContain('🌍');
    });
  });
});
