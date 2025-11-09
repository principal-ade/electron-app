# Multi-Workspace Membership Design

## Overview

This document proposes an enhancement to the Alexandria repository management system to support **virtual workspaces** where repositories can belong to multiple logical workspaces simultaneously. This moves away from the folder-based workspace concept to a more flexible tag/collection-based system.

> **📢 Implementation Status:**
> ✅ **Core library implementation COMPLETE** as of @a24z/core-library v0.1.32 (released 2025-11-09)
>
> The `WorkspaceManager` class and all related functionality have been implemented by the core library team. This project has been updated to use the latest version. Next step: Electron app integration (Phase 2).

## Problem Statement

The current `FOLDER_WORKSPACES_DESIGN.md` proposes organizing repositories into workspace folders based on filesystem paths. This has several limitations:

1. **Physical constraint**: Repos must physically live inside workspace folders
2. **Single membership**: A repo can only belong to one workspace (determined by path)
3. **Path coupling**: Workspace membership is tightly coupled to filesystem location
4. **Cross-machine friction**: Different machines may have different folder structures
5. **Inflexible organization**: Can't organize the same repos in multiple ways

## Proposed Solution

### Virtual Workspaces with Many-to-Many Relationships

Move workspaces from UserPreferences to the Alexandria registry system, with repositories supporting membership in multiple workspaces:

```
Repository "owner/repo-name" can be in:
  - "Active Projects" workspace
  - "Electron Development" workspace
  - "Client Work" workspace

All local clones of this repository are visible when viewing the workspace.
Repository identity is based on GitHub owner/name, not filesystem location.
```

### Key Principles

1. **Repository-level membership**: Workspaces contain abstract repositories (identified by GitHub owner/name), not specific local clones
2. **Clone-agnostic**: All local clones of a repository are shown when viewing a workspace
3. **Many-to-many**: Repositories can belong to 0, 1, or many workspaces
4. **Core library responsibility**: All workspace management logic lives in the core library
5. **Path-independent**: Repository filesystem location doesn't determine workspace membership
6. **Alexandria-managed**: Workspace data lives in Alexandria registry alongside repository data
7. **Explicit assignment**: Users explicitly add/remove repositories from workspaces

### Leveraging AlexandriaRepository

The core library already has the perfect abstraction for this:

```typescript
// AlexandriaRepository = path-agnostic repository concept
interface AlexandriaRepository {
  name: string;
  github?: {
    id: string;        // Repository identity (owner/name format)
    owner: string;
    name: string;
    // ...
  };
  // ... no path field!
}

// AlexandriaEntry = specific local clone (extends AlexandriaRepository)
interface AlexandriaEntry extends AlexandriaRepository {
  path: string;        // The only difference: adds local path
}
```

Workspaces should operate at the **AlexandriaRepository level**, identifying repositories by `github.id` (owner/name). This means:
- Workspace membership is independent of local clones
- Multiple clones of the same repository are all visible in the workspace
- Workspaces can sync across machines (repository identity, not paths)

## Data Model

### Workspace Definition

```typescript
/**
 * A virtual workspace for organizing repositories
 * Stored and managed by Alexandria registry
 */
interface Workspace {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // Display name (e.g., "Active Projects")
  description?: string;          // Optional description
  color?: string;                // Optional UI color (hex or theme token)
  icon?: string;                 // Optional icon identifier
  isDefault?: boolean;           // Default workspace for new clones
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp

  // Optional: path hint for clone suggestions
  // If provided, suggests cloning to this directory
  // But repos don't have to live here to be in this workspace
  suggestedClonePath?: string;

  // Metadata
  metadata?: {
    [key: string]: unknown;      // Extensible metadata
  };
}
```

### Repository-Workspace Association

```typescript
/**
 * Maps repositories to workspaces (many-to-many)
 * Stored in Alexandria registry as separate mapping table
 *
 * IMPORTANT: Uses repository identity (github.id) not entry names,
 * so all local clones of a repository belong to the same workspaces
 */
interface WorkspaceMembership {
  repositoryId: string;          // Repository identity (github.id = "owner/name")
  workspaceId: string;           // Workspace identifier
  addedAt: number;               // Unix timestamp when added

  // Optional: workspace-specific metadata for this repository
  metadata?: {
    pinned?: boolean;            // Pin to top of workspace
    notes?: string;              // Workspace-specific notes
    [key: string]: unknown;      // Extensible
  };
}
```

