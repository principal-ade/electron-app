# Event-to-Highlight Mapping Guide

## Key Findings from agent-monitoring Library

After analyzing the agent-monitoring library, we discovered that **file path extraction is already done for us**! The `RepoNormalizedUniversalAgentSessionEvent` contains a `files` array with fully normalized path information.

## Event Structure (What We Actually Receive)

```typescript
interface RepoNormalizedUniversalAgentSessionEvent {
  // Event identity
  eventType: 'pre-tool-use' | 'post-tool-use' | 'stop' | 'session-start' | etc.
  sessionId: string;
  timestamp: number;
  provider: 'claude' | 'cline' | 'opencode';

  // Tool information (for tool events)
  toolName?: string;              // e.g., 'Read', 'Write', 'Edit', 'Grep'
  toolInput?: any;
  toolOutput?: any;
  operation?: FileOperation;      // 'read' | 'write' | 'edit' | 'search' | 'list'

  // Repository context
  repository?: {
    root: string;                 // e.g., '/Users/dev/electron-app'
    remoteUrl?: string;
    owner?: string;
    repo?: string;
    branch?: string;
    headCommit?: string;
  };

  // 🎯 THE MAGIC: Already normalized file paths!
  files?: NormalizedPathInfo[];   // ← This is what we need!

  workingDirectory: string;
  raw: any;                       // Original raw event
}

interface NormalizedPathInfo {
  originalPath: string;           // As provided by tool
  absolutePath: string;           // Fully resolved
  context: PathContext;           // 'repo_file' | 'system_file' | 'user_file' | 'temp_file' | 'config_file'

  repository?: {
    gitRoot: string;              // Absolute path to git root
    relativePath: string;         // ← Perfect for Code City! e.g., 'src/main/window.ts'
    remoteUrl?: string;
    owner?: string;
    repo?: string;
  };

  displayPath: string;            // Best path for UI display
}
```

## Simple Mapping Strategy

### Step 1: Filter Events
```typescript
// Only show events for current repository
const eventRepoRoot = event.repository?.root;
if (eventRepoRoot !== currentRepositoryPath) {
  return; // Skip
}
```

### Step 2: Extract Paths from `files` Array
```typescript
function getHighlightPaths(event: RepoNormalizedUniversalAgentSessionEvent): string[] {
  if (!event.files || event.files.length === 0) {
    return [];
  }

  // Filter to only repo files, get relative paths
  return event.files
    .filter(file => file.context === 'repo_file')  // Ignore system/temp files
    .map(file => file.repository?.relativePath)    // Get repo-relative path
    .filter(Boolean) as string[];                  // Remove nulls
}
```

### Step 3: Create Highlight Layer
```typescript
function createHighlightLayer(
  event: RepoNormalizedUniversalAgentSessionEvent
): HighlightLayer | null {
  const paths = getHighlightPaths(event);

  if (paths.length === 0) {
    return null; // No files to highlight
  }

  return {
    id: `event-highlight-${event.sessionId}-${event.timestamp}`,
    name: `${event.provider} - ${event.toolName || event.eventType}`,
    enabled: true,
    color: getEventColor(event),
    opacity: 0.8,
    priority: 50,
    items: paths.map(path => ({
      path,                        // Already relative! e.g., 'src/main.ts'
      type: 'file' as const,
      renderStrategy: 'fill' as const,
    })),
  };
}
```

## Color Mapping by Tool Operation

