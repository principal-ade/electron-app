/**
 * Branding constants for the application
 * Centralized location for all branding-related strings to make rebranding easier
 */
export declare const BRANDING: {
    readonly COMPANY_NAME: "A24Z";
    readonly PRODUCT_NAME: "specktor.ai";
    readonly APP_NAME: "Specktor";
    readonly MCP_SERVER_NAME: "principal-ai-mcp-server";
    readonly MCP_SERVER_CONFIG_KEY: "principal-ai";
    readonly MCP_SERVER_FILENAME: "principal-ai-mcp-server.cjs";
    readonly MCP_SERVER_BUNDLE_NAME: "principal-ai-mcp-server.js";
    readonly MCP_FALLBACK_DIR: ".a24z-mcp";
    readonly VERSION_FLAG: "--principal-ai-version";
    readonly APP_NOT_RUNNING_ERROR: "The principal.ai application isnt open";
    readonly MCP_BRIDGE_ERROR: "Unable to connect to MCP bridge. Please ensure the PrincipalAI app is running.";
    readonly SCAFFOLD_ERROR: "No scaffold layers found. Generate architectural analysis first using the PrincipalAI app.";
    readonly EXCALIDRAW_ERROR: "Retrieving Excalidraw drawings requires the PrincipalAI app to be running.";
    readonly SEMANTIC_SEARCH_ERROR: "Semantic file search requires the PrincipalAI app to be running with architectural scaffold layers generated.";
    readonly APP_VERSION: "1.0.2";
    readonly MCP_VERSION: "1.0.0";
    readonly BRIDGE_PORTS: {
        readonly AGENT_SESSION_EVENTS: 3043;
        readonly PLANNING_MCP: 3045;
    };
};
export type BrandingConfig = typeof BRANDING;
export declare function getMcpFallbackPath(): string;
//# sourceMappingURL=branding.d.ts.map