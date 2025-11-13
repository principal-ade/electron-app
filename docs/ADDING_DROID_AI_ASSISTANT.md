# Adding Support for Droid AI Assistant

## Overview

This document outlines the steps required to add support for the "Droid" AI assistant to the Electron application, following the same pattern as existing agents (Claude, OpenCode, Gemini).

## Prerequisites

- Droid AI assistant must be installed and configured on the user's system
- Droid must support hook-based event forwarding (similar to Claude's hook system)
- Droid configuration file location and format must be known
- Droid must support MCP (Model Context Protocol) integration

## Implementation Steps

### 1. Extend SupportedAgent Type

**File:** `src/shared/types/agent.types.ts` (create if doesn't exist) or extend from `@principal-ai/agent-monitoring`

Add 'droid' to the SupportedAgent union type:

```typescript
export type SupportedAgent =
  | 'claude'
  | 'gemini'
  | 'opencode'
  | 'cline'
  | 'droid';
```

If SupportedAgent is imported from `@principal-ai/agent-monitoring`, you may need to:

- Fork/modify the package to include 'droid'
- Or create a local extension type

### 2. Create DroidConfigManager

**File:** `src/main/agent-management/HookConfigurationManager.ts`

Add DroidConfigManager class similar to ClaudeConfigManager:

```typescript
private droidManager: DroidConfigManager;

// In constructor:
this.droidManager = new DroidConfigManager();
this.droidManager.setFallbackDirectory('~/.principle/hooks');

// Add methods for droid-specific configuration
```

**File:** `src/main/agent-management/DroidConfigManager.ts` (create new)

Create a new file with DroidConfigManager class that handles:

- Reading/writing Droid configuration files
- Enabling/disabling hooks
- Checking installation status
- Managing fallback event storage

### 3. Update HookConfigurationManager

**File:** `src/main/agent-management/HookConfigurationManager.ts`

Add 'droid' handling in all agentType conditionals:

```typescript
// Add to agents list
: (['claude', 'opencode', 'cline', 'droid'] as SupportedAgent[]);

// Add enableHooks case
if (agentType === 'droid') {
  await this.droidManager.enableHooks(options);
  const status = await this.droidManager.getHookStatus();
  return {
    success: true,
    configPath: '~/.droid/settings.json',
    status
  };
}

// Add disableHooks case
if (agentType === 'droid') {
  await this.droidManager.disableHooks();
  return {
    success: true,
    configPath: '~/.droid/settings.json'
  };
}

// Add status checking cases
if (agentType === 'droid') {
  const isInstalled = await this.droidManager.isDroidInstalled();
  const status = await this.droidManager.getHookStatus();
  // ... return status
}
```

### 4. Update Agent Configuration Handlers

**File:** `src/main/agent-management/agentConfigHandlers.ts`

Add 'droid' handling in setup status checks:

```typescript
if (agentType === 'droid') {
  // Handle droid-specific setup checks
  // Check if ~/.droid/settings.json exists
  // Check if droid is installed
}
```

### 5. Add Event Processing Support

**File:** `src/event-processing-server/HttpEventServer.ts`

Add 'droid-hook' to the hook name mapping:

```typescript
agent === 'droid'
  ? 'droid-hook'
  : agent === 'cline'
    ? 'cline-hook'
    : 'unknown-hook';
```

### 6. Update NPM Library for Droid Hook Management

**Instead of creating separate hook scripts, update the `@a24z/agent-manager` library to handle Droid hooks internally.**

**Required Updates to @a24z/agent-manager:**

- Add `DroidConfigManager` class that extends the base hook manager
- Implement `enableHooks()`, `disableHooks()`, and `getHookStatus()` methods
- Configure Droid's settings.json to enable hooks that communicate directly with the event processing server
- Remove dependency on separate hook script files

**Example DroidConfigManager structure:**

```typescript
export class DroidConfigManager {
  private fallbackDir: string;

  setFallbackDirectory(dir: string): void {
    this.fallbackDir = dir;
  }

  async enableHooks(options: HookOptions): Promise<void> {
    // Configure Droid's ~/.droid/settings.json with hook settings
    // Hooks should send events to http://localhost:{options.port}/droid-hook
  }

  async disableHooks(): Promise<void> {
    // Remove hook configuration from Droid settings
  }

  async getHookStatus(): Promise<HookStatus> {
    // Check if hooks are enabled in Droid configuration
  }

  async isDroidInstalled(): Promise<boolean> {
    // Check if Droid is installed and accessible
  }
}
```

**Note:** This approach eliminates the need for separate `assets/hooks/droid-hook.cjs` files, as the npm library handles all hook configuration and event forwarding internally.

### 7. Add MCP Configuration Support

**File:** `docs/MCP_PACKAGE_REQUIREMENTS.md` and related MCP package

Add Droid-specific MCP configuration:

```typescript
export interface DroidMCPConfig {
  mcpServers?: MCPServerMap;
  // Droid-specific MCP settings
}

export function getDroidMCPDefaults(): DroidMCPConfig;
```

Update MCP configuration functions to handle 'droid' agent type.

### 8. Update UI Components

**File:** `src/renderer/pages/LandingPage/AgentConfigurationView/HooksToggle.tsx`

Add Droid to the agent selection UI.

**File:** `src/renderer/principal-window/views/Settings/components/AIAssistantsSettings.tsx`

Include Droid in the assistants settings.

### 9. Update Branding and Configuration

**File:** `src/shared/config/appBranding.ts`

Add Droid to any agent-related constants.

### 10. Add Event Processing

**File:** `src/event-processing-server/EventProcessor.ts` or similar

Add Droid event processing logic to normalize and handle Droid-specific events.

## Configuration Details

### Droid Configuration File

- **Path:** `~/.droid/settings.json`
- **Hook Events:** Define which Droid events to capture (similar to Claude's hook types)
- **MCP Servers:** Configuration for MCP server connections

### Hook Events to Capture

Based on Droid's capabilities, configure hooks for:

- Tool usage events
- Session events
- User interaction events
- Error events

## Testing Checklist

1. **Installation Detection:** Verify Droid installation is properly detected
2. **Hook Configuration:** Test enabling/disabling hooks
3. **Event Forwarding:** Ensure events are properly forwarded to the server
4. **MCP Integration:** Test MCP server configuration and communication
5. **UI Integration:** Verify Droid appears in settings and can be configured
6. **Event Processing:** Confirm events are processed and stored correctly
7. **Error Handling:** Test error scenarios and fallback behavior

## Files to Create/Modify

### New Files

- `src/main/agent-management/DroidConfigManager.ts`

### Modified Files

- `src/main/agent-management/HookConfigurationManager.ts`
- `src/main/agent-management/agentConfigHandlers.ts`
- `src/event-processing-server/HttpEventServer.ts`
- `src/renderer/pages/LandingPage/AgentConfigurationView/HooksToggle.tsx`
- `src/renderer/principal-window/views/Settings/components/AIAssistantsSettings.tsx`
- `docs/MCP_PACKAGE_REQUIREMENTS.md`

## Dependencies and Library Updates

### External Libraries to Update

#### 1. @principal-ai/agent-monitoring

**Required Updates:**

- Add 'droid' to `SupportedAgent` union type
- Add Droid agent info to `AGENT_INFO` object with:
  - `settingsPath`: Path to Droid configuration file (e.g., `~/.droid/settings.json`)
  - `name`: Display name for Droid
  - `description`: Description of Droid assistant
  - `installMethod`: Installation method ('manual', 'npm', etc.)
  - `configFormat`: Configuration file format ('json', etc.)

**Example:**

```typescript
export const AGENT_INFO: Record<SupportedAgent, AgentInfo> = {
  // ... existing agents
  droid: {
    name: 'Droid',
    description: 'Droid AI Assistant',
    settingsPath: '~/.droid/settings.json',
    installMethod: 'manual',
    configFormat: 'json',
  },
};
```

#### 2. @principal-ai/agent-mcp

**Required Updates:**

- Add `DroidMCPConfig` interface
- Add `getDroidMCPDefaults()` function
- Update `configureAgentMCP()`, `removeAgentMCP()`, `hasAgentMCP()` functions to handle 'droid' agent type
- Update `countAgentMCPServers()` for Droid

**Example additions:**

```typescript
export interface DroidMCPConfig {
  mcpServers?: MCPServerMap;
  // Droid-specific MCP settings
}

export function getDroidMCPDefaults(): DroidMCPConfig {
  return {
    mcpServers: {},
  };
}
```

#### 3. @a24z/agent-manager (if used)

**Required Updates:**

- Update `enableAgentMCP()`, `disableAgentMCP()`, `getAgentMCPStatus()` functions to support 'droid' agent type
- Add Droid-specific MCP server configuration logic

### Internal Dependencies

- Ensure Droid AI assistant is compatible with the hook system
- Verify Droid supports the required hook events for event forwarding
- Confirm Droid configuration file format matches expected structure

## Success Criteria

- Droid appears in the UI as a configurable AI assistant
- Users can enable/disable hooks for Droid
- Droid events are properly captured and processed
- MCP servers can be configured for Droid
- All existing functionality remains intact

## Hook Script Cleanup

**⚠️ IMPORTANT: This cleanup requires updating the @a24z/agent-manager library first**

Before removing existing hook scripts, the npm library must be updated to handle all hook functionality internally. Currently, the library still configures agents to use the hook scripts.

### Required Changes Before Cleanup:

1. **Update @a24z/agent-manager library:**
   - Modify ClaudeConfigManager, ClineConfigManager, and OpenCodeConfigManager to handle event forwarding internally
   - Remove dependencies on external hook script files
   - Implement direct communication with the event processing server

2. **Update HttpEventServer.ts:**
   - Remove hook script path references
   - Update route handling to work with library-managed hooks

3. **Test thoroughly:**
   - Verify all agents still work after library updates
   - Ensure event processing continues functioning
   - Test hook enable/disable operations

### Safe Cleanup Steps:

1. **Phase 1: Update Library** - Modify @a24z/agent-manager to handle hooks internally
2. **Phase 2: Update Codebase** - Remove hook script references from the Electron app
3. **Phase 3: Remove Files** - Delete `assets/hooks/*.cjs` files
4. **Phase 4: Test** - Comprehensive testing of all agent integrations

**Do not remove hook scripts until the npm library is fully capable of handling hooks internally, as this will break existing functionality.**

## Notes

- Follow the existing patterns for Claude/OpenCode implementation
- Ensure backward compatibility with existing agents
- Test thoroughly in development environment before production deployment
- Document any Droid-specific requirements or limitations
- The npm library approach eliminates the need for separate hook script files
