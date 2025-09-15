/**
 * MCP (Model Context Protocol) Configuration Utilities
 * Functions for configuring MCP servers in agent settings
 */
/**
 * Configure MCP server for Claude globally
 * Note: Claude uses a global mcpServers object, not project-specific
 *
 * @param settings - Current Claude settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export function configureClaudeMCP(settings, serverName, serverPath) {
    // Create a copy of settings to avoid mutation
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    // Initialize mcpServers at root level if not present
    if (!updatedSettings.mcpServers) {
        updatedSettings.mcpServers = {};
    }
    // Add or update the MCP server configuration
    updatedSettings.mcpServers[serverName] = {
        type: 'stdio',
        command: 'node',
        args: [serverPath],
        env: {},
    };
    return updatedSettings;
}
/**
 * Remove MCP server from Claude configuration
 *
 * @param settings - Current Claude settings object
 * @param serverName - Name of the MCP server to remove
 * @returns Modified settings object with MCP server removed
 */
export function removeClaudeMCP(settings, serverName) {
    // Create a copy of settings to avoid mutation
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.mcpServers) {
        return updatedSettings;
    }
    // Remove the specified MCP server
    delete updatedSettings.mcpServers[serverName];
    // Remove mcpServers object if empty
    if (Object.keys(updatedSettings.mcpServers).length === 0) {
        delete updatedSettings.mcpServers;
    }
    return updatedSettings;
}
/**
 * Check if Claude has a specific MCP server configured
 *
 * @param settings - Claude settings object
 * @param serverName - Name of the MCP server to check
 * @returns True if the MCP server is configured
 */
export function hasClaudeMCP(settings, serverName) {
    return !!(settings.mcpServers && serverName in settings.mcpServers);
}
/**
 * Get all configured MCP servers for Claude
 *
 * @param settings - Claude settings object
 * @returns Object containing all configured MCP servers
 */
export function getClaudeMCPServers(settings) {
    return settings.mcpServers || {};
}
/**
 * Count total number of MCP servers configured for Claude
 *
 * @param settings - Claude settings object
 * @returns Total number of MCP servers configured
 */
export function countClaudeMCPServers(settings) {
    if (!settings.mcpServers) {
        return 0;
    }
    return Object.keys(settings.mcpServers).length;
}
/**
 * Configure MCP server for Gemini
 * Gemini uses a similar structure to Claude but with trust field
 *
 * @param settings - Current Gemini settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export function configureGeminiMCP(settings, serverName, serverPath) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    // Initialize mcpServers if not present
    if (!updatedSettings.mcpServers) {
        updatedSettings.mcpServers = {};
    }
    // Add or update the MCP server configuration
    updatedSettings.mcpServers[serverName] = {
        command: 'node',
        args: [serverPath],
        env: {},
        trust: false,
    };
    return updatedSettings;
}
/**
 * Remove MCP server from Gemini configuration
 */
export function removeGeminiMCP(settings, serverName) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.mcpServers) {
        return updatedSettings;
    }
    // Remove the specified MCP server
    delete updatedSettings.mcpServers[serverName];
    // Remove mcpServers object if empty
    if (Object.keys(updatedSettings.mcpServers).length === 0) {
        delete updatedSettings.mcpServers;
    }
    return updatedSettings;
}
/**
 * Check if Gemini has a specific MCP server configured
 */
export function hasGeminiMCP(settings, serverName) {
    return !!(settings.mcpServers && serverName in settings.mcpServers);
}
/**
 * Count total number of MCP servers configured for Gemini
 */
export function countGeminiMCPServers(settings) {
    if (!settings.mcpServers) {
        return 0;
    }
    return Object.keys(settings.mcpServers).length;
}
/**
 * Configure MCP server for OpenCode
 * OpenCode uses mcpServers at root level similar to Claude
 *
 * @param settings - Current OpenCode settings object
 * @param serverName - Name of the MCP server (e.g., 'principle-md')
 * @param serverPath - Full path to the MCP server script
 * @returns Modified settings object with MCP server configured
 */
export function configureOpenCodeMCP(settings, serverName, serverPath) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    // Initialize mcpServers if not present
    if (!updatedSettings.mcp) {
        updatedSettings.mcp = {};
    }
    // Add or update the MCP server configuration
    updatedSettings.mcp[serverName] = {
        command: 'node',
        args: [serverPath],
        env: {},
    };
    return updatedSettings;
}
/**
 * Remove MCP server from OpenCode configuration
 */
export function removeOpenCodeMCP(settings, serverName) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.mcp) {
        return updatedSettings;
    }
    // Remove the specified MCP server
    delete updatedSettings.mcp[serverName];
    // Remove mcpServers object if empty
    if (Object.keys(updatedSettings.mcp).length === 0) {
        delete updatedSettings.mcp;
    }
    return updatedSettings;
}
/**
 * Check if OpenCode has a specific MCP server configured
 */
export function hasOpenCodeMCP(settings, serverName) {
    return !!(settings.mcp && serverName in settings.mcp);
}
/**
 * Count total number of MCP servers configured for OpenCode
 */
export function countOpenCodeMCPServers(settings) {
    if (!settings.mcp) {
        return 0;
    }
    return Object.keys(settings.mcp).length;
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
export function configureAgentMCP(agent, settings, serverName, serverPath) {
    switch (agent) {
        case 'claude':
            return configureClaudeMCP(settings, serverName, serverPath);
        case 'gemini':
            return configureGeminiMCP(settings, serverName, serverPath);
        case 'opencode':
            return configureOpenCodeMCP(settings, serverName, serverPath);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
/**
 * Remove MCP server for any supported agent
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param serverName - Name of the MCP server to remove
 * @returns Modified settings object with MCP server removed
 */
export function removeAgentMCP(agent, settings, serverName) {
    switch (agent) {
        case 'claude':
            return removeClaudeMCP(settings, serverName);
        case 'gemini':
            return removeGeminiMCP(settings, serverName);
        case 'opencode':
            return removeOpenCodeMCP(settings, serverName);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
/**
 * Check if agent has a specific MCP server configured
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @param serverName - Name of the MCP server to check
 * @returns True if the MCP server is configured
 */
export function hasAgentMCP(agent, settings, serverName) {
    switch (agent) {
        case 'claude':
            return hasClaudeMCP(settings, serverName);
        case 'gemini':
            return hasGeminiMCP(settings, serverName);
        case 'opencode':
            return hasOpenCodeMCP(settings, serverName);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
/**
 * Count total number of MCP servers configured for an agent
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @returns Total number of MCP servers configured
 */
export function countAgentMCPServers(agent, settings) {
    switch (agent) {
        case 'claude':
            return countClaudeMCPServers(settings);
        case 'gemini':
            return countGeminiMCPServers(settings);
        case 'opencode':
            return countOpenCodeMCPServers(settings);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
