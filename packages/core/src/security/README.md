# Security Layer - Secret Sanitization

The Riflebird security layer prevents sensitive data (API keys, tokens, passwords, etc.) from being exposed to LLM providers when analyzing user code.

## Why This Matters

**Humans make mistakes.** We understand that:
- 🔴 Developers accidentally commit secrets to repositories
- 🔴 Test files may contain real API keys during development
- 🔴 Configuration files sometimes have production credentials
- 🔴 Environment variables get hardcoded in code temporarily
- 🔴 Database URLs with passwords slip into version control

**We built this layer assuming mistakes will happen.** Even if secrets shouldn't be in your code, we automatically protect them when they are.

## Overview

When Riflebird reads code from a user's project to generate tests or analyze context, it automatically sanitizes any detected secrets before sending the code to AI providers (OpenAI, Anthropic, local LLMs).

Note: Sanitization previously existed in the `ai-client` helper but has been removed to avoid double-sanitization. Riflebird now performs sanitization at a single entry point: `ProjectFileWalker.readFileFromProject()` (see "ProjectFileWalker integration"), and downstream components should expect already-sanitized content.

**This protection is automatic and always active** - you don't need to configure anything. Think of it as a safety net for human error.

## Features

✅ **Automatic Detection** - Scans for 9 types of secrets:
- API Keys (generic, provider-specific)
- AWS Access Keys & Secret Keys
- GitHub Tokens (PAT, OAuth, app tokens)
- SSH Private Keys (RSA, DSA, ECDSA, ED25519)
- Database URLs (PostgreSQL, MySQL, MongoDB, Redis)
- JWT Tokens
- OAuth Tokens
- Passwords (in assignments/configs)
- Environment Variable Assignments

✅ **Smart False-Positive Filtering** - Ignores:
- Example/placeholder values (`your_api_key_here`, `EXAMPLE`, `test-key-123`)
- Common dummy values (`xxx`, `***`, `dummy`, `fake`, `sample`)
- Already redacted values (`[REDACTED_*]`)

✅ **Secure Redaction** - Replaces secrets with:
- Format: `[REDACTED_{TYPE}_{suffix}]`
- Suffix: Last 3 characters of original (for debugging)
- Example: `sk-abc123...xyz456` → `[REDACTED_API_KEY_456]`

✅ **Safe Logging** - Logs sanitization events without exposing secrets:
```
🔒 Sanitized 3 secret(s) from api-client.ts [1x API_KEY, 1x JWT_TOKEN, 1x AWS_KEY]
```

## Architecture

### Complete Security Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S PROJECT                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ api-client.ts│  │ config.json  │  │    .env      │             │
│  │ const key =  │  │ { "token":   │  │ API_KEY=sk-  │             │
│  │ "sk-abc123"  │  │   "ghp_xyz"} │  │ DATABASE_URL │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │ 1. Read file from disk
             ▼
    ┌────────────────────────────────────────┐
    │   ProjectFileWalker.readFileFromProject │
    │   (packages/core/src/utils/)            │
    └────────────┬───────────────────────────┘
                 │
                 │ 2. Scan for secrets
                 ▼
        ┌─────────────────────────┐
        │    SecretScanner         │
        │  - Pattern matching      │
        │  - False-positive filter │
        │  - Context validation    │
        └────────┬────────────────┘
                 │
                 │ 3. Replace with placeholders
                 ▼
        ┌─────────────────────────┐
        │  Redaction Engine        │
        │  sk-abc123 →             │
        │  [REDACTED_API_KEY_123]  │
        └────────┬────────────────┘
                 │
                 │ 4. Log event (NO secret values)
                 ▼
        ┌─────────────────────────┐
        │  SanitizationLogger      │
        │  🔒 Sanitized 1 secret   │
        │     from api-client.ts   │
        └─────────────────────────┘
                 │
                 │ 5. Return sanitized code
                 ▼
    ┌────────────────────────────────────────┐
    │         RIFLEBIRD CORE                  │
    │  - Test generation (AimCommand)         │
    │  - Project analysis (FireCommand)       │
    │  - Context provider                     │
    └────────────┬───────────────────────────┘
                 │
                 │ 6. Send sanitized content to LLM
                 ▼
    ┌────────────────────────────────────────┐
    │         LLM PROVIDERS                   │
    │  ┌──────────┐  ┌──────────┐           │
    │  │  OpenAI  │  │ Anthropic│  Local    │
    │  └──────────┘  └──────────┘   LLM     │
    └────────────────────────────────────────┘
