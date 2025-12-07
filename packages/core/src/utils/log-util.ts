export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LoggerOptions = {
  /** Enable debug mode - shows debug logs */
  debug?: boolean;
  /** Prefix for all log messages */
  prefix?: string;
  /** Minimum log level to display */
  level?: LogLevel;
};

type LoggerConfig = {
  debug: boolean;
  prefix: string;
  level: LogLevel;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor(options: LoggerOptions = {}) {
    this.config = {
      debug: options.debug ?? (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'),
      prefix: options.prefix ?? '[Riflebird]',
      level: options.level ?? 'info',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(message: string): string {
    return this.config.prefix ? `${this.config.prefix} ${message}` : message;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.config.debug && this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  setDebug(enabled: boolean): void {
    this.config.debug = enabled;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }

  isDebugEnabled(): boolean {
    return this.config.debug;
  }
}

// Default logger instance
const defaultLogger = new Logger();

// Export simple functions that use the default logger - use like console.log
export const debug = (message: string, ...args: unknown[]): void => {
  defaultLogger.debug(message, ...args);
};

export const info = (message: string, ...args: unknown[]): void => {
  defaultLogger.info(message, ...args);
};

export const warn = (message: string, ...args: unknown[]): void => {
  defaultLogger.warn(message, ...args);
};

export const error = (message: string, ...args: unknown[]): void => {
  defaultLogger.error(message, ...args);
};

// Configuration helpers
export const setDebug = (enabled: boolean): void => {
  defaultLogger.setDebug(enabled);
};

export const setLogLevel = (level: LogLevel): void => {
  defaultLogger.setLevel(level);
};

export const setPrefix = (prefix: string): void => {
  defaultLogger.setPrefix(prefix);
};

export const isDebugEnabled = (): boolean => {
  return defaultLogger.isDebugEnabled();
};

// Export logger instance for advanced usage
export const logger = defaultLogger;

// Create custom logger instance
export const createLogger = (options: LoggerOptions): Logger => {
  return new Logger(options);
};
