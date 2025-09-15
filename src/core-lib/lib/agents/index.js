"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeEventProcessor = exports.GeminiEventProcessor = exports.ClaudeEventProcessor = exports.countAgentMCPServers = exports.hasAgentMCP = exports.removeAgentMCP = exports.configureAgentMCP = exports.getDefaultMatcher = exports.hookTypeUsesMatchers = exports.getHookTypeDescription = exports.getHookTypeDisplayName = exports.getAvailableHookTypes = exports.getClaudeHookScripts = exports.countAgentHooks = exports.hasAgentHook = exports.removeAgentHooks = exports.configureAgentHooks = exports.OPENCODE_HOOK_TYPES = exports.GEMINI_HOOK_TYPES = exports.CLAUDE_HOOK_TYPES = exports.getAgentInfo = exports.AGENT_INFO = exports.SupportedAgent = exports.SUPPORTED_AGENTS = exports.classifyPath = exports.isAbsolutePath = exports.extractFilePathsFromToolInput = exports.getFileOperation = exports.FileOperation = exports.PathContext = exports.isStopEvent = exports.isToolEvent = exports.CUSTOM_INSTALL_DIRECTORY = exports.getMcpFallbackPath = exports.BRANDING = void 0;
exports.convertOpenCodeToNormalized = convertOpenCodeToNormalized;
exports.convertNormalizedToOpenCode = convertNormalizedToOpenCode;
// Export branding constants for MCP
var branding_1 = require("../constants/branding");
Object.defineProperty(exports, "BRANDING", { enumerable: true, get: function () { return branding_1.BRANDING; } });
Object.defineProperty(exports, "getMcpFallbackPath", { enumerable: true, get: function () { return branding_1.getMcpFallbackPath; } });
// Export installation directory constant
exports.CUSTOM_INSTALL_DIRECTORY = 'custom-installs';
var NormalizedAgentSessionEvent_1 = require("./hooks/types/NormalizedAgentSessionEvent");
Object.defineProperty(exports, "isToolEvent", { enumerable: true, get: function () { return NormalizedAgentSessionEvent_1.isToolEvent; } });
Object.defineProperty(exports, "isStopEvent", { enumerable: true, get: function () { return NormalizedAgentSessionEvent_1.isStopEvent; } });
// Export path normalization types and utilities (types only - no Node.js dependencies)
var PathNormalization_1 = require("./hooks/types/PathNormalization");
Object.defineProperty(exports, "PathContext", { enumerable: true, get: function () { return PathNormalization_1.PathContext; } });
Object.defineProperty(exports, "FileOperation", { enumerable: true, get: function () { return PathNormalization_1.FileOperation; } });
Object.defineProperty(exports, "getFileOperation", { enumerable: true, get: function () { return PathNormalization_1.getFileOperation; } });
Object.defineProperty(exports, "extractFilePathsFromToolInput", { enumerable: true, get: function () { return PathNormalization_1.extractFilePathsFromToolInput; } });
Object.defineProperty(exports, "isAbsolutePath", { enumerable: true, get: function () { return PathNormalization_1.isAbsolutePath; } });
Object.defineProperty(exports, "classifyPath", { enumerable: true, get: function () { return PathNormalization_1.classifyPath; } });
// PathNormalizer moved to electron-react/src/main/agent-session-events/PathNormalizer.ts
// since it requires Node.js path module and is only used in main process
var supported_agents_1 = require("./supported-agents");
Object.defineProperty(exports, "SUPPORTED_AGENTS", { enumerable: true, get: function () { return supported_agents_1.SUPPORTED_AGENTS; } });
Object.defineProperty(exports, "SupportedAgent", { enumerable: true, get: function () { return supported_agents_1.SupportedAgent; } });
Object.defineProperty(exports, "AGENT_INFO", { enumerable: true, get: function () { return supported_agents_1.AGENT_INFO; } });
Object.defineProperty(exports, "getAgentInfo", { enumerable: true, get: function () { return supported_agents_1.getAgentInfo; } });
// Add Parse
// Re-export hook configuration utilities
var agent_config_1 = require("./hooks/agent-config");
// Hook types
Object.defineProperty(exports, "CLAUDE_HOOK_TYPES", { enumerable: true, get: function () { return agent_config_1.CLAUDE_HOOK_TYPES; } });
Object.defineProperty(exports, "GEMINI_HOOK_TYPES", { enumerable: true, get: function () { return agent_config_1.GEMINI_HOOK_TYPES; } });
Object.defineProperty(exports, "OPENCODE_HOOK_TYPES", { enumerable: true, get: function () { return agent_config_1.OPENCODE_HOOK_TYPES; } });
// Functions that are actually used
Object.defineProperty(exports, "configureAgentHooks", { enumerable: true, get: function () { return agent_config_1.configureAgentHooks; } });
Object.defineProperty(exports, "removeAgentHooks", { enumerable: true, get: function () { return agent_config_1.removeAgentHooks; } });
Object.defineProperty(exports, "hasAgentHook", { enumerable: true, get: function () { return agent_config_1.hasAgentHook; } });
Object.defineProperty(exports, "countAgentHooks", { enumerable: true, get: function () { return agent_config_1.countAgentHooks; } });
Object.defineProperty(exports, "getClaudeHookScripts", { enumerable: true, get: function () { return agent_config_1.getClaudeHookScripts; } });
Object.defineProperty(exports, "getAvailableHookTypes", { enumerable: true, get: function () { return agent_config_1.getAvailableHookTypes; } });
Object.defineProperty(exports, "getHookTypeDisplayName", { enumerable: true, get: function () { return agent_config_1.getHookTypeDisplayName; } });
Object.defineProperty(exports, "getHookTypeDescription", { enumerable: true, get: function () { return agent_config_1.getHookTypeDescription; } });
Object.defineProperty(exports, "hookTypeUsesMatchers", { enumerable: true, get: function () { return agent_config_1.hookTypeUsesMatchers; } });
Object.defineProperty(exports, "getDefaultMatcher", { enumerable: true, get: function () { return agent_config_1.getDefaultMatcher; } });
/**
 * Convert OpenCode hook format to normalized format
 */
function convertOpenCodeToNormalized(openCodeHooks) {
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
function convertNormalizedToOpenCode(normalizedHooks) {
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
var mcp_config_1 = require("./mcp/mcp-config");
// Functions that are actually used
Object.defineProperty(exports, "configureAgentMCP", { enumerable: true, get: function () { return mcp_config_1.configureAgentMCP; } });
Object.defineProperty(exports, "removeAgentMCP", { enumerable: true, get: function () { return mcp_config_1.removeAgentMCP; } });
Object.defineProperty(exports, "hasAgentMCP", { enumerable: true, get: function () { return mcp_config_1.hasAgentMCP; } });
Object.defineProperty(exports, "countAgentMCPServers", { enumerable: true, get: function () { return mcp_config_1.countAgentMCPServers; } });
// Re-export event processors
var event_processors_1 = require("./hooks/event-processors");
Object.defineProperty(exports, "ClaudeEventProcessor", { enumerable: true, get: function () { return event_processors_1.ClaudeEventProcessor; } });
Object.defineProperty(exports, "GeminiEventProcessor", { enumerable: true, get: function () { return event_processors_1.GeminiEventProcessor; } });
Object.defineProperty(exports, "OpenCodeEventProcessor", { enumerable: true, get: function () { return event_processors_1.OpenCodeEventProcessor; } });
