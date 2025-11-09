# Workspace Integration Plan

## Overview

This document outlines the plan to integrate the Multi-Workspace Membership feature from `@a24z/core-library` v0.1.32 into the Electron app.

**Status**: Core library ✅ Complete | Electron app integration 🚧 In Progress

---

## Architecture Overview

The integration follows the existing 4-layer IPC architecture:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Renderer Components                           │
│ - WorkspaceManager.tsx (Settings)                      │
│ - GitCloneModal.tsx (workspace selector)               │
│ - RepositoryWorkspace.tsx (workspace filtering)        │
└─────────────────────────────────────────────────────────┘
                           ↓ ↑
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Renderer Service                              │
│ - WorkspaceService.ts (static methods)                 │
│ - Wraps window.mainProcess.workspace calls             │
└─────────────────────────────────────────────────────────┘
                           ↓ ↑
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Preload Bridge                                │
│ - workspaceApi.ts (ipcRenderer wrapper)                │
│ - Exposes window.mainProcess.workspace                 │
└─────────────────────────────────────────────────────────┘
                           ↓ ↑
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Main Process                                  │
│ - AlexandriaRegistryService (exposes workspace methods)│
│ - WorkspaceApiEventHandler (IPC handler)               │
│ - Uses outpostManager.workspaces from core library     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Backend Integration (Main Process) ⚡ Priority

**Goal**: Expose workspace functionality from core library through AlexandriaRegistryService

#### 1.1 Update Type Definitions

**File**: `src/shared/main-process-api-interfaces/WorkspaceAPI.ts` (NEW)

```typescript
import type { Workspace, WorkspaceMembership } from '@a24z/core-library';
import type { AlexandriaEntry } from '@a24z/core-library';

export enum WorkspaceAPIEvent {
  // Workspace CRUD
  CREATE_WORKSPACE = 'workspace:create',
  GET_WORKSPACE = 'workspace:get',
  GET_ALL_WORKSPACES = 'workspace:get-all',
  UPDATE_WORKSPACE = 'workspace:update',
  DELETE_WORKSPACE = 'workspace:delete',

  // Membership Management
  ADD_REPOSITORY_TO_WORKSPACE = 'workspace:add-repository',
  REMOVE_REPOSITORY_FROM_WORKSPACE = 'workspace:remove-repository',
  GET_WORKSPACE_MEMBERSHIPS = 'workspace:get-memberships',
  GET_REPOSITORY_WORKSPACES = 'workspace:get-repository-workspaces',

  // Queries
  GET_REPOSITORIES_IN_WORKSPACE = 'workspace:get-repositories',
  IS_REPOSITORY_IN_WORKSPACE = 'workspace:is-repository-in',

  // Default Workspace
  GET_DEFAULT_WORKSPACE = 'workspace:get-default',
  SET_DEFAULT_WORKSPACE = 'workspace:set-default',

  // Events
  WORKSPACE_ADDED = 'workspace:added',
  WORKSPACE_UPDATED = 'workspace:updated',
  WORKSPACE_DELETED = 'workspace:deleted',
  MEMBERSHIP_CHANGED = 'workspace:membership-changed',
}

export interface WorkspaceChangeEvent {
  type: 'added' | 'updated' | 'deleted' | 'membership-changed';
  workspace?: Workspace;
  workspaceId?: string;
  repositoryId?: string;
}

export interface WorkspaceAPI {
  // Event subscription
  onWorkspaceChange(callback: (event: WorkspaceChangeEvent) => void): () => void;

  // Workspace CRUD
  createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace | null>;
  getWorkspaces(): Promise<Workspace[]>;
  updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<boolean>;

  // Membership Management
  addRepositoryToWorkspace(repository: AlexandriaEntry | string, workspaceId: string, metadata?: Record<string, unknown>): Promise<void>;
  removeRepositoryFromWorkspace(repository: AlexandriaEntry | string, workspaceId: string): Promise<void>;
  getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]>;
  getRepositoryWorkspaces(repository: AlexandriaEntry | string): Promise<Workspace[]>;

  // Queries
  getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]>;
  isRepositoryInWorkspace(repository: AlexandriaEntry | string, workspaceId: string): Promise<boolean>;

  // Default Workspace
  getDefaultWorkspace(): Promise<Workspace | null>;
  setDefaultWorkspace(workspaceId: string): Promise<void>;
}
```

