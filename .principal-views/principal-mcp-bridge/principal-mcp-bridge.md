# Principal MCP Bridge

The Principal MCP Bridge is an HTTP server that enables external AI agents (like Claude Code, Cline, or OpenCode) to interact with the Electron application's repository monitoring capabilities through the Model Context Protocol (MCP).

## Purpose

When AI coding assistants run in terminal environments, they lack direct access to the desktop application's rich repository data. The MCP Bridge solves this by exposing an HTTP API that MCP tools can call to:

- Resolve dependency information from monitored repositories
- Access cached repository metadata
- Query the repository monitoring system

## Architecture

The bridge runs as an Express server on `localhost:3044` (configurable via `appBranding.ts`). It listens only on localhost for security, but allows CORS from any origin to support various MCP client implementations.

### Request Flow

1. **MCP Client** - An AI agent tool makes an HTTP request
2. **Express Server** - Receives and routes the request
3. **CORS Middleware** - Adds cross-origin headers, parses JSON body (up to 10MB)
4. **Route Handler** - Processes the specific endpoint
5. **Repository Monitoring Manager** - Singleton service that interfaces with the monitoring worker
6. **Monitoring Worker** - Utility process that performs the actual repository operations

## API Endpoints

### GET /health

Health check endpoint returning server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "message": "Principal MCP Bridge is running",
  "port": 3044
}
```

### POST /dependencies/resolve

Resolves dependency information using the repository monitoring system.

**Request Body:**
```json
{
  "dependencyId": "pkg:npm/express@4.18.2",
  "repositoryRoot": "/path/to/repo"  // optional
}
```

**Response (success):**
```json
{
  "success": true,
  // ... dependency resolution data from monitoring manager
}
```

**Response (error):**
```json
{
  "success": false,
  "message": "Failed to resolve dependency",
  "error": "Error details"
}
```

## Lifecycle

The bridge is managed through the application initialization system:

- **Startup**: Called via `startPrincipalMCPBridge()` during app initialization in `initialization.ts`
- **Shutdown**: Called via `stopPrincipalMCPBridge()` when the application quits

## Configuration

Port configuration is centralized in `src/shared/config/appBranding.ts`:

```typescript
BRIDGE_PORTS: {
  DEVELOPMENT: {
    AGENT_SESSION_EVENTS: 3053,  // Dev port for agent telemetry
    PRINCIPAL_MCP: 3054,         // Dev port for Principal MCP Bridge
  },
  PRODUCTION: {
    AGENT_SESSION_EVENTS: 3043,  // Production port for agent telemetry
    PRINCIPAL_MCP: 3044,         // Production port for Principal MCP Bridge
  },
}
```

The bridge automatically selects the appropriate port based on `NODE_ENV`:
- Development (`NODE_ENV=development`): Port 3054
- Production: Port 3044

## Error Handling

- Returns 400 for missing required fields (e.g., `dependencyId`)
- Returns 500 for internal errors with descriptive messages
- Logs all requests and errors to console with `[Principal MCP Bridge]` prefix
- Fails fast if the configured port is already in use (no retry/fallback)

## Security Considerations

- Listens on `localhost` only - not accessible from external network
- CORS allows any origin (`*`) to support various MCP client implementations
- No authentication - relies on localhost binding for security
- JSON body limit of 10MB prevents oversized payloads