```typescript
function getEventColor(event: RepoNormalizedUniversalAgentSessionEvent): string {
  // Use operation if available (more accurate)
  if (event.operation) {
    const colorMap: Record<FileOperation, string> = {
      read: '#3b82f6',      // Blue
      write: '#22c55e',     // Green
      create: '#10b981',    // Emerald
      edit: '#f59e0b',      // Amber
      delete: '#ef4444',    // Red
      search: '#8b5cf6',    // Purple
      list: '#6366f1',      // Indigo
    };
    return colorMap[event.operation] || '#6b7280';
  }

  // Fallback to tool name
  const toolName = event.toolName?.toLowerCase() || '';
  if (toolName.includes('read')) return '#3b82f6';
  if (toolName.includes('write')) return '#22c55e';
  if (toolName.includes('edit')) return '#f59e0b';
  if (toolName.includes('grep') || toolName.includes('search')) return '#8b5cf6';

  // Fallback to event type
  if (event.eventType === 'session-start') return '#10b981';
  if (event.eventType === 'stop') return '#6366f1';

  return '#6b7280'; // Gray default
}
```

## Example Real Event

Here's what an actual event looks like:

```json
{
  "eventType": "pre-tool-use",
  "sessionId": "claude-1234567890",
  "timestamp": 1710000000000,
  "provider": "claude",
  "toolName": "Read",
  "toolInput": {
    "file_path": "/Users/dev/electron-app/src/main/window.ts"
  },
  "operation": "read",
  "repository": {
    "root": "/Users/dev/electron-app",
    "owner": "myorg",
    "repo": "electron-app",
    "branch": "main"
  },
  "files": [
    {
      "originalPath": "/Users/dev/electron-app/src/main/window.ts",
      "absolutePath": "/Users/dev/electron-app/src/main/window.ts",
      "context": "repo_file",
      "repository": {
        "gitRoot": "/Users/dev/electron-app",
        "relativePath": "src/main/window.ts",  // ← Use this!
        "owner": "myorg",
        "repo": "electron-app"
      },
      "displayPath": "src/main/window.ts"
    }
  ],
  "workingDirectory": "/Users/dev/electron-app"
}
```

To create a highlight:
```typescript
{
  id: "event-claude-1234567890-1710000000000",
  name: "claude - Read",
  enabled: true,
  color: "#3b82f6",  // Blue for read
  opacity: 0.8,
  priority: 50,
  items: [
    {
      path: "src/main/window.ts",  // From files[0].repository.relativePath
      type: "file",
      renderStrategy: "fill"
    }
  ]
}
```

## Events Without Files

Some events won't have `files`:
- `session-start` / `stop` - Lifecycle events
- `notification` - Just messages
- `user-prompt-submit` - User input

These should be tracked in history but **not create highlight layers**.

## Filter Strategy

1. **Repository Filter**: `event.repository?.root === currentRepoPath`
2. **File Context Filter**: Only show `repo_file` context (skip system/temp files)
3. **Empty Files Filter**: Skip events with no `files` array

## Tool Coverage

The agent-monitoring library extracts paths from:
- ✅ Read, Write, Edit, MultiEdit
- ✅ Grep, Glob, LS (from output)
- ✅ NotebookRead, NotebookEdit
- ✅ Bash (extracts from stdout)
- ✅ MCP tools (various field names)
- ✅ Gemini tools (read_file, write_file, etc.)

## Implementation Checklist

- [x] AgentEventsPanel - displays raw events
- [x] Event structure documentation
- [ ] EventHighlightService - converts events to layers
  - [ ] Filter by repository
  - [ ] Extract paths from `files` array
  - [ ] Create HighlightLayer objects
  - [ ] Color mapping by operation
  - [ ] History management (circular buffer)
- [ ] Navigation controls
  - [ ] Previous/Next buttons
  - [ ] Live mode toggle
  - [ ] Clear history
- [ ] Integration with DevelopmentWorkspace
  - [ ] Pass highlight layers to visualization
  - [ ] Update on event reception

## Next Steps

Now that we know the structure, implementation is straightforward:

1. **Use `event.files[].repository.relativePath`** - no complex parsing needed!
2. **Filter by `event.repository.root`** - matches current repo
3. **Filter by `file.context === 'repo_file'`** - ignore system files
4. **Map `event.operation`** - for accurate color coding

The agent-monitoring library has done the heavy lifting for us! 🎉