**Why repository-level instead of clone-level?**

1. **Natural abstraction**: Matches existing `AlexandriaRepository` vs `AlexandriaEntry` separation
2. **User mental model**: Users think "I want electron-app in my Active Projects workspace", not "I want this specific clone at ~/dev/electron-app..."
3. **Multi-clone support**: All local clones automatically appear in workspace
4. **Cross-machine sync**: Repository identity (owner/name) is stable across machines, paths are not
5. **Simpler UX**: Don't have to manage workspace membership per clone

**How entries map to repositories:**

```typescript
// Core library provides mapping from Entry → Repository identity
function getRepositoryId(entry: AlexandriaEntry): string | null {
  // Primary: use GitHub identity
  if (entry.github?.id) {
    return entry.github.id; // "owner/name"
  }

  // Fallback: local-only repos without GitHub metadata
  // Use entry name as identity (less ideal but workable)
  return entry.name;
}
```

**Querying workspaces:**

```typescript
// Get all entries (clones) for repositories in a workspace
async function getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
  // 1. Get repository IDs in this workspace
  const memberships = await getMemberships(workspaceId);
  const repoIds = memberships.map(m => m.repositoryId);

  // 2. Find ALL entries matching these repository IDs
  const allEntries = getAllEntries();
  return allEntries.filter(entry => {
    const repoId = getRepositoryId(entry);
    return repoIds.includes(repoId);
  });
}
```

### Storage Structure

All workspace data stored within Alexandria registry (`.alexandria/` directory):

```
.alexandria/
├── registry.json              # Existing: repository entries
├── workspaces.json            # New: workspace definitions
└── workspace-memberships.json # New: repo-workspace mappings
```

**workspaces.json**:
```json
{
  "workspaces": [
    {
      "id": "ws-1234",
      "name": "Active Projects",
      "description": "Projects I'm currently working on",
      "color": "#4CAF50",
      "isDefault": true,
      "createdAt": 1699564800000,
      "updatedAt": 1699564800000,
      "suggestedClonePath": "/Users/dev/active"
    }
  ]
}
```

**workspace-memberships.json**:
```json
{
  "memberships": [
    {
      "repositoryId": "owner/electron-app",
      "workspaceId": "ws-1234",
      "addedAt": 1699564800000,
      "metadata": {
        "pinned": true
      }
    },
    {
      "repositoryId": "owner/web-dashboard",
      "workspaceId": "ws-1234",
      "addedAt": 1699651200000
    },
    {
      "repositoryId": "owner/electron-app",
      "workspaceId": "ws-5678",
      "addedAt": 1699737600000
    }
  ]
}
```

Note: All local clones of `owner/electron-app` will appear in both workspace `ws-1234` and `ws-5678`.

## Core Library API Requirements

This section defines what the **@a24z/core-library** package needs to implement. All workspace logic is the core library's responsibility. The Electron app will consume these APIs for UI rendering and user interactions.

### New Types to Export

```typescript
/**
 * Workspace type - should be exported from @a24z/core-library
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  suggestedClonePath?: string;
  metadata?: Record<string, unknown>;
}

/**
 * WorkspaceMembership type - should be exported from @a24z/core-library
 */
export interface WorkspaceMembership {
  repositoryId: string;    // github.id ("owner/name") or entry.name for local repos
  workspaceId: string;
  addedAt: number;
  metadata?: Record<string, unknown>;
}
```

### New WorkspaceManager Class

The core library should implement a `WorkspaceManager` class that handles all workspace operations:

```typescript
/**
 * WorkspaceManager - Manages workspaces and their memberships
 *
 * CORE LIBRARY RESPONSIBILITY:
 * - Store and retrieve workspace definitions
 * - Manage repository-workspace memberships
 * - Handle repository identity resolution (entry → repository ID)
 * - Cascade deletions when repositories are removed
 * - Provide query methods for UI consumption
 */
export class WorkspaceManager {
  constructor(
    private registryPath: string,
    private fsAdapter: FileSystemAdapter
  ) {}

  // ===== Workspace CRUD =====

  /**
   * Create a new workspace
   * Generates unique ID and timestamps
   */
  async createWorkspace(
    workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Workspace>

  /**
   * Get a workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace | null>

  /**
   * Get all workspaces
   */
  async getWorkspaces(): Promise<Workspace[]>

  /**
   * Update workspace properties
   */
  async updateWorkspace(
    id: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>
  ): Promise<Workspace>

  /**
   * Delete a workspace and all its memberships
   */
  async deleteWorkspace(id: string): Promise<boolean>

  // ===== Membership Management =====

  /**
   * Add a repository to a workspace
   * Accepts either an entry or a repository ID
   *
   * @param repository - AlexandriaEntry or repository ID string ("owner/name")
   * @param workspaceId - Workspace identifier
   * @param metadata - Optional workspace-specific metadata
   */
  async addRepositoryToWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
    metadata?: Record<string, unknown>
  ): Promise<void>

  /**
   * Remove a repository from a workspace
   *
   * @param repository - AlexandriaEntry or repository ID string
   * @param workspaceId - Workspace identifier
   */
  async removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<void>

  /**
   * Get all memberships for a workspace
   */
  async getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]>

  /**
   * Get all workspaces that contain a repository
   *
   * @param repository - AlexandriaEntry or repository ID string
   */
  async getRepositoryWorkspaces(
    repository: AlexandriaEntry | string
  ): Promise<Workspace[]>

  // ===== Query Methods =====

  /**
   * Get all entries (local clones) for repositories in a workspace
   * This includes ALL local clones of matching repositories
   *
   * @param workspaceId - Workspace identifier
   * @param projectRegistry - ProjectRegistryStore instance for querying entries
   * @returns Array of AlexandriaEntry objects
   */
  async getRepositoriesInWorkspace(
    workspaceId: string,
    projectRegistry: ProjectRegistryStore
  ): Promise<AlexandriaEntry[]>

  /**
   * Check if a repository is in a workspace
   *
   * @param repository - AlexandriaEntry or repository ID string
   * @param workspaceId - Workspace identifier
   */
  async isRepositoryInWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<boolean>

  /**
   * Get statistics about a workspace
   */
  async getWorkspaceStats(workspaceId: string): Promise<{
    repositoryCount: number;
    entryCount: number;
    lastUpdated: number;
  }>

  // ===== Bulk Operations =====

  /**
   * Add multiple repositories to a workspace
   */
  async addRepositoriesToWorkspace(
    repositories: (AlexandriaEntry | string)[],
    workspaceId: string
  ): Promise<void>

  /**
   * Remove multiple repositories from a workspace
   */
  async removeRepositoriesFromWorkspace(
    repositories: (AlexandriaEntry | string)[],
    workspaceId: string
  ): Promise<void>

  // ===== Default Workspace =====

  /**
   * Get the default workspace (for cloning)
   */
  async getDefaultWorkspace(): Promise<Workspace | null>

  /**
   * Set a workspace as default
   * Unsets previous default
   */
  async setDefaultWorkspace(workspaceId: string): Promise<void>

  // ===== Internal Helpers =====

  /**
   * Extract repository ID from an entry
   * Returns github.id if available, otherwise entry.name
   *
   * This is INTERNAL to the core library but critical for the design
   */
  private getRepositoryId(entry: AlexandriaEntry): string

  /**
   * Clean up workspace memberships when a repository is removed
   * Called automatically by ProjectRegistryStore.removeProject()
   *
   * @internal
   */
  async cleanupRepositoryMemberships(repositoryId: string): Promise<void>
}
```

### Integration with AlexandriaOutpostManager

**Recommended: Embedded in AlexandriaOutpostManager**