```

**Key Security Points:**
- ✅ Secrets never leave the local machine in plaintext
- ✅ Single protection layer at file reading - all code sanitized at entry point
- ✅ Logging never includes actual secret values
- ✅ Redacted values use SHA-256 hash identifiers (no actual secret characters exposed)
- ✅ Hash-based placeholders maintain uniqueness while preventing reconstruction
- ✅ Original files on disk remain unchanged
- ✅ All user code passes through ProjectFileWalker for consistent protection

**Supported Secret Types:**
- 🔑 **API Keys** - Generic API keys with context
- 🔐 **AWS Keys** - Access keys and secret keys
- 🐙 **GitHub Tokens** - Personal access tokens (ghp_, gho_, ghs_)
- 📧 **SendGrid** - Email API keys (SG.xxxx)
- 📱 **Twilio** - Account SIDs and API keys (AC..., SK...)
- 💳 **Stripe** - Secret and publishable keys (sk_live_, pk_live_)
- 📮 **Mailgun** - API keys (key-xxxx)
- 🔒 **Private Keys** - RSA, DSA, EC, OpenSSH, PGP
- 🔐 **JWT Tokens** - JSON Web Tokens
- 🌐 **OAuth Tokens** - Access and bearer tokens
- 🗄️ **Database URLs** - PostgreSQL, MySQL, MongoDB, Redis
- 📝 **Passwords** - Password assignments in code
- 🌍 **Environment Variables** - process.env assignments

### Components

1. **`secret-patterns.ts`** - Pattern definitions
   - 13 secret types with specialized patterns
   - False-positive filters (example, placeholder, test, dummy)
   - File type filters (.ts, .js, .py, .env, .pem, .key, etc.)

2. **`secret-scanner.ts`** - Core scanning logic
   - `scanForSecrets()` - Detect secrets in code
   - `sanitize()` - Replace secrets with placeholders
   - `hasSecrets()` - Quick check without scanning

3. **`sanitization-logger.ts`** - Event logging
   - Logs counts, types, locations
   - **Never** logs actual secret values
   - Provides statistics and history

4. **`project-file-walker.ts`** integration (Single entry point)
   - **All file reads from user projects pass through here**
   - `readFileFromProject()` automatically sanitizes content
   - Used by: `AimCommand`, `FireCommand`, `ProjectContextProvider`
   - Single-layer protection ensures secrets never reach processing pipeline or LLM
   - No additional sanitization needed downstream

## Usage

### Automatic (Default)
✅ **Secure Redaction** - Replaces secrets with:
- Format: `[REDACTED_{TYPE}_{hash}]`
- Hash: First 6 hex characters of SHA-256(original)
- Example: `sk-abc123...xyz456` → `[REDACTED_API_KEY_3f810a]`
```typescript
import { ProjectFileWalker } from '@riflebird/core/utils';
**Key Security Points:**
- ✅ Secrets never leave the local machine in plaintext
- ✅ Single protection layer at file reading - all code sanitized at entry point
- ✅ Logging never includes actual secret values
- ✅ Redacted values use SHA-256 hash identifiers (no actual secret characters exposed)
- ✅ Hash-based placeholders maintain uniqueness while preventing reconstruction
- ✅ Original files on disk remain unchanged
- ✅ All user code passes through ProjectFileWalker for consistent protection
**How it works in practice:**
```typescript
  │  [REDACTED_API_KEY_3f810a]  │
const API_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456";
const AWS_KEY = "AKIAIOSFODNN7PRODXYZ";

// ↓ ProjectFileWalker reads file
// ↓ SecretScanner detects secrets
// ↓ Redaction engine replaces them

// What Riflebird sees:
const API_KEY = "[REDACTED_API_KEY_3f810a]";
const AWS_KEY = "[REDACTED_AWS_KEY_7e2c1b]";

// ✅ Secrets never exposed to LLM providers
// ✅ Original file on disk unchanged
```

### Secure Code Reading Flow

The `ProjectFileWalker` is the **primary entry point** for reading user code:

