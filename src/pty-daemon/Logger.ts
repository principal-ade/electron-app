/**
 * Logger
 *
 * Simple logger for the PTY daemon.
 */

import { LogLevel, DEFAULT_LOG_LEVEL } from '../shared/pty-daemon/constants';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(level: LogLevel = DEFAULT_LOG_LEVEL, prefix: string = '[pty-daemon]') {
    this.level = level;
    this.prefix = prefix;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.debug) {
      console.info(this.timestamp(), this.prefix, '[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.info) {
      console.info(this.timestamp(), this.prefix, '[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.warn) {
      console.warn(this.timestamp(), this.prefix, '[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.error) {
      console.error(this.timestamp(), this.prefix, '[ERROR]', ...args);
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}