```typescript
export class AlexandriaOutpostManager {
  private readonly fsAdapter: FileSystemAdapter;
  private readonly globAdapter: GlobAdapter;
  private readonly projectRegistry: ProjectRegistryStore;

  // NEW: Add workspace manager as public property
  public readonly workspaces: WorkspaceManager;

  constructor(fsAdapter: FileSystemAdapter, globAdapter: GlobAdapter) {
    this.fsAdapter = fsAdapter;
    this.globAdapter = globAdapter;

    // Existing initialization
    this.projectRegistry = new ProjectRegistryStore(fsAdapter, homeDir);

    // NEW: Initialize workspace manager with same registry path
    this.workspaces = new WorkspaceManager(registryPath, fsAdapter);
  }

  // Existing methods unchanged...
  getAllEntries(): AlexandriaEntry[] { ... }
  getAllRepositories(): Promise<AlexandriaRepository[]> { ... }
  // etc.
}
```

**Electron App Usage:**

```typescript
// In AlexandriaRegistryService.ts
export class AlexandriaRegistryService {
  private outpostManager: AlexandriaOutpostManager;

  // Existing repository methods
  async getRepositories(): Promise<AlexandriaEntry[]> {
    return this.outpostManager.getAllEntries();
  }

  // NEW: Workspace methods (just delegate to core library)
  async createWorkspace(data: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.outpostManager.workspaces.createWorkspace(data);
  }

  async getWorkspaces() {
    return this.outpostManager.workspaces.getWorkspaces();
  }

  async addRepositoryToWorkspace(entry: AlexandriaEntry, workspaceId: string) {
    return this.outpostManager.workspaces.addRepositoryToWorkspace(entry, workspaceId);
  }

  async getRepositoriesInWorkspace(workspaceId: string) {
    return this.outpostManager.workspaces.getRepositoriesInWorkspace(
      workspaceId,
      this.outpostManager['projectRegistry'] // Access to query entries
    );
  }

  // etc. - simple delegation pattern
}
```

**Why embed in AlexandriaOutpostManager?**

1. **Cohesion**: Workspaces are fundamentally about organizing repositories
2. **Shared storage**: Uses same `.alexandria/` directory and registry path
3. **Single import**: Electron app only needs to import `AlexandriaOutpostManager`
4. **Access to entries**: WorkspaceManager needs to query entries for workspace membership resolution

## Use Cases & Examples

### Use Case 1: Multi-faceted Organization

```typescript
// Create workspaces for different organizational axes
await manager.workspaces.createWorkspace({ name: "Active Projects" });
await manager.workspaces.createWorkspace({ name: "Electron Apps" });
await manager.workspaces.createWorkspace({ name: "Client: Acme Corp" });

// Get an entry to add to workspaces
const entry = manager.getAllEntries().find(e => e.github?.id === "owner/electron-app");

// Same repository can be in all three workspaces
// All local clones will appear in all three workspaces
await manager.workspaces.addRepositoryToWorkspace(entry, "active-ws-id");
await manager.workspaces.addRepositoryToWorkspace(entry, "electron-ws-id");
await manager.workspaces.addRepositoryToWorkspace(entry, "acme-ws-id");

// Alternative: use repository ID directly
await manager.workspaces.addRepositoryToWorkspace("owner/electron-app", "active-ws-id");
```

### Use Case 2: Context Switching

```typescript
// Get all entries (local clones) for repositories in a workspace
const clientRepos = await manager.workspaces.getRepositoriesInWorkspace(
  "acme-ws-id",
  manager['projectRegistry']
);
// Returns all local clones of all repositories in the workspace
// Example: if "owner/electron-app" is in the workspace and has 2 local clones,
// both clones are returned

// Get all workspaces containing a repository
const entry = manager.getAllEntries()[0];
const contexts = await manager.workspaces.getRepositoryWorkspaces(entry);
// Returns [Workspace, Workspace, Workspace] objects
```

### Use Case 3: Smart Cloning

