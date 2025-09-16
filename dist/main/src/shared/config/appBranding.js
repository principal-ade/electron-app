/**
 * Application branding constants
 * Centralized location for app-specific branding that's used across main/renderer processes
 */
export const APP_BRANDING = {
    APP_NAME: 'Principal AI',
    COMPANY_NAME: 'A24Z',
    // Bridge ports for HTTP communication
    BRIDGE_PORTS: {
        AGENT_SESSION_EVENTS: 3043, // Port for claude-hook, gemini-hook, opencode-hook
        PLANNING_MCP: 3045, // Port for planning document operations
    },
    // MCP Server configuration
    MCP_SERVER_FILENAME: 'principal-ai-mcp-server.cjs', // The actual MCP server file in assets
    MCP_SERVER_CONFIG_KEY: 'principal-ai', // The key/identifier used in agent configurations
};
