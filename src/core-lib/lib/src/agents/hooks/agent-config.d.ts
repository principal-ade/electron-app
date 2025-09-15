/**
 * Agent Configuration Utilities
 * Functions for configuring agent settings with hooks
 */
import type { SupportedAgent } from '../';
/**
 * Hook types supported by Claude
 */
export declare const CLAUDE_HOOK_TYPES: readonly ["PreToolUse", "PostToolUse", "Notification", "Stop", "SubagentStop"];
export type ClaudeHookType = (typeof CLAUDE_HOOK_TYPES)[number];
/**
 * Hook types supported by Gemini
 */
export declare const GEMINI_HOOK_TYPES: readonly ["PreToolUse", "PostToolUse", "Stop", "Notification", "SubagentStop", "PreCompact"];
export type GeminiHookType = (typeof GEMINI_HOOK_TYPES)[number];
/**
 * Hook configuration for a specific hook type
 */
export interface HookMatcher {
    matcher: string;
    hooks: Array<{
        type: 'command';
        command: string;
        timeout?: number;
    }>;
}
/**
 * Claude hooks configuration
 */
export interface ClaudeHooksConfig {
    PreToolUse?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    Notification?: HookMatcher[];
    Stop?: HookMatcher[];
    SubagentStop?: HookMatcher[];
}
/**
 * Claude settings structure
 */
export interface ClaudeSettings {
    hooks?: ClaudeHooksConfig;
    mcpServers?: Record<string, any>;
    [key: string]: unknown;
}
/**
 * Claude settings structure
 */
export interface ClaudeDotJson {
    mcpServers?: Record<string, any>;
    [key: string]: unknown;
}
/**
 * Configure hooks for Claude agent
 * Adds or updates hooks configuration to register all hook types with the provided script
 *
 * @param settings - Current Claude settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns Modified settings object with hooks configured
 */
export declare function configureClaudeHooks(settings: ClaudeSettings, hookScriptPath: string): ClaudeSettings;
/**
 * Remove hooks configuration for a specific script
 *
 * @param settings - Current Claude settings object
 * @param hookScriptPath - Full path to the hook script to remove
 * @returns Modified settings object with hooks removed
 */
export declare function removeClaudeHooks(settings: ClaudeSettings, hookScriptPath: string): ClaudeSettings;
/**
 * Check if a settings object has a specific hook script configured
 *
 * @param settings - Claude settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns True if the hook script is configured
 */
export declare function hasClaudeHook(settings: ClaudeSettings, hookScriptPath: string): boolean;
/**
 * Count total number of hooks configured
 *
 * @param settings - Claude settings object
 * @returns Total number of hook commands configured
 */
export declare function countClaudeHooks(settings: ClaudeSettings): number;
/**
 * Get all unique hook scripts configured
 *
 * @param settings - Claude settings object
 * @returns Array of unique hook script paths
 */
export declare function getClaudeHookScripts(settings: ClaudeSettings): string[];
/**
 * Gemini hook matcher - can be string or object
 */
export type GeminiMatcher = string | {
    tools?: string[];
};
/**
 * Gemini hook configuration
 */
export interface GeminiHookConfig {
    matcher: GeminiMatcher;
    hooks: Array<{
        type: 'command';
        command: string;
        timeout?: number;
    }>;
}
/**
 * Gemini hooks configuration
 */
export interface GeminiHooksConfig {
    PreToolUse?: GeminiHookConfig[];
    PostToolUse?: GeminiHookConfig[];
    Stop?: GeminiHookConfig[];
    Notification?: GeminiHookConfig[];
    SubagentStop?: GeminiHookConfig[];
    PreCompact?: GeminiHookConfig[];
}
/**
 * Gemini settings structure
 */
export interface GeminiSettings {
    version?: string;
    hooks?: GeminiHooksConfig;
    mcpServers?: Record<string, any>;
    [key: string]: unknown;
}
/**
 * Configure hooks for Gemini agent
 */