```typescript
// When cloning a new repo
const defaultWorkspace = await manager.workspaces.getDefaultWorkspace();

// If workspace has suggestedClonePath, use it as default
const clonePath = defaultWorkspace?.suggestedClonePath
  ? `${defaultWorkspace.suggestedClonePath}/new-repo`
  : getDefaultCloneDirectory();

await gitClone(url, clonePath);
const entry = await manager.registerRepository("new-repo", clonePath);

// Automatically add to default workspace (by entry or by repository ID)
if (defaultWorkspace) {
  await manager.workspaces.addRepositoryToWorkspace(entry, defaultWorkspace.id);
}
```

### Use Case 4: Workspace-Specific Metadata

```typescript
// Pin important repos to top of workspace
const entry = manager.getAllEntries().find(e => e.name === "critical-app");
await manager.workspaces.addRepositoryToWorkspace(entry, "active-ws-id", {
  pinned: true,
  notes: "Deploy by Friday"
});

// Different metadata in different workspaces
await manager.workspaces.addRepositoryToWorkspace(entry, "client-ws-id", {
  pinned: false,
  notes: "Billing: hourly"
});

// The metadata is per repository-workspace relationship
// not per clone-workspace relationship
```

### Use Case 5: Repository Removal & Cleanup

```typescript
// When removing a repository entry from Alexandria
const entry = manager.getAllEntries().find(e => e.name === "old-repo");
const repoId = entry.github?.id || entry.name;

// Remove the entry (clone)
await manager.projectRegistry.removeProject("old-repo");

// If this was the LAST clone of this repository, clean up workspace memberships
const otherClones = manager.getAllEntries().filter(e => {
  const id = e.github?.id || e.name;
  return id === repoId;
});

if (otherClones.length === 0) {
  // No more clones exist - remove from all workspaces
  await manager.workspaces.cleanupRepositoryMemberships(repoId);
}

// NOTE: The core library should handle this automatically
// This is just showing the logic that needs to be implemented
```

## Migration Strategy

### From Current Design

If `FOLDER_WORKSPACES_DESIGN.md` has been partially implemented:

1. **Auto-migrate path-based workspaces**:
   ```typescript
   // For each existing MultiRepoWorkspace in UserPreferences
   const oldWorkspaces = userPrefs.multiRepoWorkspaces || [];

   for (const oldWs of oldWorkspaces) {
     // Create new Alexandria workspace
     const workspace = await workspaces.createWorkspace({
       name: oldWs.name,
       description: oldWs.description,
       color: oldWs.color,
       suggestedClonePath: oldWs.path, // Keep path as suggestion
       isDefault: oldWs.isDefault
     });

     // Find all repos that live under this path
     const allRepos = await outpostManager.getRepositories();
     const matchingRepos = allRepos.filter(repo =>
       repo.path.startsWith(oldWs.path)
     );

     // Add them to the workspace
     for (const repo of matchingRepos) {
       await workspaces.addRepositoryToWorkspace(repo.name, workspace.id);
     }
   }

   // Clear old data
   delete userPrefs.multiRepoWorkspaces;
   delete userPrefs.defaultMultiRepoWorkspaceId;
   ```

2. **One-time migration prompt**:
   - Show user what was migrated
   - Explain new capabilities
   - Offer to create additional cross-cutting workspaces

### From No Workspace System

For fresh installations or users without existing workspaces:

1. **Optional onboarding**:
   - "Would you like to organize your repositories into workspaces?"
   - Offer templates: "Personal/Work/OSS", "By Language", "By Client", etc.

2. **Auto-suggest workspaces**:
   - Analyze existing repo paths and git remotes
   - Suggest workspaces based on common patterns
   - E.g., all repos with same GitHub org → workspace suggestion

## UI Considerations

### Workspace Selector (Clone Modal)

```
┌─────────────────────────────────────────┐
│ Clone Repository                        │
├─────────────────────────────────────────┤
│ URL: https://github.com/user/repo      │
│                                         │
│ Add to Workspaces (optional):          │
│ ☑ Active Projects                      │
│ ☑ Electron Apps                        │
│ ☐ Client: Acme Corp                    │
│ ☐ Open Source                          │
│                                         │
│ Clone to: /Users/dev/active/repo       │
│           ↑ from "Active Projects"     │
│                                         │
│           [Browse...] [Clone]          │
└─────────────────────────────────────────┘
```

