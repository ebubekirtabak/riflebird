export { SecretScanner, type DetectedSecret, type SanitizationResult, type ScanOptions } from './secret-scanner';
export {
  SanitizationLogger,
  sanitizationLogger,
  type SanitizationEvent,
} from './sanitization-logger';
export { SECRET_PATTERNS, FALSE_POSITIVE_PATTERNS, SCANNABLE_EXTENSIONS, EXCLUDE_PATTERNS, type SecretType, type SecretPattern } from './secret-patterns';

/**
 * Convenience function to sanitize code with logging
 */
export async function sanitizeCode(code: string, filePath?: string): Promise<string> {
  const { SecretScanner } = await import('./secret-scanner');
  const { sanitizationLogger } = await import('./sanitization-logger');

  const result = SecretScanner.sanitize(code, { filePath });

  if (result.secretsDetected > 0) {
    sanitizationLogger.logSanitization(result, filePath);
  }

  return result.sanitizedCode;
}
