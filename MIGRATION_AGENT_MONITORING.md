# Migration Guide: @/core-lib/lib/agents → @principal-ai/agent-monitoring

## Overview
This guide covers the migration from the old `@/core-lib/lib/agents` module to the new `@principal-ai/agent-monitoring` package (v0.3.0).

## Affected Files
- **78 files** currently import from `@/core-lib/lib/agents`
- Most imports are in `/src/main`, `/src/renderer`, `/src/shared`, and `/src/window` directories

## Import Changes

### Step 1: Update Package Import Path
```typescript
// OLD
import { ... } from "@/core-lib/lib/agents";

// NEW
import { ... } from "@principal-ai/agent-monitoring";
```

### Step 2: Update Type Names

#### Event Types
```typescript
// OLD
import { NormalizedAgentSessionEvent } from "@/core-lib/lib/agents";

// NEW
import { UniversalAgentSessionEvent } from "@principal-ai/agent-monitoring";
```

#### Key Differences in Event Structure
The new `UniversalAgentSessionEvent` type includes:
- Added `provider: SupportedAgent` field (required)
- Changed to `rawFilePaths?: string[]` (from normalized paths)
- Path normalization is now handled separately

### Step 3: Direct Export Mappings

| Old Export | New Export | Notes |
|------------|------------|-------|
| `SupportedAgent` | `SupportedAgent` | No change |
| `SUPPORTED_AGENTS` | `SUPPORTED_AGENTS` | No change |
| `AGENT_INFO` | `AGENT_INFO` | No change |
| `AgentInfo` | `AgentInfo` | No change |
| `getAgentInfo()` | `getAgentInfo()` | No change |
| `AgentSettings` | `AgentSettings` | No change |
| `CUSTOM_INSTALL_DIRECTORY` | `CUSTOM_INSTALL_DIRECTORY` | No change |
| `InstallationInfo` | `InstallationInfo` | No change |
| `ClaudeConfigConfig` | `ClaudeConfigConfig` | Generated type |
| `OpencodeConfigConfig` | `OpencodeConfigConfig` | Generated type |

### Step 4: Hook Configuration Functions
All hook-related functions remain available:
- `configureAgentHooks()`
- `removeAgentHooks()`
- `hasAgentHook()`
- `countAgentHooks()`
- `getClaudeHookScripts()`
- `getAvailableHookTypes()`
- `getHookTypeDisplayName()`
- `getHookTypeDescription()`
- `hookTypeUsesMatchers()`
- `getDefaultMatcher()`

Hook type exports:
- `CLAUDE_HOOK_TYPES`
- `GEMINI_HOOK_TYPES`
- `OPENCODE_HOOK_TYPES`
- `ClaudeHookType`
- `GeminiHookType`
- `OpenCodeHookType`
- `HookType`

### Step 5: Event Processors
```typescript
// OLD
import { AgentEventProcessor, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor } from "@/core-lib/lib/agents";

// NEW
import { AgentEventProcessor, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor } from "@principal-ai/agent-monitoring";
```

The new `AgentEventProcessor<RawEventType>` interface has a different signature:
```typescript
interface AgentEventProcessor<RawEventType = unknown> {
  normalize(rawData: RawEventType): UniversalAgentSessionEvent;
  extractToolInfo?(event: any): { toolName: string; toolInput: unknown } | null; // deprecated
}
```

### Step 6: Path Normalization

#### New Imports Available
```typescript
import {
  PathNormalizationService,
  PathNormalizationAdapter,
  MockPathNormalizationAdapter,
  PathContext,
  NormalizedPathInfo,
  RepositoryInfo,
  FileOperation,
  SupportedPlatform,
  getFileOperation,
  extractFilePathsFromToolInput,
  extractFilePathsFromToolOutput,
  extractFilePathsFromTool,
  isAbsolutePath,
  classifyPath,
  isPlatformSupported,
  validatePlatformSupport
} from "@principal-ai/agent-monitoring";
```

Note: The `PathNormalizer` class that requires Node.js `path` module remains in `electron-react/src/main/agent-session-events/PathNormalizer.ts`

