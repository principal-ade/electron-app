# Alexandria Workspace Window

The Alexandria Workspace window provides a multi-repository workspace management interface. It allows users to organize multiple repositories into logical workspaces and manage them from a unified panel-based UI.

## Problem Solved

Developers often work across multiple related repositories. Without workspace support, users must:
- Open each repository in separate windows
- Manually track which repos belong together
- Lose context when switching between related projects

The Alexandria Workspace solves this by grouping repositories into named workspaces with:
- Persistent workspace definitions
- Quick repository switching
- Shared terminal context
- Visual codebase exploration across repos

## Key Operations

### Workspace Management
- **Create workspace** - Define a new workspace with name, description, and optional clone path
- **Add/remove repositories** - Associate repositories with workspaces
- **Set default workspace** - Designate a workspace to open on startup

### Repository Operations
- **Select repository** - Switch focus to a specific repo within the workspace
- **Open in dev workspace** - Launch a dedicated window for focused work
- **Move to workspace directory** - Relocate repository files to the workspace's clone path

### Panel Navigation
- **Panel sidebar** (right side) - Quick access to different views
- **Collapsible panels** - Maximize workspace for focused work
- **Event-driven communication** - Panels react to selections and changes

## Architecture Decisions

### Why Panel-Based UI?
The three-panel layout (left/middle/right) provides flexibility:
- Left panel for navigation and selection
- Middle panel for primary work (terminal)
- Right panel for context and visualization

### Why IPC-Based Storage?
Workspace data is stored via the main process because:
- Centralized data management across multiple windows
- File system access without renderer restrictions
- Event broadcasting to keep all windows in sync

### Why Alexandria Library?
The `@principal-ai/alexandria-core-library` provides:
- Battle-tested repository registry
- Workspace-repository membership tracking
- GitHub metadata enrichment
- Cross-platform file system abstraction

## Common Workflows

### Starting a New Project
1. Create a workspace with a descriptive name
2. Set a `suggestedClonePath` for new repo clones
3. Add existing repositories or clone new ones
4. Repositories are automatically watched for git changes

### Daily Development
1. Open workspace window from main launcher
2. Select repository from workspace repos panel
3. Use terminal for commands, file city for visualization
4. Switch repositories as needed - context persists

## Error Scenarios

### Repository Path Changed Externally
If a repository is moved outside the app:
- The registry entry becomes stale
- The workspace will show the repo as missing
- User must re-register or remove the repository

### Workspace Directory Deleted
If the workspace's `suggestedClonePath` is deleted:
- New clones will fail until path is updated
- Existing repos continue to work from their locations
