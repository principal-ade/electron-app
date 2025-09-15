/**
 * All Storage Namespaces
 * 
 * This module defines all known storage namespaces including both:
 * 1. Static namespaces from the StaticNamespaces enum
 * 2. Dynamic agent event namespaces that are predetermined from agent configurations
 */

import { StaticNamespaces, AgentEventNamespaces, StorageNamespaces as SharedStorageNamespaces } from '../../shared/types/namespaces.types';
import { AGENT_INFO, SupportedAgent } from "@principal-ai/agent-monitoring";

/**
 * Agent event namespaces derived from agent configurations
 * These are "dynamic" in that they're not in the enum, but they're 
 * predetermined and known at compile time from the agent configurations
 */
export const AGENT_EVENT_NAMESPACES = {
  CLAUDE_EVENTS: AGENT_INFO[SupportedAgent.CLAUDE].storageEventsNamespace,
  GEMINI_EVENTS: AGENT_INFO[SupportedAgent.GEMINI].storageEventsNamespace,
  OPENCODE_EVENTS: AGENT_INFO[SupportedAgent.OPENCODE].storageEventsNamespace,
} as const;

/**
 * Type representing all agent event namespaces
 */
export type AgentEventNamespace = typeof AGENT_EVENT_NAMESPACES[keyof typeof AGENT_EVENT_NAMESPACES];

/**
 * Re-export the StorageNamespaces type from shared
 */
export type StorageNamespaces = SharedStorageNamespaces;


/**
 * Get all valid namespaces as an array
 */
export function getAllNamespaces(): StorageNamespaces[] {
  return [
    ...Object.values(StaticNamespaces),
    ...Object.values(AgentEventNamespaces)
  ] as StorageNamespaces[];
}


/**
 * Re-export type guards from shared
 */
export { isStaticNamespace, isAgentEventNamespace, isValidNamespace } from '../../shared/types/namespaces.types';