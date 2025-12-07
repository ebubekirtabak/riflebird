import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { debug, info, warn, error, setDebug, setLogLevel, setPrefix, isDebugEnabled, createLogger } from '../log-util';

describe('log-util', () => {
  let consoleDebugSpy: MockInstance;
  let consoleInfoSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset logger state
    setDebug(false);
    setLogLevel('info');
    setPrefix('[Riflebird]');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug logging', () => {
    it('should not log debug messages when debug is disabled', () => {
      setDebug(false);
      debug('test message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when debug is enabled', () => {
      setDebug(true);
      setLogLevel('debug');
      debug('test message');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[Riflebird] test message');
    });

    it('should log debug messages with additional arguments', () => {
      setDebug(true);
      setLogLevel('debug');
      const obj = { key: 'value' };
      debug('test message', obj);

      expect(consoleDebugSpy).toHaveBeenCalledWith('[Riflebird] test message', obj);
    });
  });

  describe('info logging', () => {
    it('should log info messages by default', () => {
      info('info message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[Riflebird] info message');
    });

    it('should not log info messages when log level is warn or higher', () => {
      setLogLevel('warn');
      info('info message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn logging', () => {
    it('should log warn messages', () => {
      warn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Riflebird] warning message');
    });

    it('should log warn messages even when level is warn', () => {
      setLogLevel('warn');
      warn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should log error messages', () => {
      error('error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Riflebird] error message');
    });

    it('should always log error messages regardless of level', () => {
      setLogLevel('error');
      error('error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should allow changing debug mode', () => {
      expect(isDebugEnabled()).toBe(false);

      setDebug(true);
      expect(isDebugEnabled()).toBe(true);

      setDebug(false);
      expect(isDebugEnabled()).toBe(false);
    });

    it('should allow changing log prefix', () => {
      setPrefix('[MyApp]');
      info('test');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[MyApp] test');
    });

    it('should allow changing log level', () => {
      setLogLevel('error');
      info('info message');
      warn('warn message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      error('error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('createLogger', () => {
    it('should create a custom logger with debug enabled', () => {
      const customLogger = createLogger({ debug: true, prefix: '[Custom]' });
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      customLogger.setLevel('debug');
      customLogger.debug('custom message');

      expect(spy).toHaveBeenCalledWith('[Custom] custom message');
    });

    it('should create a custom logger with custom prefix', () => {
      const customLogger = createLogger({ prefix: '[Test]' });
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

      customLogger.info('test');

      expect(spy).toHaveBeenCalledWith('[Test] test');
    });

    it('should create a custom logger with custom log level', () => {
      const customLogger = createLogger({ level: 'warn' });
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      customLogger.info('info');
      customLogger.warn('warning');

      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      setLogLevel('warn');

      debug('debug');
      info('info');
      warn('warning');
      error('error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
