/**
 * Logger
 *
 * Simple logger for the PTY daemon.
 */
import { DEFAULT_LOG_LEVEL } from '../shared/pty-daemon/constants';
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
export class Logger {
    level;
    prefix;
    constructor(level = DEFAULT_LOG_LEVEL, prefix = '[pty-daemon]') {
        this.level = level;
        this.prefix = prefix;
    }
    setLevel(level) {
        this.level = level;
    }
    debug(...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.debug) {
            console.log(this.timestamp(), this.prefix, '[DEBUG]', ...args);
        }
    }
    info(...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.info) {
            console.log(this.timestamp(), this.prefix, '[INFO]', ...args);
        }
    }
    warn(...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.warn) {
            console.warn(this.timestamp(), this.prefix, '[WARN]', ...args);
        }
    }
    error(...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.error) {
            console.error(this.timestamp(), this.prefix, '[ERROR]', ...args);
        }
    }
    timestamp() {
        return new Date().toISOString();
    }
}
