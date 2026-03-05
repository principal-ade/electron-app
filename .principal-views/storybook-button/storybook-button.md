# Storybook Button

## Overview

The Storybook button in the dev workspace right sidebar (below File City) provides one-click access to launch and manage Storybook for component development. It automatically detects Storybook packages in the codebase, manages the server lifecycle, and configures the panel layout for an optimal development experience.

## What Problem Does This Solve?

Developers working on component libraries need to frequently switch between code editing and Storybook preview. The traditional workflow involves:
1. Opening a terminal
2. Navigating to the right package directory
3. Running the storybook command with correct flags
4. Waiting for it to start
5. Opening a browser tab
6. Manually arranging windows

The Storybook button automates this entire workflow into a single click.

## Operations Available

### Starting Storybook
- Detects all packages with `@storybook/*` dependencies
- Finds an available port (6006-6020 range)
- Creates a dedicated terminal session
- Configures panel layout: collapsed left, 50/50 middle/right split
- Waits for server to be ready
- Navigates embedded browser to Storybook URL

### Stopping Storybook
- Terminates the terminal session
- Releases the port
- Restores original panel layout
- Resets button state to idle

### Multiple Package Support
- Dropdown selection when multiple Storybook packages exist
- Auto-selects single package if only one available
- Remembers selection within session

## Design Choices

### Port Range (6006-6020)
Storybook defaults to port 6006. We scan a range to handle multiple instances or conflicts with other dev servers.

### Embedded Browser Panel
Instead of opening an external browser, we use the localhost browser panel for:
- Seamless integration with the workspace
- Automatic cleanup when stopping
- Consistent developer experience

### Terminal Context
Sessions are created with context `terminal:{owner}/{repo}:storybook` to:
- Enable session identification
- Support activity tracking across windows
- Allow targeted cleanup

### Layout Configuration
The layout change (collapse left, 50/50 middle/right) is intentional:
- Terminal in middle shows Storybook build output
- Browser on right shows component preview
- Left panel hidden to maximize preview space

## Common Workflow Patterns

1. **Component Development**: Click Storybook -> edit component -> see changes in browser
2. **Story Writing**: Open story file in editor, preview immediately in browser
3. **Visual Testing**: Use Storybook's built-in tools in the browser panel

## Error Scenarios

### No Storybook Packages Found
Button remains disabled. User needs to add `@storybook/*` dependencies.

### Port Exhausted
Error if all ports 6006-6020 are in use. User should close other Storybook instances.

### Server Start Timeout
30-second timeout while waiting for port. Terminal will show build errors if applicable.

### Server Crash
Button returns to idle state. Check terminal output for error details.
