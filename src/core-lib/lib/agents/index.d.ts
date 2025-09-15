export { type InstallationInfo } from './install-types';
export type { ClaudeConfigConfig, OpencodeConfigConfig } from './types';
export { BRANDING, getMcpFallbackPath } from '../constants/branding';
export type { BrandingConfig } from '../constants/branding';
export declare const CUSTOM_INSTALL_DIRECTORY = "custom-installs";
export { type NormalizedAgentSessionEvent, type NormalizedEventType, isToolEvent, isStopEvent, } from './hooks/types/NormalizedAgentSessionEvent';
export { PathContext, type NormalizedPathInfo, type RepositoryInfo, FileOperation, getFileOperation, extractFilePathsFromToolInput, isAbsolutePath, classifyPath, } from './hooks/types/PathNormalization';
export { SUPPORTED_AGENTS, SupportedAgent, AGENT_INFO, type AgentInfo, getAgentInfo, } from './supported-agents';
export { type AgentSettings, CLAUDE_HOOK_TYPES, GEMINI_HOOK_TYPES, OPENCODE_HOOK_TYPES, type ClaudeHookType, type GeminiHookType, type OpenCodeHookType, configureAgentHooks, removeAgentHooks, hasAgentHook, countAgentHooks, getClaudeHookScripts, getAvailableHookTypes, getHookTypeDisplayName, getHookTypeDescription, hookTypeUsesMatchers, getDefaultMatcher, type HookType, } from './hooks/agent-config';
export interface NormalizedHook {
    matcher: string;
    hooks: Array<{
        type: 'command';
        command: string;
    }>;
}
export interface OpenCodeHook {
    command: string | string[];
    environment?: Record<string, string>;
}
/**
 * Convert OpenCode hook format to normalized format
 */
export declare function convertOpenCodeToNormalized(openCodeHooks: Record<string, OpenCodeHook[]>): Record<string, NormalizedHook[]>;
/**
 * Convert normalized hook format to OpenCode format
 */
export declare function convertNormalizedToOpenCode(normalizedHooks: Record<string, NormalizedHook[]>): Record<string, OpenCodeHook[]>;
export { configureAgentMCP, removeAgentMCP, hasAgentMCP, countAgentMCPServers, } from './mcp/mcp-config';
export { type AgentEventProcessor, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor, } from './hooks/event-processors';
