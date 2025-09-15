/**
 * MCP (Model Context Protocol) Configuration Utilities
 * Functions for configuring MCP servers in agent settings
 */
import type { SupportedAgent } from '../';
import type { ClaudeDotJson, ClaudeSettings } from '../hooks/agent-config';
/**
 * MCP Server configuration for Claude
 */
export interface ClaudeMCPServerConfig {
    type: 'stdio';
    command: string;
    args: string[];
    env: Record<string, string>;
}
/**
 * Claude MCP configuration structure
 */
export interface ClaudeMCPConfig {
    mcpServers?: Record<string, ClaudeMCPServerConfig>;
    [key: string]: unknown;
}
/**
 * Configure MCP server for Claude globally
 * Note: Claude uses a global mcpServers object, not project-specific
 *
 * @param settings - Current Claude settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export declare function configureClaudeMCP(settings: ClaudeDotJson, serverName: string, serverPath: string): ClaudeDotJson;
/**
 * Remove MCP server from Claude configuration
 *
 * @param settings - Current Claude settings object
 * @param serverName - Name of the MCP server to remove
 * @returns Modified settings object with MCP server removed
 */
export declare function removeClaudeMCP(settings: ClaudeDotJson, serverName: string): ClaudeSettings;
/**
 * Check if Claude has a specific MCP server configured
 *
 * @param settings - Claude settings object
 * @param serverName - Name of the MCP server to check
 * @returns True if the MCP server is configured
 */
export declare function hasClaudeMCP(settings: ClaudeDotJson, serverName: string): boolean;
/**
 * Get all configured MCP servers for Claude
 *
 * @param settings - Claude settings object
 * @returns Object containing all configured MCP servers
 */
export declare function getClaudeMCPServers(settings: ClaudeDotJson): Record<string, ClaudeMCPServerConfig>;
/**
 * Count total number of MCP servers configured for Claude
 *
 * @param settings - Claude settings object
 * @returns Total number of MCP servers configured
 */
export declare function countClaudeMCPServers(settings: ClaudeDotJson): number;
/**
 * Configure MCP server for Gemini
 * Gemini uses a similar structure to Claude but with trust field
 *
 * @param settings - Current Gemini settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export declare function configureGeminiMCP(settings: GeminiSettings, serverName: string, serverPath: string): GeminiSettings;
/**
 * Remove MCP server from Gemini configuration
 */
export declare function removeGeminiMCP(settings: GeminiSettings, serverName: string): GeminiSettings;
/**
 * Check if Gemini has a specific MCP server configured
 */
export declare function hasGeminiMCP(settings: GeminiSettings, serverName: string): boolean;
/**
 * Count total number of MCP servers configured for Gemini
 */
export declare function countGeminiMCPServers(settings: GeminiSettings): number;
/**
 * Configure MCP server for OpenCode
 * OpenCode uses mcpServers at root level similar to Claude
 *
 * @param settings - Current OpenCode settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export declare function configureOpenCodeMCP(settings: OpenCodeSettings, serverName: string, serverPath: string): OpenCodeSettings;
/**
 * Remove MCP server from OpenCode configuration
 */
export declare function removeOpenCodeMCP(settings: OpenCodeSettings, serverName: string): OpenCodeSettings;
/**
 * Check if OpenCode has a specific MCP server configured
 */
export declare function hasOpenCodeMCP(settings: OpenCodeSettings, serverName: string): boolean;
/**
 * Count total number of MCP servers configured for OpenCode
 */
export declare function countOpenCodeMCPServers(settings: OpenCodeSettings): number;
/**
 * Gemini MCP server configuration
 */
export interface GeminiMCPServerConfig {
    command: string;
    args: string[];
    env: Record<string, string>;
    trust?: boolean;
}
/**
 * Gemini settings structure with MCP
 */
export interface GeminiSettings {
    mcpServers?: Record<string, GeminiMCPServerConfig>;
    [key: string]: unknown;
}
/**
 * OpenCode MCP server configuration
 * OpenCode uses mcpServers at the root level similar to Claude
 */
export interface OpenCodeMCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}
/**
 * OpenCode settings structure with MCP
 */
export interface OpenCodeSettings {
    mcp?: Record<string, OpenCodeMCPServerConfig>;
    experimental?: {
        anthropicHooks?: any;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Generic agent settings interface for MCP configuration
 */
export interface AgentMCPSettings {
    mcpServers?: Record<string, any>;
    mcp?: Record<string, any>;
    [key: string]: unknown;
}
/**
 * Configure MCP server for any supported agent
 * This is a generic function that delegates to agent-specific implementations
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export declare function configureAgentMCP(agent: SupportedAgent, settings: AgentMCPSettings, serverName: string, serverPath: string): AgentMCPSettings;
/**
 * Remove MCP server for any supported agent
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param serverName - Name of the MCP server to remove
 * @returns Modified settings object with MCP server removed
 */
export declare function removeAgentMCP(agent: SupportedAgent, settings: AgentMCPSettings, serverName: string): AgentMCPSettings;
/**
 * Check if agent has a specific MCP server configured
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @param serverName - Name of the MCP server to check
 * @returns True if the MCP server is configured
 */
export declare function hasAgentMCP(agent: SupportedAgent, settings: AgentMCPSettings, serverName: string): boolean;
/**
 * Count total number of MCP servers configured for an agent
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @returns Total number of MCP servers configured
 */
export declare function countAgentMCPServers(agent: SupportedAgent, settings: AgentMCPSettings): number;
//# sourceMappingURL=mcp-config.d.ts.map