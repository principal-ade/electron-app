# Agent Event Structure and Field Mapping

## Overview

This document catalogs the structure of `RepoNormalizedUniversalAgentSessionEvent` events received from the observability SDK, and provides guidance for mapping these events to highlight layers on the Code City visualization.

## Event Structure

### Core Event Fields

```typescript
interface RepoNormalizedUniversalAgentSessionEvent {
  // Identity
  sessionId: string;           // Unique session identifier
  eventType: string;           // Type of event (see Event Types below)
  timestamp: number;           // Unix timestamp in milliseconds
  agent: string;               // Agent name (e.g., 'claude', 'cline', 'opencode')
  provider: string;            // Provider/agent identifier

  // Repository Context
  repositoryInfo?: {
    root: string;              // Absolute path to repository root
    remoteUrl: string;         // Git remote URL
    owner: string;             // Repository owner
    repo: string;              // Repository name
    branch?: string;           // Current branch
    headCommit?: string;       // HEAD commit SHA
  };

  // Working Directory
  workingDirectory: string;    // Current working directory

  // Event Data (varies by event type)
  data?: Record<string, any>;

  // Additional metadata
  [key: string]: any;
}
```

## Event Types and File Path Extraction

### 1. `file_read`

**Description**: Agent read a file

**File Path Location**:

```typescript
event.data?.path: string
```

**Example**:

```json
{
  "eventType": "file_read",
  "data": {
    "path": "/Users/user/repo/src/components/Button.tsx",
    "content": "..."
  }
}
```

**Highlight Strategy**: Blue outline/fill to indicate file was read

***

### 2. `file_write`

**Description**: Agent created or overwrote a file

**File Path Location**:

```typescript
event.data?.path: string
```

**Example**:

```json
{
  "eventType": "file_write",
  "data": {
    "path": "/Users/user/repo/src/utils/helper.ts",
    "content": "..."
  }
}
```

**Highlight Strategy**: Green fill to indicate new/written file

***

### 3. `file_edit`

**Description**: Agent modified an existing file

**File Path Location**:

```typescript
event.data?.path: string
```

**Example**:

```json
{
  "eventType": "file_edit",
  "data": {
    "path": "/Users/user/repo/src/App.tsx",
    "diff": "...",
    "oldContent": "...",
    "newContent": "..."
  }
}
```

**Highlight Strategy**: Amber/orange fill to indicate modification

***

### 4. `tool_use`

**Description**: Agent executed a tool (may involve multiple files)

**File Path Locations** (check all):

```typescript
event.data?.parameters?.file_path: string
event.data?.parameters?.path: string
event.data?.parameters?.paths: string[]
```

**Example**:

```json
{
  "eventType": "tool_use",
  "data": {
    "tool": "grep",
    "parameters": {
      "pattern": "useState",
      "paths": [
        "/Users/user/repo/src/hooks/useData.ts",
        "/Users/user/repo/src/components/DataView.tsx"
      ]
    }
  }
}
```

**Highlight Strategy**: Purple outline to indicate tool interaction

***

### 5. `error`

**Description**: An error occurred during agent operation

**File Path Location**:

```typescript
event.data?.path?: string
event.data?.file?: string
```

**Example**:

```json
{
  "eventType": "error",
  "data": {
    "message": "Failed to parse file",
    "path": "/Users/user/repo/src/broken.ts"
  }
}
```

**Highlight Strategy**: Red fill/outline to indicate error location

***

### 6. `session_start`

**Description**: Agent session started

**File Paths**: None (session-level event)

**Highlight Strategy**: No file highlighting

***

### 7. `session_end` / `stop`

**Description**: Agent session ended

**File Paths**: None (session-level event)

**Highlight Strategy**: No file highlighting

***

## Path Normalization Strategy

Events contain absolute file paths that need to be converted to repository-relative paths for highlight layers.

### Normalization Algorithm

```typescript
function normalizePathForMap(
  absolutePath: string,
  event: RepoNormalizedUniversalAgentSessionEvent
): string {
  const repoRoot = event.repositoryInfo?.root;

  if (!repoRoot) {
    // Fallback: try to extract relative path from absolute
    return absolutePath;
  }

  // Remove repository root prefix
  if (absolutePath.startsWith(repoRoot)) {
    // Remove root + path separator
    return absolutePath.substring(repoRoot.length + 1);
  }

  return absolutePath;
}
```

