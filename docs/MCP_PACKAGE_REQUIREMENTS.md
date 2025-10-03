# MCP Package Requirements: @principal-ai/agent-mcp

## Overview
This document outlines the exports and functionality needed in the new `@principal-ai/agent-mcp` package to complete the migration from `@/core-lib/lib/agents`.

## Required Exports

### 1. Branding Configuration

#### Constants
```typescript
export const BRANDING: BrandingConfig = {
  company: 'Principal ADE',
  product: 'Principal MCP',
  // ... other branding properties
};
```

#### Types
```typescript
export interface BrandingConfig {
  company: string;
  product: string;
  version?: string;
  logo?: string;
  colors?: {
    primary: string;
    secondary: string;
  };
  // Additional branding properties as needed
}
```

#### Functions
```typescript
export function getMcpFallbackPath(): string;
```

### 2. MCP Configuration Functions

#### Core Configuration
```typescript
/**
 * Configure MCP servers for an agent
 * @param agentType - The agent to configure ('claude', 'gemini', 'opencode')
 * @param settings - Current agent settings
 * @param mcpServers - MCP server configuration
 * @returns Updated agent settings
 */
export function configureAgentMCP(
  agentType: SupportedAgent,
  settings: AgentSettings,
  mcpServers: Record<string, any>
): AgentSettings;

/**
 * Remove MCP configuration from an agent
 * @param agentType - The agent to update
 * @param settings - Current agent settings
 * @param serverNames - Optional array of server names to remove (removes all if not specified)
 * @returns Updated agent settings
 */
export function removeAgentMCP(
  agentType: SupportedAgent,
  settings: AgentSettings,
  serverNames?: string[]
): AgentSettings;

/**
 * Check if an agent has MCP servers configured
 * @param agentType - The agent to check
 * @param settings - Current agent settings
 * @param serverName - Optional specific server name to check for
 * @returns True if MCP is configured
 */
export function hasAgentMCP(
  agentType: SupportedAgent,
  settings: AgentSettings,
  serverName?: string
): boolean;

/**
 * Count the number of MCP servers configured for an agent
 * @param agentType - The agent to check
 * @param settings - Current agent settings
 * @returns Number of configured MCP servers
 */
export function countAgentMCPServers(
  agentType: SupportedAgent,
  settings: AgentSettings
): number;
```

### 3. MCP Server Types and Interfaces

```typescript
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  description?: string;
}

export interface MCPServerStatus {
  name: string;
  running: boolean;
  pid?: number;
  error?: string;
  lastStarted?: Date;
  lastStopped?: Date;
}

export type MCPServerMap = Record<string, MCPServerConfig>;
```

### 4. Agent-Specific MCP Configuration

#### Claude MCP
```typescript
export interface ClaudeMCPConfig {
  mcpServers?: MCPServerMap;
  // Claude-specific MCP settings
}

export function getClaudeMCPDefaults(): ClaudeMCPConfig;
```

#### Gemini MCP
```typescript
export interface GeminiMCPConfig {
  mcpServers?: MCPServerMap;
  // Gemini-specific MCP settings
}

export function getGeminiMCPDefaults(): GeminiMCPConfig;
```

#### OpenCode MCP
```typescript
export interface OpenCodeMCPConfig {
  mcpServers?: MCPServerMap;
  // OpenCode-specific MCP settings
}

export function getOpenCodeMCPDefaults(): OpenCodeMCPConfig;
```

## Dependencies from agent-monitoring

The MCP package will need to import these types from `@principal-ai/agent-monitoring`:

```typescript
import {
  SupportedAgent,
  AgentSettings,
  AgentInfo,
  getAgentInfo
} from '@principal-ai/agent-monitoring';
```

## File Structure Recommendation

```
@principal-ai/agent-mcp/
├── src/
│   ├── index.ts           # Main exports
│   ├── branding/
│   │   ├── index.ts       # BRANDING constant and related
│   │   └── types.ts       # BrandingConfig interface
│   ├── config/
│   │   ├── index.ts       # Configuration functions
│   │   ├── claude.ts      # Claude-specific MCP config
│   │   ├── gemini.ts      # Gemini-specific MCP config
│   │   └── opencode.ts    # OpenCode-specific MCP config
│   ├── types/
│   │   └── index.ts       # MCP types and interfaces
│   └── utils/
│       └── paths.ts       # getMcpFallbackPath and related
├── package.json
└── tsconfig.json
```

## Usage Patterns in Current Codebase

### 1. Branding Usage
Currently used in 15+ files for:
- Display names in UI
- MCP server configuration paths
- Default settings initialization

```typescript
// Example from src/renderer/services/MCPService.ts
import { BRANDING } from "@/core-lib/lib/agents";

const serverPath = path.join(BRANDING.configDir, 'mcp-servers');
```

### 2. MCP Configuration Usage
Used in agent configuration handlers:

```typescript
// Example usage pattern
if (hasAgentMCP(agentType, settings, 'principle-mcp')) {
  // Server already configured
} else {
  const updatedSettings = configureAgentMCP(
    agentType,
    settings,
    { 'principle-mcp': mcpServerConfig }
  );
}
```

### 3. MCP Server Management
Needed for:
- Starting/stopping MCP servers
- Monitoring server status
- Handling server communication

## Integration Points

### With electron-react
- `src/main/mcp-app-control/mcp-integration.ts`
- `src/main/principal-mcp/PrincipalMCPBridge.ts`
- `src/renderer/services/MCPService.ts`

### With agent-monitoring
- Shares `SupportedAgent` and `AgentSettings` types
- MCP configuration is part of agent settings

## Priority Exports

**Must Have** (Blocking migration):
1. `BRANDING` constant
2. `BrandingConfig` type
3. `getMcpFallbackPath()` function

**Should Have** (For full functionality):
1. `configureAgentMCP()`
2. `removeAgentMCP()`
3. `hasAgentMCP()`
4. `countAgentMCPServers()`

**Nice to Have** (Future enhancements):
1. Agent-specific MCP configurations
2. MCP server status types
3. Default configurations per agent

## Testing Requirements

The package should include tests for:
1. Configuration CRUD operations
2. Path resolution (getMcpFallbackPath)
3. Agent-specific configuration validation
4. Server configuration merging/updating
5. Backwards compatibility with existing settings

## Version Compatibility

- Should work with `@principal-ai/agent-monitoring` v0.3.0+
- Node.js 18+ (matching electron-react requirements)
- TypeScript 5.0+ (for consistency)