### Repository Explorer

```
Repository Explorer
───────────────────────────────────────
[All Repositories ▼]  [+ Clone]

Workspaces:
  📌 Active Projects (5 repos, 7 clones)
     ├─ owner/electron-app
     │  ├─ ~/dev/electron-app (main)
     │  └─ ~/dev/electron-app-v2 (experimental)
     ├─ owner/web-dashboard
     │  └─ ~/projects/dashboard
     └─ ...

  🔧 Electron Apps (8 repos, 10 clones)
     ├─ owner/electron-app (also in: Active Projects)
     │  ├─ ~/dev/electron-app (main)
     │  └─ ~/dev/electron-app-v2 (experimental)
     └─ ...

  👤 Client: Acme Corp (3 repos, 3 clones)
     └─ ...

  📂 No Workspace (2 repos, 2 clones)
     └─ ...
```

### Workspace Management (Settings)

```
Settings → Workspaces
─────────────────────────────────────────

Workspaces organize your repositories into
logical groups. Repositories can belong to
multiple workspaces.

┌───────────────────────────────────────┐
│ 📌 Active Projects            [★][↓] │
│ Projects I'm currently working on     │
│ 5 repositories                 [Edit] │
└───────────────────────────────────────┘

[+ Create Workspace]

★ = Default for new clones
```

## Benefits Summary

### For Users

1. **Flexible organization**: Same repo in multiple contexts
2. **No restructuring**: Keep repos where they are
3. **Multi-machine friendly**: Workspaces sync, paths don't have to match
4. **Contextual workflows**: Switch between "work mode", "client mode", etc.
5. **Better filtering**: View repos by any organizational axis

### For Developers

1. **Clean architecture**: Repository data in Alexandria, UI prefs in UserPreferences
2. **Consistent API**: Standard CRUD operations
3. **Extensible**: Metadata support for future features
4. **Testable**: Clear boundaries, easy to unit test
5. **Type-safe**: Full TypeScript definitions

### For Core Library

1. **Feature ownership**: Workspace management is naturally part of repository management
2. **Atomic operations**: All repo-related data managed together
3. **Migration path**: Can support both old and new models during transition
4. **Standard patterns**: Uses well-established many-to-many relationship pattern

## Core Library Implementation Checklist

~~This is what the **@a24z/core-library** team needs to implement:~~

**✅ COMPLETED in @a24z/core-library v0.1.32**

### Required Changes

- [x] **Types**: Export `Workspace` and `WorkspaceMembership` interfaces ✅
- [x] **WorkspaceManager class**: Implement all CRUD and query methods ✅
- [x] **Integration**: Add `workspaces` property to `AlexandriaOutpostManager` ✅
- [x] **Storage**: Implement `workspaces.json` and `workspace-memberships.json` file handling ✅
- [x] **Repository ID resolution**: Implement `getRepositoryId(entry)` logic (prefer `github.id`, fallback to `entry.name`) ✅
- [x] **Cascade deletion**: Auto-cleanup memberships when repository entries are removed ✅
- [x] **Tests**: Unit tests for WorkspaceManager operations ✅

### Design Decisions Needed

1. **Cascade deletion strategy**: When should memberships be removed?
   - When last clone of a repository is removed? (Recommended)
   - Never (require explicit removal)?
   - Configurable?

2. **Local-only repositories**: How to handle repos without GitHub metadata?
   - Use `entry.name` as repository ID? (Recommended)
   - Require GitHub metadata for workspace membership?
   - Different handling for local vs remote repos?

3. **Performance**:
   - Index memberships by workspace ID and repository ID?
   - Max repositories/workspaces to support?
   - Lazy loading for large registries?

4. **Validation**:
   - Uniqueness constraints on workspace names?
   - Prevent duplicate memberships?
   - Validate repository IDs before adding?

5. **Events/Observability**:
   - Should workspace changes emit events for UI reactivity?
   - EventEmitter pattern or callback-based?

6. **Migration support**:
   - Provide migration helpers from path-based workspaces?
   - Auto-detect and suggest migration?

