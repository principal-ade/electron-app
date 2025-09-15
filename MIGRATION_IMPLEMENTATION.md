# Migration Implementation Guide

## Overview
This document outlines the actual implementation work required to migrate from `@/core-lib/lib/agents` to `@principal-ai/agent-monitoring`. Since we're pre-release, we're making a clean break with no backward compatibility.

## Critical: IPC Interface Changes

### Affected IPC APIs
These interfaces in `/src/shared/main-process-api-interfaces/` will have breaking changes:

#### 1. AgentSessionAPI.ts
```typescript
// OLD: Uses NormalizedAgentSessionEvent
export interface AgentSessionAPI {
  getSessionEvents(sessionId: string): Promise<NormalizedAgentSessionEvent[]>;
  archiveSession(sessionId: string, events: NormalizedAgentSessionEvent[]): Promise<void>;
}

// NEW: Will use UniversalAgentSessionEvent
export interface AgentSessionAPI {
  getSessionEvents(sessionId: string): Promise<UniversalAgentSessionEvent[]>;
  archiveSession(sessionId: string, events: UniversalAgentSessionEvent[]): Promise<void>;
}
```

#### 2. AgentSessionEventsAPI.ts
```typescript
// Event structure changes affect:
- processRawHookData()
- getProcessedEvents()
- reprocessEvents()
```

#### 3. AgentConfigAPI.ts
```typescript
// MCP functions will be removed from this interface
// These will move to a new MCP-specific API:
- configureMCP()
- removeMCP()
- getMCPStatus()
```

### New IPC APIs Needed

#### MCPConfigAPI.ts (NEW)
```typescript
export interface MCPConfigAPI {
  configureMCP(agentType: SupportedAgent, servers: MCPServerMap): Promise<void>;
  removeMCP(agentType: SupportedAgent, serverNames?: string[]): Promise<void>;
  getMCPServers(agentType: SupportedAgent): Promise<MCPServerMap>;
  getMCPServerStatus(agentType: SupportedAgent, serverName: string): Promise<MCPServerStatus>;
}
```

### UI Team Impact
The UI team needs to update:
1. **Event type imports** - Replace `NormalizedAgentSessionEvent` with `UniversalAgentSessionEvent`
2. **Event field access** - Add handling for new `provider` field
3. **Path handling** - Change from `normalizedPaths` to `rawFilePaths`
4. **MCP configuration** - Use new MCPConfigAPI instead of methods on AgentConfigAPI

## Phase 1: Path Normalization Implementation

### 1.1 Create Node.js Adapter
The new package requires a `PathNormalizationAdapter` implementation:

```typescript
// src/main/adapters/NodePathNormalizationAdapter.ts
import * as path from 'path';
import * as os from 'os';
import { PathNormalizationAdapter, SystemInfo, RepositoryInfo } from '@principal-ai/agent-monitoring';

export class NodePathNormalizationAdapter implements PathNormalizationAdapter {
  constructor(
    private findRepositoryRoot: (absolutePath: string) => Promise<RepositoryInfo | null>
  ) {}

  async getRawRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    // Use existing findRepositoryRoot function
    return this.findRepositoryRoot(absolutePath);
  }

  getSystemInfo(): SystemInfo {
    return {
      homeDir: os.homedir(),
      pathSeparator: path.sep,
      platform: process.platform
    };
  }

  resolvePath(relativePath: string, workingDirectory: string): string {
    return path.resolve(workingDirectory, relativePath);
  }

  isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  getRelativePath(fromPath: string, toPath: string): string {
    return path.relative(fromPath, toPath);
  }

  isAvailable(): boolean {
    return true; // Always available in Node.js
  }
}
```

### 1.2 Create Path Service
```typescript
// src/main/services/PathService.ts
import { PathNormalizationService, UniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { NodePathNormalizationAdapter } from '../adapters/NodePathNormalizationAdapter';

export class PathService {
  private normalizationService: PathNormalizationService;

  constructor(findRepositoryRoot: (path: string) => Promise<RepositoryInfo | null>) {
    const adapter = new NodePathNormalizationAdapter(findRepositoryRoot);
    this.normalizationService = new PathNormalizationService(adapter);
  }

  async normalizeEvent(event: UniversalAgentSessionEvent) {
    return this.normalizationService.normalizePaths(event);
  }
}
```

### 1.3 Extract Repository Finding Logic
Current `PathNormalizer` has `findRepositoryRoot` logic that needs to be extracted:
- [ ] Extract repository detection from PathNormalizer
- [ ] Create shared repository service
- [ ] Cache repository information for performance

## Phase 2: Event Processing Pipeline

### 2.1 New Event Flow
```
Raw Agent Event (from hook)
  ↓
AgentEventProcessor.normalize() [from package]
  ↓
UniversalAgentSessionEvent (with rawFilePaths)
  ↓
PathService.normalizeEvent() [our implementation]
  ↓
RepoNormalizedUniversalAgentSessionEvent (with normalized paths)
  ↓
Storage/IPC
```

