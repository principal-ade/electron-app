# Local Projects IPC Data Flow

This document describes how local repository data flows through the IPC layers from the renderer to the Alexandria registry.

## What Problem Does This Solve?

Principal ADE needs to:

- **Track local repositories** registered by the user
- **Persist repository metadata** in the Alexandria registry
- **Broadcast changes** when repositories are added, updated, or removed

## Architecture Overview

### Data Flow

1. **RepositoryPanelContext** (React) calls AlexandriaService
2. **AlexandriaService** (renderer) uses window.mainProcess bridge
3. **Preload Bridge** exposes alexandriaApi via ipcRenderer
4. **IPC Channels** (alexandria:*) route to main process
5. **AlexandriaApiEventHandler** receives and delegates to service
6. **AlexandriaRegistryService** manages the actual registry
7. **AlexandriaOutpostManager** (@principal-ai/alexandria) handles storage

### Key Components

| Component | Layer | Purpose |
|-----------|-------|---------|
| RepositoryPanelContext | Renderer | React context consuming repo data |
| AlexandriaService | Renderer | Service wrapper for IPC calls |
| alexandriaApi | Preload | ipcRenderer.invoke() bridge |
| AlexandriaApiEventHandler | Main | IPC handler, delegates to service |
| AlexandriaRegistryService | Main | Business logic for registry |
| AlexandriaOutpostManager | External | File-based storage in ~/.alexandria |

## Storage

Repository data is stored in `~/.alexandria/` directory:
- Project registry entries
- Workspace configurations
- Remote URL mappings

Git remote URLs are discovered via `gitClientFactory` during registration.

## Broadcast Events

When repositories change, events are broadcast to all windows:
- `repository-added`: New repository registered
- `repository-updated`: Metadata changed
- `repository-removed`: Repository unregistered

## Design Decisions

### Why Alexandria Over electron-store?

The Alexandria registry provides:
- Cross-application compatibility
- User-accessible storage location
- Structured workspace organization