```typescript
// packages/core/src/utils/project-file-walker.ts
export class ProjectFileWalker {
  async readFileFromProject(filePath: string): Promise<string> {
    const fullPath = path.join(this.context.projectRoot, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // 🔒 SECURITY LAYER - Sanitize before returning
    const result = SecretScanner.sanitize(content, { filePath });
    
    // Log if secrets detected (safe - no secret values logged)
    if (result.secretsDetected > 0) {
      sanitizationLogger.logSanitization(result, filePath);
    }
    
    return result.sanitizedCode; // ✅ Always returns sanitized code
  }
}
```

**Who uses ProjectFileWalker?**
- `AimCommand` - Reads user code for test generation
- `FireCommand` - Reads test files for execution
- `ProjectContextProvider` - Reads config files for project analysis
- All file operations in Riflebird core

**Result:**
```
🔒 Every code read is automatically sanitized
🔒 No secrets reach the LLM pipeline
🔒 Safe logging with detection counts only
```

### Manual Scanning

```typescript
import { SecretScanner } from '@riflebird/core/security';

const code = `
const apiKey = "sk-abc123xyz456";
const dbUrl = "postgres://user:pass@localhost/db";
`;

// Scan for secrets
const secrets = SecretScanner.scanForSecrets(code);
console.log(`Found ${secrets.length} secrets`);

// Sanitize
const result = SecretScanner.sanitize(code);
console.log(result.sanitizedCode);
// Output:
// const apiKey = "[REDACTED_API_KEY_3f810a]";
// const dbUrl = "[REDACTED_DATABASE_URL_f8a2b1]";
```

**Security Note: Hash-Based Identifiers**

Redacted placeholders use SHA-256 hash identifiers instead of exposing actual secret characters:
- ✅ `[REDACTED_API_KEY_3f810a]` - First 6 chars of SHA-256 hash
- ❌ ~~`[REDACTED_API_KEY_456]`~~ - Would expose last 3 chars of secret

**Why hash-based?**
- **Prevents reconstruction**: Attackers cannot reverse-engineer secrets from suffixes
- **Maintains uniqueness**: Same secret = same hash, different secrets = different hashes
- **Debugging friendly**: Stable identifiers help track same secrets across files
- **No information leakage**: Hash provides no clues about actual secret content

**Security comparison:**
```typescript
// ❌ UNSAFE: Exposes last 3 characters
const secret = "sk-abc123xyz456";
const unsafe = "[REDACTED_API_KEY_456]"; // Leaks "456"

// ✅ SAFE: Hash-based identifier
const safe = "[REDACTED_API_KEY_3f810a]"; // SHA-256 hash, no secret content
```

### Check for Secrets

```typescript
if (SecretScanner.hasSecrets(code, filePath)) {
  console.warn('⚠️  Code contains potential secrets');
}
```

### Get Statistics

```typescript
import { sanitizationLogger } from '@riflebird/core/security';

const stats = sanitizationLogger.getStatistics();
console.log(`Sanitized ${stats.totalSecretsDetected} secrets across ${stats.totalEvents} events`);
console.log('By type:', stats.secretsByType);
```

## Configuration

### Scannable File Types

By default, scans these extensions:
- JavaScript/TypeScript: `.js`, `.ts`, `.jsx`, `.tsx`
- Python: `.py`
- Config files: `.env`, `.config`, `.json`, `.yaml`, `.yml`
- Other: `.go`, `.java`, `.rb`, `.php`

### Excluded Paths

Automatically skips:
- `node_modules/`
- `.git/`
- `dist/`, `build/`, `coverage/`
- Minified files (`.min.*`)
- Source maps (`.map`)

## Implementation Files

### Security Layer Components
```
packages/core/src/security/
├── secret-patterns.ts              # Pattern definitions (11 patterns, 9 types)
├── secret-scanner.ts               # Core scanning & redaction logic
├── sanitization-logger.ts          # Safe event logging (no secrets)
├── index.ts                        # Public exports
├── README.md                       # This documentation
└── __tests__/
    └── manual-test.ts              # Manual verification script
```

### Integration Points
```
packages/core/src/
├── utils/
│   ├── project-file-walker.ts      # 🔒 PRIMARY: File reading with sanitization
│   └── __tests__/
│       ├── project-file-walker.test.ts
│       └── project-file-walker-sanitization.test.ts  # Integration tests
```

### Test Coverage
- ✅ 21 integration tests in `project-file-walker-sanitization.test.ts`
- ✅ 5 third-party service tests (SendGrid, Twilio, Stripe, Mailgun)
- ✅ 165 total tests passing (includes existing tests)
- ✅ Manual test script with real-world examples

