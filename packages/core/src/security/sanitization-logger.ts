import type { DetectedSecret, SanitizationResult } from './secret-scanner';
import type { SecretType } from './secret-patterns';

export type SanitizationEvent = {
  timestamp: Date;
  filePath?: string;
  secretsDetected: number;
  // Not all secret types will be present in every event; use Partial
  secretTypes: Partial<Record<SecretType, number>>;
  originalLength: number;
  sanitizedLength: number;
};

/**
 * Logger for sanitization events - NEVER logs actual secret values
 */
export class SanitizationLogger {
  private events: SanitizationEvent[] = [];
  private static readonly MAX_EVENTS = 1000; // Prevent unbounded growth

  /**
   * Log a sanitization operation
   */
  logSanitization(result: SanitizationResult, filePath?: string): void {
    // Count secrets by type
    const secretTypes = result.secrets.reduce(
      (acc, secret) => {
        acc[secret.type] = (acc[secret.type] || 0) + 1;
        return acc;
      },
      {} as Partial<Record<SecretType, number>>
    );

    const event: SanitizationEvent = {
      timestamp: new Date(),
      filePath,
      secretsDetected: result.secretsDetected,
      secretTypes,
      originalLength: result.originalLength,
      sanitizedLength: result.sanitizedLength,
    };

    this.events.push(event);

    // Trim old events if exceeding limit
    if (this.events.length > SanitizationLogger.MAX_EVENTS) {
      this.events = this.events.slice(-SanitizationLogger.MAX_EVENTS);
    }

    // Log to console (safe - no secret values)
    this.logToConsole(event);
  }

  /**
   * Log details of detected secrets (without values)
   */
  logDetectedSecrets(secrets: DetectedSecret[], filePath?: string): void {
    if (secrets.length === 0) {
      return;
    }

    const location = filePath ? ` in ${filePath}` : '';
    console.warn(`⚠️  Detected ${secrets.length} secret(s)${location}:`);

    // Group by type
    const byType = secrets.reduce(
      (acc, secret) => {
        if (!acc[secret.type]) {
          acc[secret.type] = [];
        }
        acc[secret.type].push(secret);
        return acc;
      },
      {} as Record<SecretType, DetectedSecret[]>
    );

    // Log each type
    for (const [type, typeSecrets] of Object.entries(byType)) {
      console.warn(`   - ${typeSecrets.length}x ${type} at lines: ${typeSecrets.map((s) => s.line).join(', ')}`);
    }
  }

  /**
   * Safe console logging (never includes actual secrets)
   */
  private logToConsole(event: SanitizationEvent): void {
    if (event.secretsDetected === 0) {
      return;
    }

    const location = event.filePath ? ` from ${event.filePath}` : '';
    const types = Object.entries(event.secretTypes)
      .map(([type, count]) => `${count}x ${type}`)
      .join(', ');

    console.warn(`🔒 Sanitized ${event.secretsDetected} secret(s)${location} [${types}]`);
  }

  /**
   * Get sanitization statistics
   */
  getStatistics(): {
    totalEvents: number;
    totalSecretsDetected: number;
    secretsByType: Record<SecretType, number>;
    mostRecentEvent?: SanitizationEvent;
  } {
    const totalSecretsDetected = this.events.reduce((sum, e) => sum + e.secretsDetected, 0);

    const secretsByType = this.events.reduce(
      (acc, event) => {
        for (const [type, count] of Object.entries(event.secretTypes)) {
          const cnt = typeof count === 'number' ? count : Number(count) || 0;
          acc[type as SecretType] = (acc[type as SecretType] || 0) + cnt;
        }
        return acc;
      },
      {} as Record<SecretType, number>
    );

    return {
      totalEvents: this.events.length,
      totalSecretsDetected,
      secretsByType,
      mostRecentEvent: this.events[this.events.length - 1],
    };
  }

  /**
   * Clear all logged events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get all sanitization events (for debugging)
   */
  getEvents(): readonly SanitizationEvent[] {
    return this.events;
  }
}

// Global singleton instance
export const sanitizationLogger = new SanitizationLogger();
