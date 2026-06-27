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
    DEVELOPMENT: {
      AGENT_SESSION_EVENTS: 3053, // Dev port for claude-hook, opencode-hook
      PRINCIPAL_MCP: 3054, // Dev port for principal MCP operations
    },
    PRODUCTION: {
      AGENT_SESSION_EVENTS: 3043, // Port for claude-hook, opencode-hook
      PRINCIPAL_MCP: 3044, // Port for principal MCP operations
    },
  },

  // MCP Server configuration
  MCP_SERVER_CONFIG_KEY: 'principal-mcp', // Default MCP server identifier for agent configs
} as const;

export type AppBrandingConfig = typeof APP_BRANDING;

/**
 * The principal MCP bridge port for the current environment. Dev builds talk to
 * 3054; packaged/production builds talk to 3044. Use this anywhere a payload or
 * snippet needs to point a caller at the local bridge — never hardcode 3054.
 */
export function getPrincipalBridgePort(): number {
  return process.env.NODE_ENV === 'development'
    ? APP_BRANDING.BRIDGE_PORTS.DEVELOPMENT.PRINCIPAL_MCP
    : APP_BRANDING.BRIDGE_PORTS.PRODUCTION.PRINCIPAL_MCP;
}

/** Base URL of the local principal MCP bridge for the current environment. */
export function getPrincipalBridgeUrl(): string {
  return `http://localhost:${getPrincipalBridgePort()}`;
}
