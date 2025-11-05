# Multi-Repo Workspaces Design

## Overview

This document outlines the design for implementing **Multi-Repo Workspaces** - a feature that allows users to organize their git repositories into logical workspace folders (e.g., "Personal Projects", "Work", "Open Source").

## Current State

### Existing "Workspace" Concept
The application currently uses the term "workspace" to refer to **panel layout presets** - different arrangements of UI panels for various workflows (project-management, code-review, documentation, etc.).

**Files involved:**
- `src/shared/types/userPreferences.types.ts` - `WorkspaceLayout` type
- `src/renderer/services/WorkspaceLayoutService.ts` - Service for managing layouts
- `src/renderer/components/Titlebar/WorkspaceSelector.tsx` - UI for selecting layouts
- `src/renderer/repo-manager/shared/SaveWorkspaceModal.tsx` - UI for saving layouts

### Current Clone Behavior
- Single `defaultCloneDirectory` preference (userPreferences.types.ts:78)
- User sets this in Settings → General Settings
- When cloning, path is constructed as: `${defaultCloneDirectory}/${repoName}`
- No concept of multiple organized workspace folders

### Repository Management
- **Alexandria Registry** tracks all repositories
- `Repository` type supports multiple `LocalClone[]` for same remote repository
- Each clone has: path, branch, last commit, timestamps, etc.

## Terminology Clarification

To avoid confusion, we need to establish clear terminology:

| Current Term | Refers To | New Terminology |
|--------------|-----------|-----------------|
| Workspace Layout | Panel arrangement presets (UI layouts) | Keep as **Workspace Layout** |
| Workspace (new) | Folder containing git projects | **Multi-Repo Workspace** |

**Note:** We will keep the existing "Workspace Layout" naming unchanged to minimize disruption. The new "Multi-Repo Workspace" concept uses distinct naming (`MultiRepoWorkspace` in code) to avoid confusion.

## Multi-Repo Workspaces Design

### What is a Multi-Repo Workspace?

A **Multi-Repo Workspace** is a named directory where the user organizes related git repositories. Examples:
- "Personal Projects" → `~/Code/Personal`
- "Work" → `~/Code/Work`
- "Open Source Contributions" → `~/Code/OpenSource`
- "Client Projects" → `~/Documents/Clients`

### Data Structure

```typescript
// src/shared/types/userPreferences.types.ts

interface MultiRepoWorkspace {
  id: string;                    // Unique identifier
  name: string;                  // Display name (e.g., "Personal Projects")
  path: string;                  // Absolute path to directory
  description?: string;          // Optional description
  color?: string;                // Optional color for UI
  icon?: string;                 // Optional icon identifier
  isDefault?: boolean;           // Is this the default workspace for cloning?
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  repositoryCount?: number;      // Cached count of repos in this workspace
}

interface UserPreferences {
  // ... existing fields

  multiRepoWorkspaces?: MultiRepoWorkspace[];
  defaultMultiRepoWorkspaceId?: string;  // Which workspace to use by default

  // Legacy field - kept for backwards compatibility
  defaultCloneDirectory?: string;
}
```

### Key Features

1. **Multiple Workspaces**
   - Users can create unlimited folder workspaces
   - Each workspace is a real directory on their file system
   - Workspaces are just organizational containers - the OS can still see them as regular folders

2. **Default Workspace**
   - User can mark one workspace as default for cloning
   - If no default, prompt user to select workspace when cloning
   - Fallback to legacy `defaultCloneDirectory` if no workspaces defined

3. **Workspace Management**
   - Create new workspace (with directory picker)
   - Edit workspace (name, description, color, icon)
   - Delete workspace (keeps repositories, just removes workspace definition)
   - Set default workspace

4. **Clone Integration**
   - GitCloneModal shows workspace selector
   - Default workspace pre-selected
   - Can choose different workspace per clone
   - Path preview: `${workspace.path}/${repoName}`

5. **Repository Association**
   - Repositories are associated with workspaces by path matching
   - Alexandria tracks which workspace each repository belongs to
   - Can move repositories between workspaces (git operations)

### User Interface

#### Settings → Multi-Repo Workspaces

New settings section for managing workspaces:
```
Multi-Repo Workspaces
─────────────────────────────────────────────
Organize your git repositories into workspace folders.

┌─────────────────────────────────────────────┐
│ Personal Projects                    [★]    │
│ ~/Code/Personal                             │
│ 12 repositories                      [Edit] │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Work                                        │
│ ~/Code/Work                                 │
│ 8 repositories                       [Edit] │
└─────────────────────────────────────────────┘

[+ Create Workspace]

★ = Default workspace for cloning
```

#### Git Clone Modal Update