**Checklist**:
- [ ] Create `src/shared/main-process-api-interfaces/WorkspaceAPI.ts`
- [ ] Export types from `@a24z/core-library`
- [ ] Define WorkspaceAPIEvent enum
- [ ] Define WorkspaceAPI interface

---

#### 1.2 Extend AlexandriaRegistryService

**File**: `src/main/stores/AlexandriaRegistryService.ts` (MODIFY)

Add workspace methods that delegate to `this.outpostManager.workspaces`:

```typescript
// Add these methods to AlexandriaRegistryService class

// ===== Workspace CRUD =====

async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
  return this.outpostManager.workspaces.createWorkspace(workspace);
}

async getWorkspace(id: string): Promise<Workspace | null> {
  return this.outpostManager.workspaces.getWorkspace(id);
}

async getWorkspaces(): Promise<Workspace[]> {
  return this.outpostManager.workspaces.getWorkspaces();
}

async updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace> {
  return this.outpostManager.workspaces.updateWorkspace(id, updates);
}

async deleteWorkspace(id: string): Promise<boolean> {
  return this.outpostManager.workspaces.deleteWorkspace(id);
}

// ===== Membership Management =====

async addRepositoryToWorkspace(
  repository: AlexandriaEntry | string,
  workspaceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return this.outpostManager.workspaces.addRepositoryToWorkspace(repository, workspaceId, metadata);
}

async removeRepositoryFromWorkspace(
  repository: AlexandriaEntry | string,
  workspaceId: string
): Promise<void> {
  return this.outpostManager.workspaces.removeRepositoryFromWorkspace(repository, workspaceId);
}

async getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
  return this.outpostManager.workspaces.getWorkspaceMemberships(workspaceId);
}

async getRepositoryWorkspaces(repository: AlexandriaEntry | string): Promise<Workspace[]> {
  return this.outpostManager.workspaces.getRepositoryWorkspaces(repository);
}

// ===== Query Methods =====

async getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
  return this.outpostManager.workspaces.getRepositoriesInWorkspace(
    workspaceId,
    this.outpostManager['projectRegistry'] // Access internal projectRegistry
  );
}

async isRepositoryInWorkspace(
  repository: AlexandriaEntry | string,
  workspaceId: string
): Promise<boolean> {
  return this.outpostManager.workspaces.isRepositoryInWorkspace(repository, workspaceId);
}

// ===== Default Workspace =====

async getDefaultWorkspace(): Promise<Workspace | null> {
  return this.outpostManager.workspaces.getDefaultWorkspace();
}

async setDefaultWorkspace(workspaceId: string): Promise<void> {
  return this.outpostManager.workspaces.setDefaultWorkspace(workspaceId);
}
```

**Checklist**:
- [ ] Import `Workspace`, `WorkspaceMembership` from `@a24z/core-library`
- [ ] Add workspace CRUD methods
- [ ] Add membership management methods
- [ ] Add query methods
- [ ] Add default workspace methods
- [ ] All methods should be simple delegations to `this.outpostManager.workspaces`

---

#### 1.3 Create WorkspaceApiEventHandler

**File**: `src/main/stores/WorkspaceApiEventHandler.ts` (NEW)

Pattern: Follow `AlexandriaApiEventHandler.ts` exactly

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { WorkspaceAPIEvent } from '../../shared/main-process-api-interfaces/WorkspaceAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { Workspace, WorkspaceMembership, AlexandriaEntry } from '@a24z/core-library';

export class WorkspaceApiEventHandler {
  private service: AlexandriaRegistryService;

