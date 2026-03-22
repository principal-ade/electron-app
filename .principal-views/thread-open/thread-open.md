# Thread Opening Flow

This document describes how development threads are created and grown, with telemetry instrumentation at each step.

## Problem Solved

The workspace model required upfront planning:
- Create a named workspace before working
- Formally associate repositories with workspaces
- Mental overhead of "which workspace does this belong to?"

Threads flip this model:
- **Start anywhere** - Open any repository, no pre-registration needed
- **Grow organically** - Add repositories as your work expands
- **Ephemeral by default** - No persistence required, save only if desired
- **Repository-first** - The work defines the grouping, not the other way around

## Core Concepts

### Thread
A thread is an active working session anchored by one or more repositories. Unlike workspaces:
- Threads don't require pre-creation
- Threads are identified by their anchor repository initially
- Threads can expand to include additional repositories
- Threads can optionally be saved as named collections

### Anchor Repository
The first repository that opens a thread. Used for:
- Thread identification (before explicit naming)
- Window naming: `thread-{repo-name}` or `thread-{sanitized-path}`
- Default working directory for terminals

### Thread Expansion
Adding repositories to an existing thread:
- Drag-and-drop from file system
- "Add to thread" from repository browser
- CLI: `principal open --add-to-current /path/to/repo`

## Thread Lifecycle

### 1. User Trigger (Renderer)
Entry points for starting a thread:
- **Repository card click** - Start thread from this repo
- **File system drop** - Drop a folder to start/expand thread
- **CLI command** - `principal open /path/to/repo`
- **Recent projects** - Resume from a previously opened repo

**Parameters:**
- `repositoryPath` - Local path to the repository (required)
- `repositoryId` - PURL identifier if known (optional)
- `threadId` - Existing thread to join (optional, for expansion)

### 2. Thread Resolution (Main)
Determine thread identity and state:
1. If `threadId` provided → find existing thread window
2. If repository already open → focus that thread
3. Otherwise → create new thread anchored to this repository

**No registry lookup required** - threads emerge from usage.

### 3. Window Creation/Focus (Main)
Either create a new window or focus an existing one:
- New thread: Create BrowserWindow, register with thread manager
- Existing thread: Focus window, optionally add repository

**Window naming:**
- Single repo: `thread-{repo-name}`
- Multiple repos: `thread-{anchor-repo-name}+{count-1}`
- Named thread: `thread-{user-name}`

### 4. Repository Watch Acquisition (Main, Background)
For each repository in the thread:
1. Validate local path exists
2. Call `monitoringManager.acquireWatch()`
3. Track for cleanup on window close

**Reference ID pattern:** `thread:{windowId}:{repoPath}`

### 5. URL Loading (Main → Renderer)
Load the thread UI with parameters:
- `?repository={path}` - Anchor repository
- `?threadId={id}` - Thread identifier (if named)
- `?repositories={paths}` - All repositories (comma-separated)

### 6. Renderer Initialization
Thread UI bootstraps:
1. Parse URL parameters
2. Initialize panel framework
3. Set up repository context for anchor repo
4. Register for thread expansion events
5. Render initial layout

### 7. Thread Ready State
Thread is ready when:
- Window is visible and focused
- Anchor repository is loaded
- File watches are active
- Terminal routing is established

## Thread Expansion Flow

### Adding a Repository to an Existing Thread

1. **User action** - Drop folder, click "Add", or CLI command
2. **Validation** - Check path is valid git repository
3. **Duplication check** - Is this repo already in the thread?
4. **Watch acquisition** - Start monitoring the new repo
5. **UI update** - Add to repository list, notify panels
6. **Event broadcast** - `thread.repository.added`

### Removing a Repository from a Thread

1. **User action** - Close repo tab or "Remove from thread"
2. **Watch release** - Stop monitoring
3. **UI update** - Remove from list
4. **Thread dissolution** - If last repo removed, close thread

## Saving Threads as Collections

Threads are ephemeral by default. To persist:

1. **User action** - "Save thread as collection"
2. **Name prompt** - User provides a name
3. **Persistence** - Store repository paths and thread metadata
4. **Future access** - Appears in "Recent" and "Collections"

Collections are just saved thread configurations, not a separate concept.

## Error Scenarios

### Repository Path Invalid
If the path doesn't exist or isn't a git repo:
- Show error in UI
- Thread can still open with other repos
- Invalid repo is skipped, not blocking

### Repository Already in Another Thread
If a repo is open in another thread window:
- Option 1: Focus that window instead
- Option 2: Allow multi-thread (same repo, different contexts)
- User preference controls behavior

### All Repositories Removed
If user removes all repositories from a thread:
- Thread window closes
- No empty threads allowed

## Telemetry Events

| Event | Process | Purpose |
|-------|---------|---------|
| `thread.open.requested` | Renderer | Tracks thread start trigger |
| `thread.ipc.invoke` | Renderer | IPC call timing |
| `thread.handler.received` | Main | Handler entry point |
| `thread.resolved` | Main | Thread identity determined |
| `thread.window.creating` | Main | New window creation |
| `thread.window.focusing` | Main | Existing window focus |
| `thread.watches.acquired` | Main | Watch registration |
| `thread.app.initialized` | Renderer | Full renderer ready |
| `thread.ready` | Both | End-to-end completion |
| `thread.repository.added` | Both | Expansion event |
| `thread.repository.removed` | Both | Contraction event |
| `thread.saved` | Main | Persisted as collection |

## Migration from Workspaces

Existing workspaces can be migrated:
- Each workspace becomes a saved collection
- Repositories maintain their associations
- Window opening uses the new thread flow
- No user action required for basic usage

## Performance Considerations

- No registry lookup on open - faster cold start
- Watch acquisition parallelized across repos
- Thread identity is local to window - no central coordination
- Expansion is incremental - no full reload needed