## Design Decisions & Scope

### Confirmed Decisions

1. **Storage format**: Use JSON for consistency with `registry.json`
2. **Nested workspaces**: NOT supported in this implementation - flat structure only
3. **Repository renames**: Out of scope for initial implementation
4. **Import/Export**: Core library will make workspace data accessible and writable; consumers (Electron app) will handle import/export UI/logic
5. **Moving clones**: Out of scope for initial implementation
6. **Migration script**: Out of scope - consuming applications will handle migration if needed
7. **API surface**: WorkspaceManager accessible via `AlexandriaOutpostManager.workspaces` property

### Open Questions for Core Library Team

1. **Sync considerations**: How should workspaces sync across machines with different clone paths?
2. **Workspace templates**: Should core library provide preset workspace structures?

## Implementation Phases

### Phase 1: Core Library Changes ✅ COMPLETED
- [x] Add `Workspace` and `WorkspaceMembership` types to core library ✅
- [x] Implement `WorkspaceManager` class ✅
- [x] Add file storage for `workspaces.json` and `workspace-memberships.json` ✅
- [x] Integrate with `AlexandriaOutpostManager` ✅
- [x] Add tests ✅

### Phase 2: Electron App Integration (NEXT)
- [ ] Add IPC handlers for workspace operations
- [ ] Update `AlexandriaRegistryService` to expose workspace methods
- [ ] Create workspace API for renderer process

### Phase 3: UI Implementation
- [ ] Workspace management UI in Settings
- [ ] Update Git Clone Modal with workspace selection
- [ ] Add workspace filter/grouping to Repository Explorer
- [ ] Workspace indicators/badges on repository cards

### Phase 4: Polish & Enhancement (Handled by consuming applications)
- [ ] Migration from UserPreferences-based workspaces (if needed)
- [ ] Add onboarding for new users
- [ ] Auto-suggestion for workspace creation
- [ ] Documentation and help content
- [ ] Import/Export UI and workflows

## References

**Similar Concepts:**
- **VS Code**: Multi-root workspaces, workspace files
- **JetBrains**: Project groups and favorites
- **Git Tower**: Repository bookmarks and groups
- **Notion**: Pages can have multiple tags
- **Spotify**: Songs in multiple playlists

**Related Documents:**
- `docs/FOLDER_WORKSPACES_DESIGN.md` - Original folder-based design
- `src/main/stores/AlexandriaRegistryService.ts` - Current registry implementation
- `src/shared/types/userPreferences.types.ts` - User preferences types
- `src/shared/types/alexandria.types.ts` - Alexandria types

---

---

**Document Status:** ✅ IMPLEMENTED in @a24z/core-library v0.1.32
**Date:** 2025-11-08 (Updated: 2025-11-09)
**Approach:** Repository-level workspaces using existing AlexandriaRepository abstraction

## Summary for Core Library Team

~~**What we're proposing:**~~
**✅ IMPLEMENTATION COMPLETE (v0.1.32)**

The core library team has successfully implemented:
- ✅ Workspace management in the core library (not the Electron app)
- ✅ Workspaces organize **repositories** (identified by `github.id`), not specific local clones
- ✅ All local clones of a repository appear when viewing a workspace
- ✅ Uses existing `AlexandriaRepository` vs `AlexandriaEntry` abstraction
- ✅ Stored in `.alexandria/` alongside existing registry data

**What the core library built:**
1. ✅ `Workspace` and `WorkspaceMembership` types
2. ✅ `WorkspaceManager` class with full CRUD API
3. ✅ Integration into `AlexandriaOutpostManager` as `.workspaces` property
4. ✅ File storage for workspace data
5. ✅ Repository ID resolution logic (entry → repository identity)
6. ✅ Cascade deletion when repositories are removed

**What the Electron app needs to do (Phase 2):**
- Consume the core library API via `AlexandriaRegistryService`
- Build UI for workspace management (settings, clone modal, repository explorer)
- Add IPC handlers for renderer process access
- Handle user interactions and display

**Status:** Core library work complete. Ready for Electron app integration.
