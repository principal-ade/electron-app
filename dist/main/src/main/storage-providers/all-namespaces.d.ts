/**
 * All Storage Namespaces
 *
 * This module defines all known storage namespaces including both:
 * 1. Static namespaces from the StaticNamespaces enum
 * 2. Dynamic agent event namespaces that are predetermined from agent configurations
 */
import { StorageNamespaces as SharedStorageNamespaces } from '../../shared/types/namespaces.types';
/**
 * Agent event namespaces derived from agent configurations
 * These are "dynamic" in that they're not in the enum, but they're
 * predetermined and known at compile time from the agent configurations
 */
export declare const AGENT_EVENT_NAMESPACES: {
    readonly CLAUDE_EVENTS: string;
    readonly GEMINI_EVENTS: string;
    readonly OPENCODE_EVENTS: string;
};
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
export declare function getAllNamespaces(): StorageNamespaces[];
/**
 * Re-export type guards from shared
 */
export { isStaticNamespace, isAgentEventNamespace, isValidNamespace } from '../../shared/types/namespaces.types';
//# sourceMappingURL=all-namespaces.d.ts.map