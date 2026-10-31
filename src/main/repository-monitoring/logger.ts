/**
 * Logging utility for the desktop repository monitoring adapter
 * Uses electron-log for persistent file-based logging
 */

import log from 'electron-log';
import * as path from 'path';

// Configure log levels (wrapped in try-catch for preload/renderer context where transports may not exist)
try {
  log.transports.file.level = 'debug';
  log.transports.file.format =
    '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.console.level = 'debug';
  log.transports.console.format =
    '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
} catch {
  // Transports not available in this context (e.g., preload scripts)
}

/**
 * Create a scoped logger with a prefix
 */
export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => {
      log.debug(`[${scope}]`, ...args);
    },
    info: (...args: unknown[]) => {
      log.info(`[${scope}]`, ...args);
    },
    warn: (...args: unknown[]) => {
      log.warn(`[${scope}]`, ...args);
    },
    error: (...args: unknown[]) => {
      log.error(`[${scope}]`, ...args);
    },
  };
}

/**
 * Get the log file path
 */
export function getLogFilePath(): string {
  try {
    const file = log.transports.file.getFile();
    return file.path;
  } catch {
    return 'unknown';
  }
}

/**
 * Configure main process logging
 */
export function configureMainLogging(): void {
  try {
    const fileName = 'repository-monitoring-manager.log';

    const file = log.transports.file.getFile();
    if (!file.path) {
      log.info(
        '[Logger] Main logging: using default path (getFile unavailable)',
      );
      return;
    }
    const defaultPath = file.path;
    const logDir = path.dirname(defaultPath);
    const mainLogPath = path.join(logDir, fileName);

    log.transports.file.resolvePathFn = () => mainLogPath;

    log.info('[Logger] Main process logging configured', { path: mainLogPath });
  } catch (error) {
    log.warn('[Logger] Main process logging configuration failed:', error);
  }
}