export declare function configureGeminiHooks(settings: GeminiSettings, hookScriptPath: string): GeminiSettings;
/**
 * Remove hooks from Gemini configuration
 */
export declare function removeGeminiHooks(settings: GeminiSettings, hookScriptPath: string): GeminiSettings;
/**
 * Check if Gemini has hooks configured
 */
export declare function hasGeminiHook(settings: GeminiSettings, hookScriptPath: string): boolean;
/**
 * Count Gemini hooks
 */
export declare function countGeminiHooks(settings: GeminiSettings): number;
/**
 * OpenCode hook types
 */
export declare const OPENCODE_HOOK_TYPES: readonly ["tool_call", "file_read", "file_edited", "web_access", "session_stop"];
export type OpenCodeHookType = (typeof OPENCODE_HOOK_TYPES)[number];
/**
 * OpenCode hook command configuration
 */
export interface OpenCodeHookCommand {
    command: string[];
    environment?: Record<string, string>;
}
/**
 * OpenCode hooks configuration (under experimental.hook)
 */
export interface OpenCodeHooksConfig {
    tool_call?: OpenCodeHookCommand[];
    file_read?: OpenCodeHookCommand[];
    file_edited?: OpenCodeHookCommand[];
    web_access?: OpenCodeHookCommand[];
    session_stop?: OpenCodeHookCommand[];
}
/**
 * OpenCode settings structure
 */
export interface OpenCodeSettings {
    experimental?: {
        anthropicHooks?: OpenCodeHooksConfig;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Configure hooks for OpenCode agent
 */
export declare function configureOpenCodeHooks(settings: OpenCodeSettings, hookScriptPath: string): OpenCodeSettings;
/**
 * Remove hooks from OpenCode configuration
 */
export declare function removeOpenCodeHooks(settings: OpenCodeSettings, hookScriptPath: string): OpenCodeSettings;
/**
 * Check if OpenCode has hooks configured
 */
export declare function hasOpenCodeHook(settings: OpenCodeSettings, hookScriptPath: string): boolean;
/**
 * Count OpenCode hooks
 */
export declare function countOpenCodeHooks(settings: OpenCodeSettings): number;
/**
 * Combined hook type for all agents
 */
export type HookType = ClaudeHookType | GeminiHookType | OpenCodeHookType;
/**
 * Get the display name for a hook type
 */
export declare function getHookTypeDisplayName(hookType: HookType): string;
/**
 * Get the description for a hook type
 */
export declare function getHookTypeDescription(hookType: HookType): string;
/**
 * Check if a hook type uses matchers
 * Some hook types (like Stop) don't use matchers
 */
export declare function hookTypeUsesMatchers(hookType: HookType): boolean;
/**
 * Get the default matcher for a hook type
 */
export declare function getDefaultMatcher(hookType: HookType): string;
/**
 * Get available hook types for a specific agent
 */
export declare function getAvailableHookTypes(agent: SupportedAgent): readonly HookType[];
/**
 * Generic agent settings interface
 */
export interface AgentSettings {
    [key: string]: unknown;
}
/**
 * Configure hooks for any supported agent
 * This is a generic function that delegates to agent-specific implementations
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns Modified settings object with hooks configured
 */
export declare function configureAgentHooks(agent: SupportedAgent, settings: AgentSettings, hookScriptPath: string): AgentSettings;
/**
 * Remove hooks configuration for any supported agent
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param hookScriptPath - Full path to the hook script to remove
 * @returns Modified settings object with hooks removed
 */
export declare function removeAgentHooks(agent: SupportedAgent, settings: AgentSettings, hookScriptPath: string): AgentSettings;
/**
 * Check if an agent has a specific hook script configured
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns True if the hook script is configured
 */
export declare function hasAgentHook(agent: SupportedAgent, settings: AgentSettings, hookScriptPath: string): boolean;
/**
 * Count total number of hooks configured for an agent
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @returns Total number of hook commands configured
 */
export declare function countAgentHooks(agent: SupportedAgent, settings: AgentSettings): number;
//# sourceMappingURL=agent-config.d.ts.map