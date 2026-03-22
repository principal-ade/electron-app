# Dev Server Buttons

## Overview

The dev server buttons in the dev workspace right sidebar provide one-click access to launch and manage various development servers. Each button automatically detects relevant packages in the codebase, manages the server lifecycle, and configures the panel layout for an optimal development experience.

## Supported Servers

| Server | Detection | Port Range | Command |
|--------|-----------|------------|---------|
| **Storybook** | `@storybook/*` dependencies | 6006-6020 | `npm run storybook -p {port}` |
| **Next.js** | `next` dependency + `dev` script | 3000-3020 | `npm run dev -p {port}` |

## What Problem Does This Solve?

Developers frequently need to launch dev servers. The traditional workflow involves:
1. Opening a terminal
2. Navigating to the right package directory
3. Running the correct command with flags
4. Waiting for it to start
5. Opening a browser tab
6. Manually arranging windows

The dev server buttons automate this entire workflow into a single click.

## Architecture

### Server-Specific Components

Each dev server type has its own:
- **Package Detection**: Scans codebase composition for relevant dependencies
- **Command Generation**: Builds the appropriate npm/npx command
- **Port Range**: Uses server-appropriate default ports

### Shared Infrastructure

All dev servers share:
- **Port Finding**: `findAvailablePort()` scans the configured range
- **Terminal Management**: Creates and manages terminal sessions
- **Panel Layout**: Configures workspace for dev server workflow
- **Port Waiting**: Polls until server is ready
- **Browser Navigation**: Opens localhost in embedded browser panel
- **Status Management**: Tracks idle/starting/running/error states

## Operations Available

### Starting a Dev Server
1. Detects all packages with relevant dependencies
2. Finds an available port in the server's range
3. Creates a dedicated terminal session
4. Configures panel layout: collapsed left, 50/50 middle/right split
5. Waits for server to be ready
6. Navigates embedded browser to server URL

### Stopping a Dev Server
1. Terminates the terminal session
2. Releases the port
3. Restores original panel layout
4. Resets button state to idle

### Multiple Package Support
- Dropdown selection when multiple packages exist
- Auto-selects single package if only one available
- Remembers selection within session

## Design Choices

### Server-Specific Port Ranges
Each server type uses its conventional default ports:
- Storybook: 6006 (range 6006-6020)
- Next.js: 3000 (range 3000-3020)

This avoids conflicts and matches developer expectations.

### Embedded Browser Panel
Instead of opening an external browser, we use the localhost browser panel for:
- Seamless integration with the workspace
- Automatic cleanup when stopping
- Consistent developer experience

### Terminal Context
Sessions are created with context `terminal:{owner}/{repo}:{server_type}` to:
- Enable session identification
- Support activity tracking across windows
- Allow targeted cleanup

### Layout Configuration
The layout change (collapse left, 50/50 middle/right) is intentional:
- Terminal in middle shows build output
- Browser on right shows the running app
- Left panel hidden to maximize preview space

## Adding New Server Types

To add support for a new dev server (e.g., Vite, Remix):

1. **Define detection logic**: What dependencies/scripts indicate this server?
2. **Set port range**: What's the conventional default port?
3. **Build command generator**: How to construct the run command?
4. **Register with shared infrastructure**: Plug into terminal, layout, and browser systems

The shared infrastructure handles the rest automatically.

## Error Scenarios

### No Packages Found
Button remains disabled. User needs to add the relevant dependencies.

### Port Exhausted
Error if all ports in range are in use. User should close other server instances.

### Server Start Timeout
30-second timeout while waiting for port. Terminal will show build errors if applicable.

### Server Crash
Button returns to idle state. Check terminal output for error details.

## Common Workflow Patterns

### Storybook
1. **Component Development**: Click Storybook → edit component → see changes in browser
2. **Story Writing**: Open story file in editor, preview immediately in browser

### Next.js
1. **Page Development**: Click Next.js → edit page → see hot reload in browser
2. **API Development**: Test API routes directly in the browser panel
