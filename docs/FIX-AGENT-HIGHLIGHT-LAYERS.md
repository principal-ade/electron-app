# Fix: Agent Highlight Layers Not Showing in File City

## Problem Summary

Agent session events are being received by the File City panel, but files don't have `repository.relativePath`, so no highlight layers are created.

## Root Cause

The `EventProcessingServer` (utility process) sends `REPOSITORY_INFO_REQUEST` messages to get git repository info for path normalization, but `EventServerManager` (main process) **doesn't handle this message type**.

### Data Flow (Current - Broken)

```
1. Agent event arrives at utility process
2. EventProcessingServer calls PathNormalizationService.normalizePaths()
3. PathNormalizationService calls adapter.getRawRepositoryInfo(path)
4. ServerPathNormalizationAdapter sends REPOSITORY_INFO_REQUEST to main process
5. EventServerManager.handleWorkerMessage() receives message
6. ❌ No handler for REPOSITORY_INFO_REQUEST - message is ignored
7. Request times out or returns null
8. PathNormalizationService skips adding repository info
9. Files have {path, context} but NO {repository.relativePath}
10. EventHighlightService.extractFilePaths() filters out files without repository.relativePath
11. No layers are created
```

## Evidence

Console logs show files arriving without repository info:

```javascript
files: [{
  context: "user_file",
  path: "packages/vanta-sdk/src/index.ts"
  // MISSING: repository.relativePath
}]
```

## Fix Required

### 1. Add handler in EventServerManager

**File:** `src/main/agent-session-events/EventServerManager.ts`

In `handleWorkerMessage()`, add handling for `REPOSITORY_INFO_REQUEST`:

```typescript
private async handleWorkerMessage(msg: ServerToMainMessage): Promise<void> {
  // ... existing handlers ...

  // ADD THIS:
  if (msg.type === 'REPOSITORY_INFO_REQUEST') {
    const repoInfo = await this.getRepositoryInfo(msg.absolutePath);
    this.sendToWorker({
      type: 'REPOSITORY_INFO_RESPONSE',
      id: msg.id,
      timestamp: Date.now(),
      repositoryInfo: repoInfo,
    });
    return;
  }
}

// ADD THIS METHOD:
private async getRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
  try {
    // Use git service to get repository info
    // Could use simple-git or existing git utilities
    const simpleGit = require('simple-git');
    const git = simpleGit(path.dirname(absolutePath));

    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;

    const root = await git.revparse(['--show-toplevel']);
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find(r => r.name === 'origin');

    return {
      gitRoot: root.trim(),
      remoteUrl: originRemote?.refs?.fetch,
      // Parse owner/repo from remote URL if needed
    };
  } catch (error) {
    console.error('[EventServerManager] Failed to get repository info:', error);
    return null;
  }
}
```

### 2. Update types if needed

**File:** `src/event-processing-server/types.ts`

Ensure these message types exist:

```typescript
interface RepositoryInfoRequest extends BaseServerMessage {
  type: 'REPOSITORY_INFO_REQUEST';
  absolutePath: string;
}

interface RepositoryInfoResponse extends BaseServerMessage {
  type: 'REPOSITORY_INFO_RESPONSE';
  repositoryInfo: RepositoryInfo | null;
}
```

### 3. Verify EventProcessingServer handles response

**File:** `src/event-processing-server/EventProcessingServer.ts`

Check that `makeRequest()` properly awaits the `REPOSITORY_INFO_RESPONSE`.

## Files Changed for Debugging (Remove Later)

These files have console.log statements added for debugging:

| File | Log Prefix |
|------|------------|
| `electron-app/src/renderer/services/EventHighlightService.ts` | `[EventHighlightService]` |
| `electron-app/src/renderer/contexts/AgentHighlightContext.tsx` | `[AgentHighlightContext]` |
| `electron-app/src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` | `[DevWorkspacePanelFramework]` |
| `file-city-panel/src/panels/CodeCityPanel.tsx` | `[CodeCityPanel]` |

## Other Changes Made

### 1. ID Prefix Fix

**File:** `src/renderer/services/EventHighlightService.ts`

Changed layer ID from `event-${sessionId}-${timestamp}` to `event-highlight-${sessionId}-${timestamp}` to match what CodeCityPanel expects.

### 2. file-city-panel v0.2.16

Published with:
- Agent layers now merge with git layers (instead of replacing them)
- Added storybook stories for agent session events
- Debug logging (to be removed after fix)

## Testing After Fix

1. Start the app with a dev workspace open
2. Run an agent (Claude Code, Cline, etc.) that reads/writes files
3. Check console for:
   - `[EventHighlightService] processEvent called` - events arriving
   - `[EventHighlightService] Created layer` - layers with items
   - `[CodeCityPanel] Processing layers` - `hasAgentLayers: true`
4. Files should highlight in File City with operation-based colors

## Color Reference

| Operation | Color |
|-----------|-------|
| READ | Blue (#3b82f6) |
| WRITE | Green (#22c55e) |
| CREATE | Emerald (#10b981) |
| EDIT | Amber (#f59e0b) |
| DELETE | Red (#ef4444) |
| SEARCH | Purple (#8b5cf6) |
| LIST | Indigo (#6366f1) |
