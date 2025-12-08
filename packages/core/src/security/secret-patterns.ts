/**
 * Secret pattern definitions for detecting sensitive data in code
 */

export type SecretType =
  | 'API_KEY'
  | 'AWS_KEY'
  | 'GITHUB_TOKEN'
  | 'PRIVATE_KEY'
  | 'PASSWORD'
  | 'DATABASE_URL'
  | 'JWT_TOKEN'
  | 'OAUTH_TOKEN'
  | 'ENV_VAR'
  | 'SENDGRID_KEY'
  | 'TWILIO_KEY'
  | 'STRIPE_KEY'
  | 'MAILGUN_KEY';

export type SecretPattern = {
  type: SecretType;
  pattern: RegExp;
  description: string;
  contextRequired?: boolean; // Requires context validation to reduce false positives
};

/**
 * Comprehensive secret patterns with context-aware detection
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  // AWS Access Keys
  {
    type: 'AWS_KEY',
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: 'AWS Access Key ID',
  },
  {
    type: 'AWS_KEY',
    pattern: /(?:aws_secret_access_key|aws_session_token)\s*[:=]\s*["']([A-Za-z0-9/+=]{40,})["']/gi,
    description: 'AWS Secret Access Key',
  },

  // GitHub Tokens
  {
    type: 'GITHUB_TOKEN',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    description: 'GitHub Personal Access Token',
  },
  {
    type: 'GITHUB_TOKEN',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    description: 'GitHub OAuth Token',
  },
  {
    type: 'GITHUB_TOKEN',
    pattern: /ghs_[a-zA-Z0-9]{36}/g,
    description: 'GitHub Server Token',
  },

  // OpenAI/Anthropic API Keys (standalone detection for sk- prefix)
  {
    type: 'API_KEY',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    description: 'OpenAI/Anthropic API Key (sk- prefix)',
  },

  // SendGrid API Keys (format: SG.xxxx or SG.xxxx.yyyy for v3)
  {
    type: 'SENDGRID_KEY',
    pattern: /SG\.[a-zA-Z0-9_-]{22,}/g,
    description: 'SendGrid API Key',
  },

  // Twilio API Keys
  {
    type: 'TWILIO_KEY',
    pattern: /AC[a-zA-Z0-9]{32}/g,
    description: 'Twilio Account SID',
  },
  {
    type: 'TWILIO_KEY',
    pattern: /SK[a-zA-Z0-9]{32}/g,
    description: 'Twilio API Key SID',
  },

  // Stripe API Keys
  {
    type: 'STRIPE_KEY',
    pattern: /sk_(live|test)_[a-zA-Z0-9]{24,}/g,
    description: 'Stripe Secret Key',
  },
  {
    type: 'STRIPE_KEY',
    pattern: /pk_(live|test)_[a-zA-Z0-9]{24,}/g,
    description: 'Stripe Publishable Key',
  },

  // Mailgun API Keys
  {
    type: 'MAILGUN_KEY',
    pattern: /key-[a-z0-9]{32}/g,
    description: 'Mailgun API Key',
  },

  // Private Keys (SSH, RSA, etc.)
  {
    type: 'PRIVATE_KEY',
    pattern: /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----[\s\S]*?-----END (?:RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g,
    description: 'Private Key',
  },

  // Generic API Keys (high entropy strings)
  {
    type: 'API_KEY',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9_-]{32,})["']/gi,
    description: 'Generic API Key',
  },
  {
    type: 'API_KEY',
    pattern: /(?:secret[_-]?key|secretkey)\s*[:=]\s*["']([A-Za-z0-9_-]{32,})["']/gi,
    description: 'Secret Key',
  },

  // JWT Tokens
  {
    type: 'JWT_TOKEN',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    description: 'JWT Token',
  },

  // OAuth Tokens
  {
    type: 'OAUTH_TOKEN',
    pattern: /(?:oauth[_-]?token|access[_-]?token|bearer[_-]?token)\s*[:=]\s*["']([A-Za-z0-9_.]{20,})["']/gi,
    description: 'OAuth/Access Token',
  },

  // Database URLs
  {
    type: 'DATABASE_URL',
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s:]+:[^\s@]+@[^\s/]+(?::\d+)?\/[^\s]*/gi,
    description: 'Database Connection String',
  },

  // Passwords in code
  {
    type: 'PASSWORD',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([A-Za-z0-9!@#$%^&*()_+\-=[\]{};:,.<>?]{8,128})["']/gi,
    description: 'Password',
    contextRequired: true, // Need to verify it's not a placeholder
  },

  // Environment Variables (specific patterns)
  {
    type: 'ENV_VAR',
    pattern: /process\.env\.[A-Z_]+\s*=\s*["']([^"'\s]{10,})["']/g,
    description: 'Environment Variable Assignment',
  },
];

/**
 * Context patterns that indicate a value is likely NOT a real secret
 */
export const FALSE_POSITIVE_PATTERNS = [
  /example/i,
  /placeholder/i,
  /your[_-]?key/i,
  /your[_-]?token/i,
  /your[_-]?password/i,
  /test[_-]?key/i,
  /dummy/i,
  /fake/i,
  /sample/i,
  /xxx+/i,
  /\*\*\*/,
  /\[REDACTED/,
];

/**
 * File extensions to scan for secrets
 */
export const SCANNABLE_EXTENSIONS = [
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.php',
  '.env',
  '.config',
  '.json',
  '.yaml',
  '.yml',
  '.pem',
  '.key',
  '.cert',
];

/**
 * Patterns to exclude from scanning
 */
export const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.min\./,
  /\.map$/,
];
