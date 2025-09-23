/**
 * Legacy Event Types for Backward Compatibility
 *
 * These types were previously exported by @principal-ai/agent-monitoring
 * but have been removed in newer versions. We maintain them here for
 * compatibility during the migration to the new event format.
 */

import {
  NormalizedEventType,
  CommonToolName,
  NormalizedPathInfo,
  SupportedAgent,
} from '@principal-ai/agent-monitoring';

/**
 * Legacy normalized agent session event format
 * @deprecated Use UniversalAgentSessionEvent or RepoNormalizedUniversalAgentSessionEvent instead
 */
export interface NormalizedAgentSessionEvent {
  eventType: NormalizedEventType;
  sessionId: string;
  workingDirectory: string;
  normalizedWorkingDirectory?: string;
  timestamp: number;
  provider: SupportedAgent;
  toolName?: CommonToolName;
  toolInput?: unknown;
  toolOutput?: unknown;
  files?: NormalizedPathInfo[];
  data?: {
    prompt?: string;
    message?: string;
    stopHookActive?: boolean;
    trigger?: 'manual' | 'auto';
    customInstructions?: string;
    source?: 'startup' | 'resume' | 'clear';
    [key: string]: unknown;
  };
  raw?: unknown;
  transcriptPath?: string;
}

/**
 * Agent settings interface
 * @deprecated May be removed in future versions
 */
export interface AgentSettings {
  provider: SupportedAgent;
  enabled: boolean;
  settings?: Record<string, any>;
}