### Step 7: New Universal Event Type
For repository-normalized events:
```typescript
import { RepoNormalizedUniversalAgentSessionEvent } from "@principal-ai/agent-monitoring";
```

### Step 8: Helper Functions for OpenCode Hooks
```typescript
import {
  NormalizedHook,
  OpenCodeHook,
  convertOpenCodeToNormalized,
  convertNormalizedToOpenCode
} from "@principal-ai/agent-monitoring";
```

## Code Updates Required

### 1. Update Event Type Usage
Replace all instances of `NormalizedAgentSessionEvent` with `UniversalAgentSessionEvent`:

```typescript
// Example: src/shared/sessionViewTypes.ts
// OLD
import type { NormalizedAgentSessionEvent } from "@/core-lib/lib/agents";
export interface SessionView {
  events: NormalizedAgentSessionEvent[];
}

// NEW
import type { UniversalAgentSessionEvent } from "@principal-ai/agent-monitoring";
export interface SessionView {
  events: UniversalAgentSessionEvent[];
}
```

### 2. Handle Provider Field
The new event type requires a `provider` field:

```typescript
// When creating events, ensure provider is set
const event: UniversalAgentSessionEvent = {
  ...existingEventData,
  provider: 'claude' // or 'gemini', 'opencode'
};
```

### 3. Update Path Handling
Paths are now stored as raw strings and need explicit normalization:

```typescript
// OLD - paths were pre-normalized
const filePaths = event.normalizedPaths;

// NEW - paths need normalization
const rawPaths = event.rawFilePaths || [];
// Use PathNormalizationService to normalize if needed
```

## Temporary Workarounds

### MCP-Related Functions (Pending New Package)
Until `@principal-ai/agent-mcp` is available, you'll need to handle these missing exports:

1. **BRANDING constant** - Used in 15+ files
2. **getMcpFallbackPath()** - Used for MCP configuration
3. **MCP configuration functions**:
   - `configureAgentMCP()`
   - `removeAgentMCP()`
   - `hasAgentMCP()`
   - `countAgentMCPServers()`

**Temporary Solution**: Keep these in a local module until the MCP package is ready.

## Migration Checklist

- [ ] Update all import statements from `@/core-lib/lib/agents` to `@principal-ai/agent-monitoring`
- [ ] Replace `NormalizedAgentSessionEvent` with `UniversalAgentSessionEvent` throughout
- [ ] Update event creation to include `provider` field
- [ ] Update path handling from normalized to raw paths
- [ ] Extract MCP-related code to temporary module
- [ ] Update event processor implementations
- [ ] Test all agent integrations (Claude, Gemini, OpenCode)
- [ ] Verify hook configurations still work
- [ ] Update any custom event processing logic

## Files Requiring Special Attention

### High-Impact Files (Multiple Imports)
1. `src/main/agent-management/agentConfigHandlers.ts` - Hook configuration and BRANDING
2. `src/main/agent-management/AgentConfigurationService.ts` - Multiple hook functions
3. `src/main/agent-management/GeminiInstallationService.ts` - BRANDING and installation
4. `src/renderer/pages/LandingPage/OnboardingFlowV2.tsx` - Multiple agent info imports

### Event Processing Files
1. `src/main/agent-session-events/AgentSessionEventProcessor.ts`
2. `src/main/agent-session-events/BatchEventReprocessor.ts`
3. `src/main/services/SessionViewService.ts`
4. `src/shared/event-processing/SessionEventProcessor.ts`

### MCP-Dependent Files
1. `src/renderer/services/MCPService.ts` - BRANDING
2. `src/main/planning-mcp/PlanningMCPBridge.ts` - BRANDING
3. `src/main/mcp-app-control/mcp-integration.ts` - BRANDING
4. `src/main/initialization.ts` - BRANDING

## Testing After Migration

1. **Agent Installation**: Verify all three agents can be installed
2. **Hook Configuration**: Test adding/removing hooks for each agent
3. **Event Processing**: Ensure events are properly normalized and processed
4. **Path Normalization**: Verify file paths are correctly handled
5. **MCP Integration**: Test MCP server connections (once MCP package is available)