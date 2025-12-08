import { SecretScanner } from '../secret-scanner';
import { sanitizationLogger } from '../sanitization-logger';

/**
 * Manual test for secret sanitization
 * Run with: pnpm --filter @riflebird/core exec tsx src/security/__tests__/manual-test.ts
 */

const testCode = `
// Example code with secrets
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
const awsKey = "AKIAIOSFODNN7PRODXYZ";
const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

// Database connection
const dbUrl = "postgres://admin:secretpass123@db.production.com:5432/mydb";

// JWT token
const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

// SSH Private Key
const sshKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAr7eUSO9tpZzZpUZ2vYmF1d9Q+vXRRkPw...
-----END RSA PRIVATE KEY-----\`;

// Should NOT be detected (false positives)
const exampleKey = "your_api_key_here";
const testKey = "test-api-key-12345";
const awsExampleKey = "AKIAIOSFODNN7EXAMPLE"; // Contains 'example'
`;

console.log('🔍 Testing Secret Scanner...\n');
console.log('Original code:');
console.log('─'.repeat(80));
console.log(testCode);
console.log('─'.repeat(80));
console.log('');

// Scan for secrets
const secrets = SecretScanner.scanForSecrets(testCode);
console.log(`\n📊 Found ${secrets.length} secret(s):\n`);

for (const secret of secrets) {
  console.log(`  - ${secret.type} at line ${secret.line}, column ${secret.column}`);
  console.log(`    Description: ${secret.description}`);
  console.log(`    Redacted: ${secret.redactedValue}`);
  console.log('');
}

// Sanitize the code
console.log('\n🔒 Sanitizing code...\n');
const result = SecretScanner.sanitize(testCode);

sanitizationLogger.logSanitization(result, 'test-file.ts');

console.log('Sanitized code:');
console.log('─'.repeat(80));
console.log(result.sanitizedCode);
console.log('─'.repeat(80));
console.log('');

// Show statistics
const stats = sanitizationLogger.getStatistics();
console.log('\n📈 Sanitization Statistics:');
console.log(`  Total events: ${stats.totalEvents}`);
console.log(`  Total secrets detected: ${stats.totalSecretsDetected}`);
console.log(`  Secrets by type:`);
for (const [type, count] of Object.entries(stats.secretsByType)) {
  console.log(`    - ${type}: ${count}`);
}