  constructor() {
    this.service = AlexandriaRegistryService.getInstance();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Workspace CRUD
    ipcMain.handle(WorkspaceAPIEvent.CREATE_WORKSPACE,
      (_event: IpcMainInvokeEvent, workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>) =>
        this.handleCreateWorkspace(workspace)
    );

    ipcMain.handle(WorkspaceAPIEvent.GET_WORKSPACE,
      (_event: IpcMainInvokeEvent, id: string) =>
        this.handleGetWorkspace(id)
    );

    ipcMain.handle(WorkspaceAPIEvent.GET_ALL_WORKSPACES,
      () => this.handleGetAllWorkspaces()
    );

    ipcMain.handle(WorkspaceAPIEvent.UPDATE_WORKSPACE,
      (_event: IpcMainInvokeEvent, id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) =>
        this.handleUpdateWorkspace(id, updates)
    );

    ipcMain.handle(WorkspaceAPIEvent.DELETE_WORKSPACE,
      (_event: IpcMainInvokeEvent, id: string) =>
        this.handleDeleteWorkspace(id)
    );

    // Membership Management
    ipcMain.handle(WorkspaceAPIEvent.ADD_REPOSITORY_TO_WORKSPACE,
      (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string, workspaceId: string, metadata?: Record<string, unknown>) =>
        this.handleAddRepositoryToWorkspace(repository, workspaceId, metadata)
    );

    ipcMain.handle(WorkspaceAPIEvent.REMOVE_REPOSITORY_FROM_WORKSPACE,
      (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string, workspaceId: string) =>
        this.handleRemoveRepositoryFromWorkspace(repository, workspaceId)
    );

    ipcMain.handle(WorkspaceAPIEvent.GET_WORKSPACE_MEMBERSHIPS,
      (_event: IpcMainInvokeEvent, workspaceId: string) =>
        this.handleGetWorkspaceMemberships(workspaceId)
    );

    ipcMain.handle(WorkspaceAPIEvent.GET_REPOSITORY_WORKSPACES,
      (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string) =>
        this.handleGetRepositoryWorkspaces(repository)
    );

    // Queries
    ipcMain.handle(WorkspaceAPIEvent.GET_REPOSITORIES_IN_WORKSPACE,
      (_event: IpcMainInvokeEvent, workspaceId: string) =>
        this.handleGetRepositoriesInWorkspace(workspaceId)
    );

    ipcMain.handle(WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE,
      (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string, workspaceId: string) =>
        this.handleIsRepositoryInWorkspace(repository, workspaceId)
    );

    // Default Workspace
    ipcMain.handle(WorkspaceAPIEvent.GET_DEFAULT_WORKSPACE,
      () => this.handleGetDefaultWorkspace()
    );

    ipcMain.handle(WorkspaceAPIEvent.SET_DEFAULT_WORKSPACE,
      (_event: IpcMainInvokeEvent, workspaceId: string) =>
        this.handleSetDefaultWorkspace(workspaceId)
    );
  }