**Testing Approach for GitHub Push Protection:**
- Stripe patterns use dynamic string construction (`'sk' + '_live' + '_' + chars`) to avoid triggering GitHub's secret scanner while still validating pattern detection
- Pattern regex requirements verified separately (minimum character lengths, prefixes)
- This approach ensures CI tests pass while maintaining confidence in pattern correctness

## Testing

Run integration tests:

```bash
# All tests
pnpm --filter @riflebird/core test --run

# Sanitization-specific tests
pnpm --filter @riflebird/core test project-file-walker-sanitization --run
```

Run manual test:

```bash
pnpm --filter @riflebird/core exec tsx src/security/__tests__/manual-test.ts
```

**Expected output:**
```
🔍 Testing Secret Scanner...
📊 Found 6 secret(s):
  - API_KEY at line 3, column 7
  - AWS_KEY at line 4, column 17
  ...
🔒 Sanitized 6 secret(s) from test-file.ts
📈 Sanitization Statistics:
  Total secrets detected: 6
  Secrets by type:
    - API_KEY: 1
    - AWS_KEY: 1
    - GITHUB_TOKEN: 1
    ...
```

## Security Considerations

1. **No Secret Storage** - Secrets are detected, redacted, and discarded. Never stored or logged.

2. **Line/Column Info** - Only positions are logged, not values:
   ```
   Detected 2 secret(s):
     - 1x API_KEY at lines: 10, 15
   ```

3. **Debugging Suffix** - Last 3 characters help debugging without exposing full secret:
   ```
   [REDACTED_API_KEY_456]  // Original ended in '456'
   ```

4. **Context Awareness** - Some patterns require context validation to reduce false positives (e.g., password assignments).

## Limitations

### Pattern Behavior

Our secret detection patterns are designed to balance **precision** (avoiding false positives) with **recall** (catching real secrets). This means some patterns intentionally require context to avoid over-redaction.

**Context-Dependent Patterns** (require keywords like `apiKey`, `api_key`):
- OAuth Tokens
- Environment variable assignments

**Standalone Patterns** (detected anywhere - comments, URLs, JSON, etc.):
- OpenAI/Anthropic API Keys (`sk-...`)
- GitHub Personal Access Tokens (`ghp_...`, `gho_...`, `ghs_...`)
- AWS Access Keys (`AKIA...`)
- SendGrid API Keys (`SG.xxxx`)
- Twilio Keys (`AC...`, `SK...`)
- Stripe Keys (`sk_live_...`, `pk_live_...`)
- Mailgun Keys (`key-xxxx`)
- Database URLs (`postgres://...`, `mysql://...`, `mongodb://...`)
- JWT Tokens (`eyJ...`)
- Private Keys (`-----BEGIN...`)

**Edge Cases Documented by Tests**:
- ✅ `sk-` API keys detected anywhere (comments, URLs, JSON, template literals)
- ✅ Standalone secrets (GitHub, AWS, SendGrid, Twilio, Stripe, Mailgun, DB URLs, JWT) always detected
- ✅ Works across different quote types (single, double, backticks)
- ✅ Detects consecutive secrets on multiple lines
- ✅ Private keys in `.pem`, `.key`, `.cert` files detected
- ✅ Unicode and emoji in files with secrets handled correctly
- ⚠️ Base64-encoded secrets not detected (can't detect all encodings - acceptable limitation)

**Known Limitations**:
- **Regex-Based** - Custom/unusual secret formats may not be detected
- **Context Sensitivity** - Some patterns require assignment context to reduce false positives
- **False Negatives** - Heavily obfuscated secrets might slip through
- **False Positives** - Aggressive patterns may flag non-secrets (use FALSE_POSITIVE_PATTERNS)
- **Performance** - Large files with many patterns may have some overhead

💡 **Design Philosophy**: We prioritize **not breaking your code** over catching 100% of secrets. Context-aware patterns prevent false positives in test files, examples, and documentation.

## Future Enhancements

- [ ] Add unit tests for all patterns and edge cases
- [ ] Support custom pattern configuration via `riflebird.config.ts`
- [ ] Add more provider-specific patterns (Azure, GCP, GitLab, etc.)
- [ ] Entropy-based detection for unknown secret formats
- [ ] Integration with secret scanning services (TruffleHog, GitGuardian)
- [ ] Whitelist mechanism for intentional "secrets" in test fixtures