```
Clone Git Repository
────────────────────────────────────────────

Repository URL
[https://github.com/owner/repo.git         ]

Clone to Workspace
[Personal Projects ▼]  [Browse...]

Clone Path Preview
~/Code/Personal/repo

[Cancel]  [Clone]
```

#### Repository Explorer

Add workspace filter/grouping:
```
Repository Explorer
───────────────────────────────────────────
[All Workspaces ▼]  [+ Clone]

📁 Personal Projects (12)
  ├─ electron-app
  ├─ my-website
  └─ ...

📁 Work (8)
  ├─ company-platform
  ├─ internal-tools
  └─ ...

📁 Unorganized (3)
  └─ ...
```

### Migration Strategy

#### For Existing Users

1. **Backwards Compatibility**
   - Keep `defaultCloneDirectory` working
   - If user has `defaultCloneDirectory` but no workspaces:
     - Auto-create a workspace called "Default" pointing to that directory
     - Set it as default workspace

2. **Migration Prompt**
   - First time user opens Settings after upgrade
   - Show migration wizard: "Organize your repositories into workspaces?"
   - Scan Alexandria for existing repositories
   - Group by parent directory
   - Suggest workspace names based on directory structure
   - User can accept/modify/skip

3. **Gradual Adoption**
   - Workspaces are optional
   - Users can continue using single default directory
   - Or they can gradually adopt workspaces

### Implementation Plan

#### Phase 1: Core Multi-Repo Workspace Types & Storage
- [ ] Add `MultiRepoWorkspace` type to userPreferences.types.ts
- [ ] Add `multiRepoWorkspaces` array to UserPreferences
- [ ] Create `MultiRepoWorkspaceService` for CRUD operations
- [ ] Add IPC handlers for workspace management

#### Phase 2: Settings UI
- [ ] Create Multi-Repo Workspaces settings page
- [ ] Workspace list with create/edit/delete
- [ ] Set default workspace
- [ ] Directory picker integration

#### Phase 3: Clone Integration
- [ ] Update GitCloneModal with workspace selector
- [ ] Add workspace dropdown/picker
- [ ] Update path construction logic
- [ ] Show path preview

#### Phase 4: Repository Association
- [ ] Update Alexandria to track workspace associations
- [ ] Add workspace field to repository metadata
- [ ] Implement repository-workspace matching logic

#### Phase 5: Repository Explorer Updates
- [ ] Add workspace grouping/filtering
- [ ] Update repository list UI
- [ ] Add workspace indicators/badges

#### Phase 6: Migration & Polish
- [ ] Create migration wizard for existing users
- [ ] Auto-migration from defaultCloneDirectory
- [ ] Add tooltips and help text
- [ ] Documentation

### Open Questions

1. **Workspace Discovery**
   - Should we auto-discover existing workspace-like folders?
   - What heuristics to use? (presence of multiple git repos?)

2. **Nested Workspaces**
   - Allow workspaces within workspaces?
   - Or keep flat structure?

3. **Workspace Templates**
   - Should we provide preset workspace structures?
   - E.g., "Standard" (Personal/Work/OpenSource)

4. **Cross-Platform Paths**
   - How to handle workspace paths across different machines?
   - Cloud sync considerations?

5. **Repository Move/Copy**
   - Should we provide UI to move repos between workspaces?
   - Just update git remote or actually move files?

6. **View Preset per Workspace?**
   - Should workspaces have default view presets?
   - E.g., "Work" workspace always opens in code-review layout?

## Related Files

**Current Workspace Layout System:**
- `src/shared/types/userPreferences.types.ts`
- `src/renderer/services/WorkspaceLayoutService.ts`
- `src/renderer/components/Titlebar/WorkspaceSelector.tsx`
- `src/renderer/repo-manager/shared/SaveWorkspaceModal.tsx`

**Clone & Repository Management:**
- `src/renderer/principal-window/views/RepositoryExplorer/components/GitCloneModal.tsx`
- `src/renderer/principal-window/views/Settings/components/GeneralSettings.tsx`
- `src/main/stores/AlexandriaRegistryService.ts`
- `src/shared/types/repository.types.ts`

**Git Operations:**
- `src/main/file-system/gitHandlers.ts`
- `src/renderer/main-process-api/GitService.ts`

## References

Industry patterns:
- **VS Code**: Workspaces are folders/multi-root configurations
- **IntelliJ**: Projects are workspace-like, organized by directory
- **Git Tower**: Repositories organized into "Favorites" groups
- **Sourcetree**: Repository bookmarks with grouping

---

**Document Status:** Draft
**Last Updated:** 2025-11-05
**Terminology Finalized:** `MultiRepoWorkspace` for the new folder organization concept
**Next Step:** Begin Phase 1 implementation