  // Handler implementations (delegate to service + broadcast events)
  private async handleCreateWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
    const created = await this.service.createWorkspace(workspace);
    this.broadcastWorkspaceChange('added', created);
    return created;
  }

  private async handleGetWorkspace(id: string): Promise<Workspace | null> {
    return this.service.getWorkspace(id);
  }

  private async handleGetAllWorkspaces(): Promise<Workspace[]> {
    return this.service.getWorkspaces();
  }

  private async handleUpdateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace> {
    const updated = await this.service.updateWorkspace(id, updates);
    this.broadcastWorkspaceChange('updated', updated);
    return updated;
  }

  private async handleDeleteWorkspace(id: string): Promise<boolean> {
    const result = await this.service.deleteWorkspace(id);
    if (result) {
      this.broadcastWorkspaceChange('deleted', undefined, id);
    }
    return result;
  }

  private async handleAddRepositoryToWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.service.addRepositoryToWorkspace(repository, workspaceId, metadata);
    const repoId = typeof repository === 'string' ? repository : repository.github?.id || repository.name;
    this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);
  }

  private async handleRemoveRepositoryFromWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<void> {
    await this.service.removeRepositoryFromWorkspace(repository, workspaceId);
    const repoId = typeof repository === 'string' ? repository : repository.github?.id || repository.name;
    this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);
  }

  private async handleGetWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return this.service.getWorkspaceMemberships(workspaceId);
  }

  private async handleGetRepositoryWorkspaces(repository: AlexandriaEntry | string): Promise<Workspace[]> {
    return this.service.getRepositoryWorkspaces(repository);
  }

  private async handleGetRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
    return this.service.getRepositoriesInWorkspace(workspaceId);
  }

  private async handleIsRepositoryInWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<boolean> {
    return this.service.isRepositoryInWorkspace(repository, workspaceId);
  }

  private async handleGetDefaultWorkspace(): Promise<Workspace | null> {
    return this.service.getDefaultWorkspace();
  }

  private async handleSetDefaultWorkspace(workspaceId: string): Promise<void> {
    await this.service.setDefaultWorkspace(workspaceId);
    const workspace = await this.service.getWorkspace(workspaceId);
    if (workspace) {
      this.broadcastWorkspaceChange('updated', workspace);
    }
  }

  // Broadcast changes to all windows
  private broadcastWorkspaceChange(
    type: 'added' | 'updated' | 'deleted' | 'membership-changed',
    workspace?: Workspace,
    workspaceId?: string,
    repositoryId?: string
  ): void {
    const event = {
      type,
      workspace,
      workspaceId,
      repositoryId,
    };

    const eventName = {
      added: WorkspaceAPIEvent.WORKSPACE_ADDED,
      updated: WorkspaceAPIEvent.WORKSPACE_UPDATED,
      deleted: WorkspaceAPIEvent.WORKSPACE_DELETED,
      'membership-changed': WorkspaceAPIEvent.MEMBERSHIP_CHANGED,
    }[type];

    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(eventName, event);
    });
  }
}
```

**Checklist**:
- [ ] Create `src/main/stores/WorkspaceApiEventHandler.ts`
- [ ] Register all IPC handlers for workspace operations
- [ ] Implement event broadcasting for changes
- [ ] Follow AlexandriaApiEventHandler pattern exactly

---

#### 1.4 Initialize WorkspaceApiEventHandler

**File**: `src/main/main.ts` (MODIFY)

```typescript
import { WorkspaceApiEventHandler } from './stores/WorkspaceApiEventHandler';

// In app.whenReady() or similar initialization
new WorkspaceApiEventHandler();
```

**Checklist**:
- [ ] Import WorkspaceApiEventHandler
- [ ] Initialize in main.ts (same place as AlexandriaApiEventHandler)

---

### Phase 2: Preload Bridge ⚡ Priority

**Goal**: Expose workspace IPC API to renderer process

#### 2.1 Create Workspace Preload Bridge

**File**: `src/window/main-process-api-implementations/workspaceApi.ts` (NEW)

```typescript
import { ipcRenderer, IpcRendererEvent } from 'electron';
import type { Workspace, WorkspaceMembership, AlexandriaEntry } from '@a24z/core-library';
import {
  WorkspaceAPIEvent,
  type WorkspaceAPI,
  type WorkspaceChangeEvent,
} from '../../shared/main-process-api-interfaces/WorkspaceAPI';

