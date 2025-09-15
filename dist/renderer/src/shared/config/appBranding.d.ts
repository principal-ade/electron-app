/**
 * Application branding constants
 * Centralized location for app-specific branding that's used across main/renderer processes
 */
export declare const APP_BRANDING: {
    readonly APP_NAME: "Specktor";
    readonly COMPANY_NAME: "A24Z";
    readonly BRIDGE_PORTS: {
        readonly AGENT_SESSION_EVENTS: 3043;
        readonly PLANNING_MCP: 3045;
    };
    readonly MCP_SERVER_FILENAME: "principal-ai-mcp-server.cjs";
    readonly MCP_SERVER_CONFIG_KEY: "principal-ai";
};
export type AppBrandingConfig = typeof APP_BRANDING;
//# sourceMappingURL=appBranding.d.ts.map