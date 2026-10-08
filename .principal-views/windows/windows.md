# Window Architecture

This document describes the window management system in Principal ADE.

## What Problem Does This Solve?

Principal ADE uses multiple specialized windows for different tasks:

- **Workspace windows** for development activities
- **Viewer windows** for content display
- **Utility windows** for quick actions

The window system needs to:
- Create and manage different window types
- Handle window lifecycle events
- Enable inter-window communication

## Window Types

### Primary Windows

| Window | Purpose | Entry Point |
|--------|---------|-------------|
| Main Window | Primary navigation | principal.html |
| Repository Maps | Code City visualization | - |

### Workspace Windows

| Window | Purpose | Entry Point |
|--------|---------|-------------|
| Dev Workspace | Development environment | dev-workspace.html |

### Viewer Windows

| Window | Purpose |
|--------|---------|
| Markdown Viewer | Render markdown files |
| Store Viewer | Debug application state |

### Utility Windows

| Window | Shortcut | Purpose |
|--------|----------|---------|
| Window Switcher | Cmd+' | Quick window navigation |
| Quick Open | Cmd+O | File/command palette |

### External Windows

| Window | Purpose |
|--------|---------|
| Extension Browser | Third-party extensions |
| Remote Agent | Remote terminal sessions |

## ModernWindowManager

The `ModernWindowManager` centralizes window creation and lifecycle:

- **Creates windows** with consistent configuration
- **Manages window state** (position, size, focus)
- **Handles window events** (close, minimize, etc.)

## Design Decisions

### Why Multiple Window Types?

Different tasks benefit from dedicated UIs:
- Workspaces have complex panel layouts
- Viewers are lightweight and focused
- Utilities are transient overlays

### Why Centralized Management?

`ModernWindowManager` provides:
- Consistent window creation patterns
- Centralized state tracking
- Simplified IPC routing
