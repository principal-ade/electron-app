# User Collections Feature

## Overview

User Collections allows users to organize GitHub repositories into custom collections that sync to GitHub. This feature integrates the `@principal-ai/alexandria-collections` library into the electron-app, providing a way for logged-in users to curate and manage groups of repositories.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              GitHub                                      │
│                     (web-ade-collections repo)                          │
│                   ┌─────────────────────────────┐                       │
│                   │  collections.json           │                       │
│                   │  collection-memberships.json│                       │
│                   └─────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ GitHub API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Main Process                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CollectionsService                            │   │
│  │  - CRUD operations for collections                               │   │
│  │  - GitHub sync (create repo, push/pull data)                     │   │
│  │  - Membership management                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ IPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Renderer Process                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                WorkspacesPanelContext                            │   │
│  │  - userCollections slice (collections, memberships, sync status) │   │
│  │  - collectionRepositories slice (selected collection's repos)    │   │
│  │  - Collection CRUD actions                                       │   │
│  │  - Event listeners for selection                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│              ┌───────────────┼───────────────┐                         │
│              ▼               ▼               ▼                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐  │
│  │UserCollections  │ │CollectionRepos  │ │   Other Panels          │  │
│  │Panel (left)     │ │Panel (right)    │ │                         │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components

#### Main Process

| File | Purpose |
|------|---------|
| `src/main/services/CollectionsService.ts` | Core service handling GitHub storage, CRUD operations, and sync |
| `src/shared/main-process-api-interfaces/CollectionsAPI.ts` | IPC interface definitions and types |
| `src/window/main-process-api-implementations/collectionsApi.ts` | Preload bridge exposing API to renderer |

#### Renderer Process

| File | Purpose |
|------|---------|
| `src/renderer/main-process-api/CollectionsService.ts` | Service wrapper for IPC calls |
| `src/renderer/contexts/WorkspacesPanelContext.tsx` | State management, slices, and actions |
| `src/renderer/panels/CollectionRepositoriesPanel.tsx` | Displays repositories in selected collection |

#### Shared Package (@industry-theme/alexandria-panels)

| File | Purpose |
|------|---------|
| `src/panels/UserCollectionsPanel/index.tsx` | Main panel UI for browsing/managing collections |
| `src/panels/UserCollectionsPanel/types.ts` | TypeScript types and interfaces |
| `src/panels/UserCollectionsPanel/tools.ts` | UTCP tools for AI agent integration |

## Data Structures

### Collection

```typescript
interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  theme?: string;
  isDefault?: boolean;
  suggestedClonePath?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
```

### CollectionMembership

```typescript
interface CollectionMembership {
  collectionId: string;
  repositoryId: string; // Format: "owner/repo"
  addedAt: number;
  metadata?: {
    pinned?: boolean;
    notes?: string;
    [key: string]: unknown;
  };
}
```

### UserCollectionsSlice

```typescript
interface UserCollectionsSlice {
  collections: Collection[];
  memberships: CollectionMembership[];
  loading: boolean;
  saving?: boolean;
  error?: string;
  gitHubRepoExists?: boolean;
  gitHubRepoUrl?: string | null;
}
```

## GitHub Storage

Collections are stored in a public GitHub repository named `web-ade-collections` in the user's account:

```
web-ade-collections/
├── collections.json           # Array of Collection objects
└── collection-memberships.json # Array of CollectionMembership objects
```

### Sync Behavior

- **On Load**: Checks if `web-ade-collections` repo exists, fetches data if it does
- **On Create/Update/Delete**: Pushes changes to GitHub with SHA conflict handling
- **Enable Sync**: Creates the `web-ade-collections` repo if it doesn't exist

## UI Integration

### WorkspacesView Layout

The Collections panel is integrated into the WorkspacesView three-panel layout:

```
┌─────────────────┬─────────────────────────┬─────────────────────┐
│   Left Panel    │     Middle Panel        │    Right Panel      │
│   (Tabs)        │                         │                     │
│ ┌─────────────┐ │  - Quality Grid         │  Dynamically shows: │
│ │ Collections │ │  - GitHub Projects      │  - Workspace Repos  │
│ ├─────────────┤ │  - GitHub Starred       │    (if workspace    │
│ │ Local       │ │                         │     selected)       │
│ ├─────────────┤ │                         │  - Collection Repos │
│ │ Workspaces  │ │                         │    (if collection   │
│ └─────────────┘ │                         │     selected)       │
└─────────────────┴─────────────────────────┴─────────────────────┘
```

### Selection Behavior

- Selecting a **workspace** clears collection selection → shows workspace repos on right
- Selecting a **collection** clears workspace selection → shows collection repos on right

## Available Actions

Actions provided by `WorkspacesPanelContext`:

| Action | Description |
|--------|-------------|
| `createCollection(name, description?, icon?)` | Create a new collection |
| `updateCollection(id, updates)` | Update collection properties |
| `deleteCollection(id)` | Delete a collection and its memberships |
| `addRepository(collectionId, repoId, metadata?)` | Add a repo to a collection |
| `removeCollectionRepository(collectionId, repoId)` | Remove a repo from a collection |
| `enableGitHubSync()` | Create the web-ade-collections repo |
| `refreshCollections()` | Reload collections from GitHub |
| `navigateToRepository(repoId)` | Open repo on GitHub in browser |

## Events

### Listened Events

| Event | Trigger |
|-------|---------|
| `industry-theme.user-collections:collection:selected` | User clicks a collection |

### Emitted Events

| Event | When |
|-------|------|
| `industry-theme.user-collections:collection:created` | Collection created |
| `industry-theme.user-collections:collection:deleted` | Collection deleted |
| `industry-theme.user-collections:collection:repository-added` | Repo added to collection |
| `industry-theme.user-collections:collection:repository-removed` | Repo removed from collection |

## UTCP Tools (AI Agent Integration)

The UserCollectionsPanel provides tools for AI agents:

| Tool | Description |
|------|-------------|
| `filter_collections` | Filter collections by name/description |
| `select_collection` | Select a collection by ID |
| `create_collection` | Create a new collection |
| `delete_collection` | Delete a collection |
| `add_repository_to_collection` | Add repo to collection |
| `remove_repository_from_collection` | Remove repo from collection |
| `enable_github_sync` | Enable GitHub sync |
| `refresh_collections` | Refresh from GitHub |

## Future Enhancements

The following features are planned but not yet implemented:

- [ ] Create Collection modal
- [ ] Edit Collection modal
- [ ] Add Repository modal (search GitHub repos to add)
- [ ] Drag-and-drop repos between collections
- [ ] Collection sharing/collaboration
- [ ] Import collections from other users
- [ ] Collection templates

## Dependencies

- `@principal-ai/alexandria-collections` - Type definitions
- `@industry-theme/alexandria-panels` - UserCollectionsPanel component
- `@principal-ade/panel-framework-core` - Panel framework
- `@principal-ade/industry-theme` - Theming