### 2.2 Update Event Processors
Files to update:
- `src/main/agent-session-events/AgentSessionEventProcessor.ts`
- `src/main/agent-session-events/BatchEventReprocessor.ts`
- `src/shared/event-processing/SessionEventProcessor.ts`

Implementation:
```typescript
import { ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor } from '@principal-ai/agent-monitoring';

// Use the processors from the package
const processors = {
  claude: new ClaudeEventProcessor(),
  gemini: new GeminiEventProcessor(),
  opencode: new OpenCodeEventProcessor()
};

// Process raw hook data
const universalEvent = processors[agentType].normalize(rawHookData);

// Add provider field if not set by processor
universalEvent.provider = agentType;

// Normalize paths using our service
const normalizedEvent = await pathService.normalizeEvent(universalEvent);
```

## Phase 3: Type Migration

### 3.1 Complete Type Replacement
- [ ] Replace all `NormalizedAgentSessionEvent` with `UniversalAgentSessionEvent`
- [ ] Update all event consumers to handle new structure
- [ ] Remove old type definitions

### 3.2 Update Event Creation
All places creating events must include the `provider` field:
```typescript
const event: UniversalAgentSessionEvent = {
  eventType: 'tool_use',
  sessionId: session.id,
  workingDirectory: session.workingDir,
  timestamp: Date.now(),
  provider: 'claude', // REQUIRED
  raw: rawData,
  // ... other fields
};
```

## Phase 4: MCP Extraction

### 4.1 Create Temporary MCP Module
Until the MCP package is available:

```typescript
// src/temporary-mcp-module/index.ts
export { BRANDING } from './branding';
export { getMcpFallbackPath } from './paths';
export {
  configureAgentMCP,
  removeAgentMCP,
  hasAgentMCP,
  countAgentMCPServers
} from './config';
```

### 4.2 Update Imports
Replace MCP-related imports:
```typescript
// OLD
import { BRANDING } from '@/core-lib/lib/agents';

// TEMPORARY
import { BRANDING } from '../temporary-mcp-module';

// FUTURE (when package available)
import { BRANDING } from '@principal-ai/agent-mcp';
```

## Phase 5: Testing Strategy

### 5.1 Unit Tests
Create new test suites:
- [ ] Test NodePathNormalizationAdapter
- [ ] Test PathService integration
- [ ] Test event processors for each agent
- [ ] Test IPC interface changes

### 5.2 Integration Tests
```typescript
describe('Agent Event Processing', () => {
  test('Claude events process correctly', async () => {
    const rawEvent = { /* raw claude hook data */ };
    const processed = await processEvent('claude', rawEvent);

    expect(processed.provider).toBe('claude');
    expect(processed.files).toBeDefined();
    expect(processed.normalizedWorkingDirectory).toBeDefined();
  });
});
```

### 5.3 E2E Test Scenarios
1. **Full Event Pipeline**
   - Generate event from agent
   - Process through new pipeline
   - Verify storage
   - Retrieve via IPC
   - Display in UI

2. **Path Normalization**
   - Test Windows paths
   - Test Mac paths
   - Test Linux paths
   - Test symbolic links
   - Test relative paths

## Implementation Checklist

### Week 1: Core Migration
- [ ] Create NodePathNormalizationAdapter
- [ ] Create PathService
- [ ] Update type definitions
- [ ] Update IPC interfaces
- [ ] Extract MCP to temporary module

### Week 2: Event Processing
- [ ] Integrate new event processors
- [ ] Update event pipeline
- [ ] Add provider field everywhere
- [ ] Update storage layer
- [ ] Test event flow

### Week 3: UI Updates & Testing
- [ ] Update all React components
- [ ] Fix event visualization
- [ ] Write comprehensive tests
- [ ] Document all changes
- [ ] Coordinate with UI team

## Code Quality Requirements

### Type Safety
- [ ] No `any` types in event handling
- [ ] Strict null checks enabled
- [ ] All IPC methods fully typed
- [ ] Provider field validated

### Error Handling
- [ ] Clear error messages for missing provider
- [ ] Fallback for path normalization failures
- [ ] IPC error boundaries
- [ ] Logging for debugging

### Performance
- [ ] Repository cache for path normalization
- [ ] Lazy load event processors
- [ ] Efficient event queries
- [ ] Minimal IPC overhead

## Notes for Developers

### Key Differences
1. **Event Type**: `NormalizedAgentSessionEvent` → `UniversalAgentSessionEvent`
2. **Provider Field**: Now required on all events
3. **Paths**: `normalizedPaths` → `rawFilePaths` (then normalized separately)
4. **MCP**: Extracted to separate module/package
5. **No backward compatibility**: Clean break, update everything

### Repository Finding
The current `PathNormalizer` has complex repository finding logic that needs to be preserved:
- Warns when repository detection fails
- Throws errors for paths that should be in repos
- Has special handling for common repo paths

### Platform Considerations
- Windows: Handle drive letters and backslashes
- Mac: Handle /var/folders and other Mac-specific paths
- Linux: Standard Unix paths

### Testing Resources Needed
- Access to all three agents (Claude, Gemini, OpenCode)
- Test repositories with various structures
- Multiple OS environments for path testing