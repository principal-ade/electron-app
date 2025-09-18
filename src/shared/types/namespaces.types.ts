/**
 * Storage Namespace Types
 * 
 * This file contains the namespace type definitions that are shared between
 * the main and renderer processes.
 */

/**
 * Static/predefined storage namespaces used throughout the application
 * These are the core namespaces that are always available.
 */
export enum StaticNamespaces {
  USER_PREFERENCES = 'user-preferences',
  REPOSITORIES = 'repositories',
  AI_CONFIGURATION = 'ai-configuration',
  LLM_MODELS = 'llm-models',
  CACHE = 'cache',
  TEMP = 'temp',
  AGENT_SESSIONS = 'agent-sessions',
  GLOBAL_SESSION_REGISTRY = 'global-session-registry',
  SESSION_SUMMARIES = 'session-summaries',
  ARCHIVE_CONFIGURATION = 'archive-configuration',
  AGENT_EVENT_INDEXES = 'agent-event-indexes',
  MCP_BRIDGE_DATA = 'mcp-bridge-data',
  
  // Docker Management
  DOCKER_CONTAINERS = 'docker-containers',
  DOCKER_SESSIONS = 'docker-sessions',
  
  // Secrets Management
  SECRETS_METADATA = 'secrets-metadata',
}

/**
 * Agent event namespaces used for per-agent event storage
 * These are dynamic namespaces created for each agent provider.
 */
export enum AgentEventNamespaces {
  CLAUDE = 'claude-hook-events',
  OPENCODE = 'opencode-hook-events',
  CLINE = 'cline-hook-events',
}

/**
 * Union type of all known namespaces (static + agent event namespaces)
 * This represents all possible storage namespaces in the system.
 */
export type StorageNamespaces = StaticNamespaces | AgentEventNamespaces;

/**
 * Type guard to check if a string is a valid static namespace
 */
export function isStaticNamespace(namespace: string): namespace is StaticNamespaces {
  return Object.values(StaticNamespaces).includes(namespace as StaticNamespaces);
}

/**
 * Type guard to check if a string is a valid agent event namespace
 */
export function isAgentEventNamespace(namespace: string): namespace is AgentEventNamespaces {
  return Object.values(AgentEventNamespaces).includes(namespace as AgentEventNamespaces);
}

/**
 * Type guard to check if a string is any valid namespace
 */
export function isValidNamespace(namespace: string): namespace is StorageNamespaces {
  return isStaticNamespace(namespace) || isAgentEventNamespace(namespace);
}