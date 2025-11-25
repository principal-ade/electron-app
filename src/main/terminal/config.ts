/**
 * Terminal Configuration
 *
 * Feature flags and configuration for terminal functionality
 */

export interface TerminalConfig {
  /**
   * Enable MessagePort architecture for direct PTY streaming
   * Phase 1: MessageChannels with PTY in main process
   * Phase 2: PTY in worker process
   */
  enableMessagePorts: boolean;

  /**
   * Maximum number of concurrent terminal sessions
   */
  maxSessions: number;

  /**
   * Buffer size for output replay (number of chunks to keep)
   */
  outputBufferSize: number;
}

// Default configuration
const defaultConfig: TerminalConfig = {
  enableMessagePorts: true, // Enabled for testing
  maxSessions: 20,
  outputBufferSize: 1000,
};

// Current configuration (can be overridden via environment variables)
export const terminalConfig: TerminalConfig = {
  enableMessagePorts:
    process.env.TERMINAL_ENABLE_MESSAGE_PORTS === 'true' ||
    defaultConfig.enableMessagePorts,
  maxSessions:
    parseInt(process.env.TERMINAL_MAX_SESSIONS || '', 10) ||
    defaultConfig.maxSessions,
  outputBufferSize:
    parseInt(process.env.TERMINAL_BUFFER_SIZE || '', 10) ||
    defaultConfig.outputBufferSize,
};

console.log('[Terminal Config] Configuration loaded:', {
  enableMessagePorts: terminalConfig.enableMessagePorts,
  maxSessions: terminalConfig.maxSessions,
  outputBufferSize: terminalConfig.outputBufferSize,
});

/**
 * Update configuration at runtime (for testing)
 */
export function setTerminalConfig(config: Partial<TerminalConfig>): void {
  Object.assign(terminalConfig, config);
  console.log('[Terminal Config] Configuration updated:', terminalConfig);
}
