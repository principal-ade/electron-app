# Discovered Repositories Feature

## Overview

The Discovered Repositories feature scans a configured "home folder" for git repositories that are not yet tracked in Alexandria, displaying them alongside tracked repositories in the Local Projects panel with visual distinction and action buttons.

## User Experience

### What Users See

In the **Local Projects Panel**, users see:
- **Tracked repositories** - Full-featured cards with Open, Remove actions
- **Discovered repositories** - Cards with an "Untracked" badge and Track + Open buttons

The panel header includes:
- Search toggle
- Sort toggle (by name or organization)
- **Scan button** (RefreshCw icon) - manually triggers a scan, spins while loading
- Add button (+) - manually add a project via directory picker

### Actions

| Repository Type | Available Actions |
|----------------|-------------------|
| Tracked | Open, Remove |
| Discovered | Track (add to Alexandria), Open |

## Configuration

The scan uses the `baseDefaultDirectory` user preference as the root folder to scan. This is configured in the app's user preferences.

**Default scan depth:** 2 levels (catches patterns like `~/Developer/org/repo`)

## Architecture

### Data Flow

```
User clicks Scan
       │
       ▼
LocalProjectsPanel.handleScanForRepos()
       │
       ▼
context.refresh('repository', 'alexandriaRepositories')
       │
       ▼
WorkspacesPanelContext fetches discovered repos
       │
       ▼
GitService.getDiscoveredRepos(baseDefaultDirectory)
       │
       ▼
IPC: 'git:get-discovered-repos'
       │
       ▼
GitRepositoryScannerService.getDiscoveredRepositories()
       │
       ▼
Returns repos not in Alexandria registry
```

### Components

#### Backend (electron-app)

| File | Purpose |
|------|---------|
| `src/main/file-system/gitRepositoryScannerService.ts` | Singleton service that scans folders for `.git` directories |
| `src/main/file-system/gitHandlers.ts` | IPC handlers for scan events |
| `src/shared/main-process-api-interfaces/GitAPI.ts` | IPC event definitions |
| `src/window/main-process-api-implementations/gitApi.ts` | Preload bridge methods |
| `src/renderer/main-process-api/GitService.ts` | Renderer service methods |
| `src/renderer/contexts/WorkspacesPanelContext.tsx` | Integration - loads discovered repos into slice |

#### Frontend (industry-themed-alexandria-entry-panels)

| File | Purpose |
|------|---------|
| `src/panels/LocalProjectsPanel/index.tsx` | Panel component with scan button and merged repo list |
| `src/panels/LocalProjectsPanel/LocalProjectCard.tsx` | Card component with `discovered` action mode |
| `src/panels/LocalProjectsPanel/types.ts` | Types including `DiscoveredRepository` and `CardActionMode` |
| `src/panels/LocalProjectsPanel/LocalProjectsPanel.css` | CSS including spin animation |

## Key Types

```typescript
// Discovered repository from scanner
interface DiscoveredRepository {
  path: string;      // Absolute path to repository
  name: string;      // Directory name
  isTracked: false;  // Always false for discovered repos
}

// Card action modes
type CardActionMode =
  | 'default'           // Tracked repo - Open, Remove
  | 'add-to-workspace'  // Adding to workspace flow
  | 'minimal'           // Minimal UI
  | 'workspace'         // Workspace context
  | 'discovered';       // Untracked - Track, Open

// Extended slice with discovered repos
interface AlexandriaRepositoriesSlice {
  repositories: AlexandriaEntry[];
  discoveredRepositories: DiscoveredRepository[];
  loading: boolean;
  error?: string;
}
```

## Scanner Behavior

The `GitRepositoryScannerService` recursively scans directories with these rules:

1. **Stops at git repos** - Doesn't recurse into repositories (no nested repo scanning)
2. **Respects max depth** - Default 2 levels deep
3. **Excludes common folders:**
   - `node_modules`
   - `.git`, `.svn`, `.hg`
   - `vendor`
   - `__pycache__`, `.cache`
   - `.npm`, `.yarn`
   - `Library`, `Applications`, `.Trash`
4. **Skips hidden folders** - Any folder starting with `.`
5. **Filters tracked repos** - Compares against Alexandria registry

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `industry-theme.local-projects:scan-completed` | `{ discoveredCount: number }` | Emitted after scan completes |
| `industry-theme.local-projects:repository-selected` | `{ entry: AlexandriaEntry }` | User selected a repository |
| `industry-theme.local-projects:repository-opened` | `{ entry: AlexandriaEntry }` | User opened a repository |

## Package Versions

- `@industry-theme/alexandria-panels@0.1.32` - Added scan button with loading state
- `@industry-theme/alexandria-panels@0.1.31` - Initial discovered repos feature
