// Export branding constants for MCP
export { BRANDING, getMcpFallbackPath } from '../constants/branding';
// Export installation directory constant
export const CUSTOM_INSTALL_DIRECTORY = 'custom-installs';
export { isToolEvent, isStopEvent, } from './hooks/types/NormalizedAgentSessionEvent';
// Export path normalization types and utilities (types only - no Node.js dependencies)
export { PathContext, FileOperation, getFileOperation, extractFilePathsFromToolInput, isAbsolutePath, classifyPath, } from './hooks/types/PathNormalization';
// PathNormalizer moved to electron-react/src/main/agent-session-events/PathNormalizer.ts
// since it requires Node.js path module and is only used in main process
export { SUPPORTED_AGENTS, SupportedAgent, AGENT_INFO, getAgentInfo, } from './supported-agents';
// Add Parse
// Re-export hook configuration utilities
export { 
// Hook types
CLAUDE_HOOK_TYPES, GEMINI_HOOK_TYPES, OPENCODE_HOOK_TYPES, 
// Functions that are actually used
configureAgentHooks, removeAgentHooks, hasAgentHook, countAgentHooks, getClaudeHookScripts, getAvailableHookTypes, getHookTypeDisplayName, getHookTypeDescription, hookTypeUsesMatchers, getDefaultMatcher, } from './hooks/agent-config';
/**
 * Convert OpenCode hook format to normalized format
 */
export function convertOpenCodeToNormalized(openCodeHooks) {
    const normalized = {};
    for (const [hookType, hooks] of Object.entries(openCodeHooks)) {
        normalized[hookType] = hooks.map(hook => ({
            matcher: '*', // OpenCode doesn't use matchers
            hooks: [
                {
                    type: 'command',
                    command: Array.isArray(hook.command) ? hook.command.join(' ') : hook.command,
                },
            ],
        }));
    }
    return normalized;
}
/**
 * Convert normalized hook format to OpenCode format
 */
export function convertNormalizedToOpenCode(normalizedHooks) {
    const openCode = {};
    for (const [hookType, hooks] of Object.entries(normalizedHooks)) {
        openCode[hookType] = hooks.map(hook => {
            const command = hook.hooks?.[0]?.command || '';
            return {
                command: command.includes(' ') ? command.split(' ') : [command],
                environment: {
                    AGENT_HOOK_TRACK_ALL_TOOLS: 'true',
                },
            };
        });
    }
    return openCode;
}
// Re-export MCP configuration utilities
export { 
// Functions that are actually used
configureAgentMCP, removeAgentMCP, hasAgentMCP, countAgentMCPServers, } from './mcp/mcp-config';
// Re-export event processors
export { ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor, } from './hooks/event-processors';
