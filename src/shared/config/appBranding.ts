/**
 * Application branding constants
 * Centralized location for app-specific branding that's used across main/renderer processes
 */

export const APP_BRANDING = {
  APP_NAME: 'Principal ADE',
  COMPANY_NAME: 'A24Z',

  // Auth server URLs
  AUTH_SERVER_URL: {
    DEVELOPMENT: 'http://localhost:3000',
    PRODUCTION: 'https://auth.principal-ade.com',
  },

  // Web-ADE URLs (browser-based editor)
  WEB_ADE_URL: {
    DEVELOPMENT: 'http://localhost:3000',
    PRODUCTION: 'https://app.principal-ade.com',
  },

  // Bridge ports for HTTP communication
  BRIDGE_PORTS: {
    AGENT_SESSION_EVENTS: 3043, // Port for claude-hook, opencode-hook
    PRINCIPAL_MCP: 3044, // Port for principal MCP operations
  },

  // MCP Server configuration
  MCP_SERVER_CONFIG_KEY: 'principal-mcp', // Default MCP server identifier for agent configs
} as const;

export type AppBrandingConfig = typeof APP_BRANDING;
