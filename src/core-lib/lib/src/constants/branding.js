/**
 * Branding constants for the application
 * Centralized location for all branding-related strings to make rebranding easier
 */
export const BRANDING = {
    // Company/Product Names
    COMPANY_NAME: 'A24Z',
    PRODUCT_NAME: 'specktor.ai',
    APP_NAME: 'Specktor',
    // MCP Server
    MCP_SERVER_NAME: 'principal-ai-mcp-server',
    MCP_SERVER_CONFIG_KEY: 'principal-ai',
    MCP_SERVER_FILENAME: 'principal-ai-mcp-server.cjs',
    MCP_SERVER_BUNDLE_NAME: 'principal-ai-mcp-server.js',
    // Directories
    MCP_FALLBACK_DIR: '.a24z-mcp',
    // Version Flags
    VERSION_FLAG: '--principal-ai-version',
    // Error Messages
    APP_NOT_RUNNING_ERROR: 'The principal.ai application isnt open',
    MCP_BRIDGE_ERROR: 'Unable to connect to MCP bridge. Please ensure the PrincipalAI app is running.',
    SCAFFOLD_ERROR: 'No scaffold layers found. Generate architectural analysis first using the PrincipalAI app.',
    EXCALIDRAW_ERROR: 'Retrieving Excalidraw drawings requires the PrincipalAI app to be running.',
    SEMANTIC_SEARCH_ERROR: 'Semantic file search requires the PrincipalAI app to be running with architectural scaffold layers generated.',
    // Versions
    APP_VERSION: '1.0.2',
    MCP_VERSION: '1.0.0',
    // Bridge Ports
    BRIDGE_PORTS: {
        AGENT_SESSION_EVENTS: 3043, // Port for claude-hook, gemini-hook, opencode-hook
        PLANNING_MCP: 3045, // Port for planning document operations
    },
};
// Helper function to get fallback path
export function getMcpFallbackPath() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return `${homeDir}/${BRANDING.MCP_FALLBACK_DIR}`;
}
//# sourceMappingURL=branding.js.map