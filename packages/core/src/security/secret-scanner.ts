import {
  SECRET_PATTERNS,
  FALSE_POSITIVE_PATTERNS,
  SCANNABLE_EXTENSIONS,
  EXCLUDE_PATTERNS,
  type SecretType,
} from './secret-patterns';

export type DetectedSecret = {
  type: SecretType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
  description: string;
  redactedValue: string;
};

export type SanitizationResult = {
  sanitizedCode: string;
  secretsDetected: number;
  secrets: DetectedSecret[];
  originalLength: number;
  sanitizedLength: number;
};

export type ScanOptions = {
  filePath?: string;
  contextLines?: number; // Lines before/after to check for context
  preserveLength?: boolean; // Keep same string length when redacting
};

/**
 * Secret scanner that detects and redacts sensitive data from code
 */
export class SecretScanner {
  /**
   * Check if a file should be scanned based on extension and path
   */
  static shouldScanFile(filePath: string): boolean {
    // Check if file is in excluded paths
    if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath))) {
      return false;
    }

    // Check if file has scannable extension
    return SCANNABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
  }

  /**
   * Check if a detected value is likely a false positive
   */
  private static isFalsePositive(value: string): boolean {
    return FALSE_POSITIVE_PATTERNS.some((pattern) => pattern.test(value));
  }

  /**
   * Create redacted placeholder for a secret
   */
  private static createRedactedValue(
    type: SecretType,
    originalValue: string,
    preserveLength = false
  ): string {
    // Keep last 3 characters for debugging (if safe)
    const suffix = originalValue.length > 3 ? originalValue.slice(-3) : 'xxx';
    const placeholder = `[REDACTED_${type}_${suffix}]`;

    if (preserveLength && originalValue.length > placeholder.length) {
      // Pad with asterisks to match original length
      const padding = '*'.repeat(originalValue.length - placeholder.length);
      return placeholder + padding;
    }

    return placeholder;
  }

  /**
   * Get line and column number for a position in text
   */
  private static getLineAndColumn(text: string, position: number): { line: number; column: number } {
    const lines = text.substring(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * Scan code for secrets and return detected secrets
   */
  static scanForSecrets(code: string, options: ScanOptions = {}): DetectedSecret[] {
    const detected: DetectedSecret[] = [];
    const { filePath, preserveLength = false } = options;

    // Skip if file shouldn't be scanned
    if (filePath && !this.shouldScanFile(filePath)) {
      return detected;
    }

    // Scan with each pattern
    for (const pattern of SECRET_PATTERNS) {
      // Reset regex lastIndex
      pattern.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.pattern.exec(code)) !== null) {
        const fullMatch = match[0];
        // Use captured group if available, otherwise use full match
        const secretValue = match[1] || fullMatch;

        // Skip if it's a false positive
        if (this.isFalsePositive(secretValue)) {
          continue;
        }

        // Skip if context validation is required and fails
        if (pattern.contextRequired) {
          // Check surrounding context (simplified - could be enhanced)
          const contextStart = Math.max(0, match.index - 50);
          const contextEnd = Math.min(code.length, match.index + fullMatch.length + 50);
          const context = code.substring(contextStart, contextEnd);

          if (this.isFalsePositive(context)) {
            continue;
          }
        }

        const position = this.getLineAndColumn(code, match.index);
        const redactedValue = this.createRedactedValue(pattern.type, secretValue, preserveLength);

        detected.push({
          type: pattern.type,
          value: secretValue,
          start: match.index,
          end: match.index + fullMatch.length,
          line: position.line,
          column: position.column,
          description: pattern.description,
          redactedValue,
        });
      }
    }

    // Sort by position (descending) for easier replacement
    return detected.sort((a, b) => b.start - a.start);
  }

  /**
   * Sanitize code by replacing detected secrets with placeholders
   */
  static sanitize(code: string, options: ScanOptions = {}): SanitizationResult {
    const originalLength = code.length;
    const secrets = this.scanForSecrets(code, options);

    let sanitizedCode = code;

    // Replace secrets from end to start (to preserve indices)
    for (const secret of secrets) {
      const before = sanitizedCode.substring(0, secret.start);
      const after = sanitizedCode.substring(secret.end);

      // Replace the secret value within the match
      const originalSegment = sanitizedCode.substring(secret.start, secret.end);
      const sanitizedSegment = originalSegment.replace(secret.value, secret.redactedValue);

      sanitizedCode = before + sanitizedSegment + after;
    }

    return {
      sanitizedCode,
      secretsDetected: secrets.length,
      secrets,
      originalLength,
      sanitizedLength: sanitizedCode.length,
    };
  }

  /**
   * Quick check if code contains potential secrets (without full sanitization)
   */
  static hasSecrets(code: string, filePath?: string): boolean {
    if (filePath && !this.shouldScanFile(filePath)) {
      return false;
    }

    return SECRET_PATTERNS.some((pattern) => {
      pattern.pattern.lastIndex = 0;
      return pattern.pattern.test(code);
    });
  }
}