export const workspaceApi: WorkspaceAPI = {
  // Event subscription
  onWorkspaceChange(callback: (event: WorkspaceChangeEvent) => void): () => void {
    const listener = (_event: IpcRendererEvent, data: WorkspaceChangeEvent) => {
      callback(data);
    };

    // Subscribe to all workspace events
    ipcRenderer.on(WorkspaceAPIEvent.WORKSPACE_ADDED, listener);
    ipcRenderer.on(WorkspaceAPIEvent.WORKSPACE_UPDATED, listener);
    ipcRenderer.on(WorkspaceAPIEvent.WORKSPACE_DELETED, listener);
    ipcRenderer.on(WorkspaceAPIEvent.MEMBERSHIP_CHANGED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.off(WorkspaceAPIEvent.WORKSPACE_ADDED, listener);
      ipcRenderer.off(WorkspaceAPIEvent.WORKSPACE_UPDATED, listener);
      ipcRenderer.off(WorkspaceAPIEvent.WORKSPACE_DELETED, listener);
      ipcRenderer.off(WorkspaceAPIEvent.MEMBERSHIP_CHANGED, listener);
    };
  },

  // Workspace CRUD
  createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.CREATE_WORKSPACE, workspace);
  },

  getWorkspace(id: string): Promise<Workspace | null> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_WORKSPACE, id);
  },

  getWorkspaces(): Promise<Workspace[]> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_ALL_WORKSPACES);
  },

  updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.UPDATE_WORKSPACE, id, updates);
  },

  deleteWorkspace(id: string): Promise<boolean> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.DELETE_WORKSPACE, id);
  },

  // Membership Management
  addRepositoryToWorkspace(repository: AlexandriaEntry | string, workspaceId: string, metadata?: Record<string, unknown>): Promise<void> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.ADD_REPOSITORY_TO_WORKSPACE, repository, workspaceId, metadata);
  },

  removeRepositoryFromWorkspace(repository: AlexandriaEntry | string, workspaceId: string): Promise<void> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.REMOVE_REPOSITORY_FROM_WORKSPACE, repository, workspaceId);
  },

  getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_WORKSPACE_MEMBERSHIPS, workspaceId);
  },

  getRepositoryWorkspaces(repository: AlexandriaEntry | string): Promise<Workspace[]> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_REPOSITORY_WORKSPACES, repository);
  },

  // Queries
  getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_REPOSITORIES_IN_WORKSPACE, workspaceId);
  },

  isRepositoryInWorkspace(repository: AlexandriaEntry | string, workspaceId: string): Promise<boolean> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE, repository, workspaceId);
  },

  // Default Workspace
  getDefaultWorkspace(): Promise<Workspace | null> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_DEFAULT_WORKSPACE);
  },

  setDefaultWorkspace(workspaceId: string): Promise<void> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.SET_DEFAULT_WORKSPACE, workspaceId);
  },
};
```

**Checklist**:
- [ ] Create `src/window/main-process-api-implementations/workspaceApi.ts`
- [ ] Implement all WorkspaceAPI methods using ipcRenderer.invoke
- [ ] Implement onWorkspaceChange subscription
- [ ] Follow alexandriaApi.ts pattern exactly

---

#### 2.2 Expose in Preload

**File**: `src/window/preload.ts` (MODIFY)

```typescript
import { workspaceApi } from './main-process-api-implementations/workspaceApi';

// Add to contextBridge.exposeInMainWorld
contextBridge.exposeInMainWorld('mainProcess', {
  // ... existing APIs
  alexandria: alexandriaApi,
  workspace: workspaceApi,  // ADD THIS
  // ... other APIs
});
```

**Checklist**:
- [ ] Import workspaceApi
- [ ] Expose as `window.mainProcess.workspace`

---

#### 2.3 Update Window Types

**File**: `src/window/window.d.ts` (MODIFY)

```typescript
import type { WorkspaceAPI } from '../shared/main-process-api-interfaces/WorkspaceAPI';

interface MainProcess {
  // ... existing APIs
  alexandria: AlexandriaAPI;
  workspace: WorkspaceAPI;  // ADD THIS
  // ... other APIs
}
```

**Checklist**:
- [ ] Import WorkspaceAPI type
- [ ] Add workspace property to MainProcess interface

---

### Phase 3: Renderer Service ⚡ Priority

**Goal**: Create renderer-side service for workspace operations

#### 3.1 Create WorkspaceService

**File**: `src/renderer/main-process-api/WorkspaceService.ts` (NEW)

```typescript
import type { Workspace, WorkspaceMembership, AlexandriaEntry } from '@a24z/core-library';
import type { WorkspaceChangeEvent } from '../../shared/main-process-api-interfaces/WorkspaceAPI';

/**
 * Renderer-side service for Workspace management
 * Communicates with main process via IPC using window.mainProcess
 */
export class WorkspaceService {
  // Event subscription
  static onWorkspaceChange(callback: (event: WorkspaceChangeEvent) => void): () => void {
    return window.mainProcess.workspace.onWorkspaceChange(callback);
  }