### Example

```typescript
// Input
absolutePath = "/Users/user/Developer/electron-app/src/main/window.ts"
event.repositoryInfo.root = "/Users/user/Developer/electron-app"

// Output
relativePath = "src/main/window.ts"
```

## Color Mapping Reference

| Event Type      | Color   | Hex Code  | Use Case                       |
| --------------- | ------- | --------- | ------------------------------ |
| `file_read`     | Blue    | `#3b82f6` | File reading operations        |
| `file_write`    | Green   | `#22c55e` | File creation/write operations |
| `file_edit`     | Amber   | `#f59e0b` | File modification operations   |
| `tool_use`      | Purple  | `#8b5cf6` | Tool executions                |
| `error`         | Red     | `#ef4444` | Error events                   |
| `session_start` | Emerald | `#10b981` | Session lifecycle              |
| `session_end`   | Indigo  | `#6366f1` | Session lifecycle              |
| Unknown         | Gray    | `#6b7280` | Fallback for unknown types     |

## Repository Filtering

Events should be filtered by repository before processing:

```typescript
function matchesRepository(
  event: RepoNormalizedUniversalAgentSessionEvent,
  currentRepoPath: string
): boolean {
  const eventRepoPath = event.repositoryInfo?.root || event.workingDirectory;
  return eventRepoPath === currentRepoPath;
}
```

## Complete Extraction Function

```typescript
function extractFilePaths(
  event: RepoNormalizedUniversalAgentSessionEvent
): string[] {
  const paths: string[] = [];

  switch (event.eventType) {
    case 'file_read':
    case 'file_write':
    case 'file_edit':
      if (event.data?.path) {
        paths.push(event.data.path);
      }
      if (event.data?.file) {
        paths.push(event.data.file);
      }
      break;

    case 'tool_use':
      if (event.data?.parameters) {
        const params = event.data.parameters;

        // Single file_path
        if (params.file_path) {
          paths.push(params.file_path);
        }

        // Single path
        if (params.path) {
          paths.push(params.path);
        }

        // Multiple paths
        if (params.paths && Array.isArray(params.paths)) {
          paths.push(...params.paths);
        }
      }
      break;

    case 'error':
      if (event.data?.path) {
        paths.push(event.data.path);
      }
      if (event.data?.file) {
        paths.push(event.data.file);
      }
      break;
  }

  // Filter out empty/undefined paths
  return paths.filter(Boolean);
}
```

## Testing Checklist

When implementing event-to-highlight mapping, test with:

* [ ] Single file operations (`file_read`, `file_write`, `file_edit`)
* [ ] Multi-file tool operations (`tool_use` with multiple paths)
* [ ] Path normalization (absolute → relative)
* [ ] Repository filtering (only show events for current repo)
* [ ] Unknown event types (should fall back gracefully)
* [ ] Events with missing `repositoryInfo`
* [ ] Events with missing `data` field
* [ ] Edge cases: empty paths, malformed data

## Event Examples from Real Usage

### Claude File Edit

```json
{
  "sessionId": "claude-1234567890",
  "eventType": "file_edit",
  "timestamp": 1710000000000,
  "agent": "claude",
  "provider": "claude",
  "repositoryInfo": {
    "root": "/Users/dev/project",
    "owner": "myorg",
    "repo": "myrepo",
    "branch": "main"
  },
  "workingDirectory": "/Users/dev/project",
  "data": {
    "path": "/Users/dev/project/src/App.tsx",
    "operation": "edit"
  }
}
```

### Cline Tool Use

```json
{
  "sessionId": "cline-0987654321",
  "eventType": "tool_use",
  "timestamp": 1710000100000,
  "agent": "cline",
  "provider": "cline",
  "repositoryInfo": {
    "root": "/Users/dev/project",
    "owner": "myorg",
    "repo": "myrepo",
    "branch": "feature/new"
  },
  "workingDirectory": "/Users/dev/project",
  "data": {
    "tool": "read_file",
    "parameters": {
      "file_path": "/Users/dev/project/package.json"
    }
  }
}
```

## Next Steps

1. ✅ AgentEventsPanel created - displays events in real-time
2. ⏳ Implement EventHighlightService with file path extraction
3. ⏳ Add highlight layer creation logic
4. ⏳ Test with live agent sessions
5. ⏳ Refine color mapping based on user feedback