import crypto from 'node:crypto';
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
   * Uses a hash-based identifier instead of exposing actual secret characters
   */
  private static createRedactedValue(
    type: SecretType,
    originalValue: string,
    preserveLength = false
  ): string {
    // Use SHA-256 hash for a stable, unique identifier that doesn't expose secret content
    // Take first 6 characters of hash for readability while maintaining uniqueness
    const hash = crypto.createHash('sha256').update(originalValue).digest('hex').slice(0, 6);
    const placeholder = `[REDACTED_${type}_${hash}]`;

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
    // Build sanitized output by iterating the original code and applying
    // non-overlapping replacements. This avoids index-shift problems when
    // multiple detected secrets overlap. We prefer the earliest detection
    // and in case of identical starts, the longest match.
    const original = code;

    // Sort ascending by start, and prefer longer matches when starts are equal
    const ordered = [...secrets].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end; // longer first
    });

    let result = '';
    let cursor = 0;
    const appliedSecrets: DetectedSecret[] = [];

    for (const secret of ordered) {
      // Skip if this secret overlaps with previously applied replacement
      if (secret.start < cursor) continue;

      // Append unchanged text up to the secret
      result += original.slice(cursor, secret.start);

      // Extract the original segment and replace the detected secret value
      const originalSegment = original.slice(secret.start, secret.end);
      const sanitizedSegment = originalSegment.replace(secret.value, secret.redactedValue);

      result += sanitizedSegment;
      appliedSecrets.push(secret);

      // Advance cursor past the replaced segment
      cursor = secret.end;
    }

    // Append any remaining text
    result += original.slice(cursor);

    return {
      sanitizedCode: result,
      secretsDetected: appliedSecrets.length,
      secrets: appliedSecrets,
      originalLength,
      sanitizedLength: result.length,
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
      return code.match(pattern.pattern) !== null;
    });
  }
}
