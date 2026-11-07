export type CodingAgentId = 'opencode' | 'claude' | 'cursor';

export interface TerminalStartupNotice {
  message: string;
  subtitle?: string;
  /** How long the notice may remain if the terminal produces no output. */
  timeoutMs?: number;
}
