export { SecretScanner, type DetectedSecret, type SanitizationResult, type ScanOptions } from './secret-scanner';
export { SanitizationLogger, sanitizationLogger, type SanitizationEvent } from './sanitization-logger';
export { SECRET_PATTERNS, FALSE_POSITIVE_PATTERNS, SCANNABLE_EXTENSIONS, EXCLUDE_PATTERNS, type SecretType, type SecretPattern } from './secret-patterns';

import { SecretScanner } from './secret-scanner';
import { sanitizationLogger } from './sanitization-logger';


/**
 * Convenience function to sanitize code with logging
 */
export function sanitizeCode(code: string, filePath?: string): string {
  const result = SecretScanner.sanitize(code, { filePath });

  if (result.secretsDetected > 0) {
    sanitizationLogger.logSanitization(result, filePath);
  }

  return result.sanitizedCode;
}
