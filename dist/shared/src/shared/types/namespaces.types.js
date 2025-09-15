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
export var StaticNamespaces;
(function (StaticNamespaces) {
    StaticNamespaces["USER_PREFERENCES"] = "user-preferences";
    StaticNamespaces["REPOSITORIES"] = "repositories";
    StaticNamespaces["AI_CONFIGURATION"] = "ai-configuration";
    StaticNamespaces["LLM_MODELS"] = "llm-models";
    StaticNamespaces["CACHE"] = "cache";
    StaticNamespaces["TEMP"] = "temp";
    StaticNamespaces["AGENT_SESSIONS"] = "agent-sessions";
    StaticNamespaces["GLOBAL_SESSION_REGISTRY"] = "global-session-registry";
    StaticNamespaces["SESSION_SUMMARIES"] = "session-summaries";
    StaticNamespaces["ARCHIVE_CONFIGURATION"] = "archive-configuration";
    StaticNamespaces["AGENT_EVENT_INDEXES"] = "agent-event-indexes";
    StaticNamespaces["MCP_BRIDGE_DATA"] = "mcp-bridge-data";
    // Docker Management
    StaticNamespaces["DOCKER_CONTAINERS"] = "docker-containers";
    StaticNamespaces["DOCKER_SESSIONS"] = "docker-sessions";
    // Secrets Management
    StaticNamespaces["SECRETS_METADATA"] = "secrets-metadata";
})(StaticNamespaces || (StaticNamespaces = {}));
/**
 * Agent event namespaces used for per-agent event storage
 * These are dynamic namespaces created for each agent provider.
 */
export var AgentEventNamespaces;
(function (AgentEventNamespaces) {
    AgentEventNamespaces["CLAUDE"] = "claude-hook-events";
    AgentEventNamespaces["GEMINI"] = "gemini-hook-events";
    AgentEventNamespaces["OPENCODE"] = "opencode-hook-events";
})(AgentEventNamespaces || (AgentEventNamespaces = {}));
/**
 * Type guard to check if a string is a valid static namespace
 */
export function isStaticNamespace(namespace) {
    return Object.values(StaticNamespaces).includes(namespace);
}
/**
 * Type guard to check if a string is a valid agent event namespace
 */
export function isAgentEventNamespace(namespace) {
    return Object.values(AgentEventNamespaces).includes(namespace);
}
/**
 * Type guard to check if a string is any valid namespace
 */
export function isValidNamespace(namespace) {
    return isStaticNamespace(namespace) || isAgentEventNamespace(namespace);
}