  // Workspace CRUD
  static async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
    return window.mainProcess.workspace.createWorkspace(workspace);
  }

  static async getWorkspace(id: string): Promise<Workspace | null> {
    return window.mainProcess.workspace.getWorkspace(id);
  }

  static async getWorkspaces(): Promise<Workspace[]> {
    return window.mainProcess.workspace.getWorkspaces();
  }

  static async updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace> {
    return window.mainProcess.workspace.updateWorkspace(id, updates);
  }

  static async deleteWorkspace(id: string): Promise<boolean> {
    return window.mainProcess.workspace.deleteWorkspace(id);
  }

  // Membership Management
  static async addRepositoryToWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return window.mainProcess.workspace.addRepositoryToWorkspace(repository, workspaceId, metadata);
  }

  static async removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<void> {
    return window.mainProcess.workspace.removeRepositoryFromWorkspace(repository, workspaceId);
  }

  static async getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return window.mainProcess.workspace.getWorkspaceMemberships(workspaceId);
  }

  static async getRepositoryWorkspaces(repository: AlexandriaEntry | string): Promise<Workspace[]> {
    return window.mainProcess.workspace.getRepositoryWorkspaces(repository);
  }

  // Queries
  static async getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
    return window.mainProcess.workspace.getRepositoriesInWorkspace(workspaceId);
  }

  static async isRepositoryInWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<boolean> {
    return window.mainProcess.workspace.isRepositoryInWorkspace(repository, workspaceId);
  }

  // Default Workspace
  static async getDefaultWorkspace(): Promise<Workspace | null> {
    return window.mainProcess.workspace.getDefaultWorkspace();
  }

  static async setDefaultWorkspace(workspaceId: string): Promise<void> {
    return window.mainProcess.workspace.setDefaultWorkspace(workspaceId);
  }
}
```

**Checklist**:
- [ ] Create `src/renderer/main-process-api/WorkspaceService.ts`
- [ ] Implement all methods as simple wrappers
- [ ] Follow AlexandriaService.ts pattern exactly

---

### Phase 4: UI Components 🎨 Lower Priority

**Goal**: Build UI for workspace management

#### 4.1 Workspace Management Settings Panel

**File**: `src/renderer/settings/WorkspaceManager.tsx` (NEW)

**Features**:
- List all workspaces
- Create new workspace
- Edit workspace (name, description, color, icon)
- Delete workspace
- Set default workspace
- Show repository count per workspace

**Checklist**:
- [ ] Create component with workspace list
- [ ] Add create workspace form
- [ ] Add edit workspace dialog
- [ ] Add delete confirmation
- [ ] Add default workspace toggle
- [ ] Use WorkspaceService for all operations
- [ ] Subscribe to workspace changes for real-time updates

---

#### 4.2 Update Git Clone Modal

**File**: `src/renderer/components/GitCloneModal.tsx` (MODIFY)

**Changes**:
- Replace UserPreferences workspace dropdown with WorkspaceService
- Allow multi-select for workspaces
- Use default workspace for path suggestion
- Add cloned repo to selected workspaces after clone

**Note**: Modal already has workspace selector UI (lines 718-805), just needs to switch data source from UserPreferences to WorkspaceService.

**Checklist**:
- [ ] Replace workspace loading from UserPreferences with WorkspaceService.getWorkspaces()
- [ ] Replace default workspace from UserPreferences with WorkspaceService.getDefaultWorkspace()
- [ ] Update clone handler to add repository to selected workspaces
- [ ] Support multi-workspace selection (checkbox list instead of dropdown)

---

#### 4.3 Repository Explorer with Workspace Filtering

**File**: `src/renderer/repo-manager/RepositoryWorkspace.tsx` (MODIFY)

**Features**:
- Add workspace filter dropdown
- Show "All Repositories" or filter by workspace
- Show workspace badges on repository cards
- Group repositories by workspace (optional view)

**Checklist**:
- [ ] Add workspace selector/filter UI
- [ ] Load repositories with WorkspaceService.getRepositoriesInWorkspace()
- [ ] Show workspace badges on repo cards
- [ ] Add "Manage Workspaces" button (opens settings)
- [ ] Subscribe to workspace/membership changes for real-time updates

---

#### 4.4 Repository Context Menu Actions

**File**: Repository context menu component (TBD)

**Features**:
- "Add to Workspace..." submenu
- "Remove from Workspace..." submenu
- Show current workspace memberships

**Checklist**:
- [ ] Add workspace actions to repository context menu
- [ ] Show current workspaces with checkmarks
- [ ] Add to workspace handler
- [ ] Remove from workspace handler

---

### Phase 5: Migration & Polish 🔄 Optional

#### 5.1 Migrate from UserPreferences Workspaces

**File**: Migration utility (TBD)

If there are existing workspaces in UserPreferences, migrate them to Alexandria:

```typescript
// Pseudo-code
const oldWorkspaces = UserPreferencesService.getMultiRepoWorkspaces();

