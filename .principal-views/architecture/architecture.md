# Principal ADE System Architecture

This document describes the high-level system architecture of the Principal ADE desktop application.

## What Problem Does This Solve?

Principal ADE is a desktop development environment that needs to:

- **Manage multiple processes** (main, renderer, worker) with clear boundaries
- **Integrate external services** (GitHub, WorkOS, OpenRouter) securely
- **Access local resources** (file system, Git, Docker, terminal) safely
- **Persist data** across sessions with secure storage

## Architecture Overview

### Process Model

The application follows Electron's multi-process architecture:

- **Main Process**: Orchestrates everything, manages windows, handles IPC, spawns workers
- **Renderer Processes**: React-based UI in BrowserWindow contexts
- **Worker Process**: Background file monitoring and heavy computation

### External Integrations

| Service | Purpose | Protocol |
|---------|---------|----------|
| GitHub API | Repository operations, user data | REST/HTTP |
| WorkOS | Authentication, SSO | OAuth + REST |
| OpenRouter | AI model access | REST |
| Git Sync Server | Real-time collaboration | WebSocket |

### Local Resources

| Resource | Access Method |
|----------|---------------|
| File System | Node.js `fs` module |
| Git CLI | Child process spawn |
| Docker | Docker API |
| Terminal | node-pty |
| OS Keychain | Electron safeStorage |

## Design Decisions

### Why Separate Worker Process?

File system monitoring (chokidar) and tree building are CPU-intensive. Running them in a utility process:
- Keeps main process responsive
- Isolates crashes
- Enables parallel processing

### Why Multiple Storage Layers?

- **OS Keychain**: Sensitive tokens (encrypted by OS)
- **App Storage**: User preferences, workspace state
- **Local Repositories**: Git-managed code

## Security Considerations

- All external API calls go through main process
- Renderer processes use preload bridges (no direct Node.js access)
- Tokens stored with OS-level encryption
