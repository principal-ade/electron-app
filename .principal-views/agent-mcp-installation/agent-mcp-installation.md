# Agent MCP Installation Flow

This document describes the telemetry instrumentation for the Agent MCP Installation feature, which enables users to configure MCP (Model Context Protocol) servers for various AI agents.

## Overview

The MCP installation flow allows users to enable/disable MCP servers for supported AI agents:
- **Claude** (`~/.claude.json`)
- **Cline** (VS Code extension settings)
- **OpenCode** (`~/.config/openCode/openCode.json`)
- **Droid** (`~/.factory/mcp.json`)

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  UI Components  │────▶│ AgentConfiguration  │────▶│   IPC Handlers   │
│  (Setup Wizard, │     │    Service          │     │ (Main Process)   │
│   Detailed View)│     │  (Renderer)         │     │                  │
└─────────────────┘     └─────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Config Files   │◀────│ @principal-ade/     │◀────│ enableAgentMCP() │
│  (Agent-specific│     │  agent-manager      │     │ disableAgentMCP()│
│   JSON configs) │     │  (External Library) │     │ getAgentMCPStatus│
└─────────────────┘     └─────────────────────┘     └──────────────────┘
```

## Source Files

### UI Components (Renderer)
- `src/renderer/pages/LandingPage/AgentConfigurationView/AgentSetupWizard.tsx`
  - Main setup wizard with 3-step flow (Install, Configure Hooks, Enable MCP)
  - `handleMCPToggle()` function handles enable/disable

- `src/renderer/pages/LandingPage/AgentConfigurationView/DetailedConfigurationView.tsx`
  - Detailed configuration view with tabs (Install, Hooks, MCP Servers)
  - Agent-specific MCP content components: `ClaudeMCPContent`, `ClineMCPContent`, etc.

### Renderer Service
- `src/renderer/main-process-api/AgentConfigurationService.ts`
  - `addMCPToAgent(agentType, serverName)` - Add MCP server to agent
  - `removeMCPFromAgent(agentType, serverName)` - Remove MCP server
  - `getAgentMCPStatus(agentType, serverName)` - Check MCP status

### Main Process (IPC Handlers)
- `src/main/agent-management/agentConfigHandlers.ts`
  - `ADD_MCP_TO_AGENT` - IPC handler for adding MCP
  - `REMOVE_MCP_FROM_AGENT` - IPC handler for removing MCP
  - `GET_AGENT_MCP_STATUS` - IPC handler for checking status

### Shared Interfaces
- `src/shared/main-process-api-interfaces/AgentConfigAPI.ts`
  - Type definitions for MCP operations
  - `AgentConfigAPIEvent` enum with IPC event names

### External Library
- `@principal-ade/agent-manager`
  - `enableAgentMCP(agentType, options)` - Enable MCP for agent
  - `disableAgentMCP(agentType, serverName)` - Disable MCP for agent
  - `getAgentMCPStatus(agentType, serverName)` - Get current MCP status

## Telemetry Events

### UI Events
| Event Name | Description |
|------------|-------------|
| `agent_mcp.ui.toggle_clicked` | User clicks MCP enable/disable toggle |
| `agent_mcp.ui.detailed_view_opened` | User opens detailed MCP config view |
| `agent_mcp.ui.state_updated` | UI state updated after operation |
| `agent_mcp.ui.error_displayed` | Error message shown to user |

### Service Events
| Event Name | Description |
|------------|-------------|
| `agent_mcp.service.request_initiated` | Renderer service initiates MCP operation |

### IPC Events
| Event Name | Description |
|------------|-------------|
| `agent_mcp.ipc.add_mcp_received` | Main process receives add MCP request |
| `agent_mcp.ipc.remove_mcp_received` | Main process receives remove MCP request |
| `agent_mcp.ipc.get_status_received` | Main process receives status request |

### Library Events
| Event Name | Description |
|------------|-------------|
| `agent_mcp.library.operation_called` | External library function called |

### Config File Events
| Event Name | Description |
|------------|-------------|
| `agent_mcp.config.claude_updated` | Claude config file updated |
| `agent_mcp.config.cline_updated` | Cline config updated |
| `agent_mcp.config.opencode_updated` | OpenCode config updated |
| `agent_mcp.config.droid_updated` | Droid config updated |

### Result Events
| Event Name | Description |
|------------|-------------|
| `agent_mcp.operation.success` | MCP operation completed successfully |
| `agent_mcp.operation.error` | MCP operation failed |

## Key Attributes

All events should include:
- `agent.type` - The agent being configured (claude, cline, opencode, droid)
- `operation` - The operation being performed (enable, disable, check)
- `server.name` - The MCP server name being configured

## Configuration

The MCP server name is defined in:
- `src/shared/config/appBranding.ts` - `APP_BRANDING.MCP_SERVER_CONFIG_KEY`

Default server name: `principal-mcp` (via `DEFAULT_MCP_SERVER_NAME` from agent-manager)
