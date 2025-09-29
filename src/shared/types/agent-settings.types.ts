import type { SupportedAgent } from '@principal-ai/agent-monitoring';

/**
 * Shared agent settings interface used across main and renderer processes.
 */
export interface AgentSettings {
  provider: SupportedAgent;
  enabled: boolean;
  settings?: Record<string, unknown>;
}