for (const oldWs of oldWorkspaces) {
  const newWs = await WorkspaceService.createWorkspace({
    name: oldWs.name,
    description: oldWs.description,
    color: oldWs.color,
    suggestedClonePath: oldWs.path,
    isDefault: oldWs.isDefault,
  });

  // Find repos under this path
  const allRepos = await AlexandriaService.getRepositories();
  const matchingRepos = allRepos.filter(repo => repo.path.startsWith(oldWs.path));

  // Add to workspace
  for (const repo of matchingRepos) {
    await WorkspaceService.addRepositoryToWorkspace(repo, newWs.id);
  }
}

// Clear old data from UserPreferences
UserPreferencesService.clearMultiRepoWorkspaces();
```

**Checklist**:
- [ ] Detect if old workspaces exist
- [ ] Migrate to new workspace system
- [ ] Show migration success message
- [ ] Clean up old data

---

#### 5.2 Onboarding & Templates

**Features**:
- First-run workspace setup wizard
- Preset templates: "Personal/Work/OSS", "By Language", "By Client"
- Auto-suggest workspaces based on repo patterns

**Checklist**:
- [ ] Create onboarding wizard
- [ ] Implement workspace templates
- [ ] Add auto-suggestion logic
- [ ] Show tips/help for new users

---

## Testing Checklist

### Unit Tests
- [ ] AlexandriaRegistryService workspace methods
- [ ] WorkspaceApiEventHandler IPC handlers
- [ ] WorkspaceService renderer methods

### Integration Tests
- [ ] Create workspace → verify in Alexandria registry
- [ ] Add repository to workspace → verify membership
- [ ] Remove repository from workspace → verify cleanup
- [ ] Delete workspace → verify cascade deletion
- [ ] Default workspace operations

### E2E Tests
- [ ] Clone repo with workspace selection
- [ ] Filter repositories by workspace
- [ ] Manage workspaces in settings
- [ ] Repository context menu actions
- [ ] Event subscription and real-time updates

---

## Success Criteria

✅ **Backend Integration Complete** when:
- All workspace methods exposed through AlexandriaRegistryService
- IPC handlers registered and working
- Preload bridge exposing workspace API
- Renderer service wrapping IPC calls

✅ **UI Integration Complete** when:
- Workspace management panel in settings
- Git Clone Modal using workspace selection
- Repository Explorer filtering by workspace
- Workspace badges/indicators visible

✅ **Feature Complete** when:
- Users can create/edit/delete workspaces
- Users can add/remove repositories from workspaces
- Users can filter repositories by workspace
- Users can set default workspace for cloning
- Multi-window sync working via event broadcasts
- Migration from old workspaces (if applicable)

---

## Implementation Order (Recommended)

1. **Phase 1.1-1.4**: Backend integration (1-2 days)
2. **Phase 2**: Preload bridge (0.5 day)
3. **Phase 3**: Renderer service (0.5 day)
4. **Phase 4.1**: Workspace settings panel (1-2 days)
5. **Phase 4.2**: Update Git Clone Modal (1 day)
6. **Phase 4.3**: Repository Explorer filtering (1-2 days)
7. **Phase 4.4**: Context menu actions (0.5 day)
8. **Phase 5**: Migration & polish (1-2 days)

**Total estimated time**: 1-2 weeks

---

## Next Steps

1. Review this plan with team
2. Create GitHub issues/tasks for each phase
3. Start with Phase 1 (backend integration)
4. Test after each phase before moving to next
5. Update MULTI_WORKSPACE_MEMBERSHIP_DESIGN.md as phases complete

---

**Document Status**: Draft
**Created**: 2025-11-09
**Author**: Claude Code
