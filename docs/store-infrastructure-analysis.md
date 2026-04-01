# Electron App Store Infrastructure Analysis

## Executive Summary

This Electron application uses a **Multi-Store Manager architecture** with **namespace-based storage**. The primary pattern is a custom **TypedMultiStoreWrapper** (not Redux or Zustand) that provides type-safe, namespace-segregated storage across multiple backends. The renderer process accesses stores via IPC layer wrapping. There is also a **Context API** pattern for UI state management.

---

## 1. Core Store Architecture

### State Management Pattern: Custom Multi-Store Manager + Context API

The app uses **TWO complementary patterns**:

#### A. **Main Process: MultiStoreManager** (Backend Storage Layer)
- Location: `/src/main/storage-providers/MultiStoreManager.ts`
- Purpose: Manages multiple storage namespaces with different backends
- Type Safety: Wrapped by `TypedMultiStoreWrapper` for compile-time type checking
- Persistence: **Electron-Store** (default) + optional S3 backend

#### B. **Renderer Process: Context API** (UI State)
- Multiple context providers for UI-specific state
- Does NOT directly access main process storage in real-time
- Used for local UI state, not persistent data

---

## 2. All Store Files with Purposes

### Main Process Storage Layer

| File | Purpose |
|------|---------|
| `/src/main/storage-providers/MultiStoreManager.ts` | Core manager handling multiple namespaces and storage backends |
| `/src/main/storage-providers/typed-multistore-wrapper.ts` | Type-safe wrapper providing compile-time type checking for all namespaces |
| `/src/main/storage-providers/all-namespaces.ts` | Exports all valid namespaces and helper functions |
| `/src/main/storage-providers/typed-namespaces.ts` | TypeScript interfaces for namespace data types (NamespaceDataTypes) |
| `/src/main/storage-providers/ElectronStoreLocalStorageProvider.ts` | Implementation of electron-store backend |
| `/src/main/storage-providers/S3RemoteStorageProvider.ts` | Stub implementation for S3 backend |
| `/src/main/stores/storeHandlers.ts` | IPC handlers for store operations (GET, SET, DELETE, HAS, CLEAR, KEYS, etc.) |

### Renderer Process API Layer

| File | Purpose |
|------|---------|
| `/src/renderer/main-process-api/StoreService.ts` | Renderer-side client for accessing main process storage via IPC |
| `/src/window/main-process-api-implementations/storeApi.ts` | IPC renderer implementation wrapping electron.ipcRenderer |

### Renderer Context API (UI State)

| File | Purpose |
|------|---------|
| `/src/renderer/contexts/PanelContext.tsx` | Manages panel-specific state (workspace, repository, terminal sessions, git status) |
| `/src/renderer/contexts/GitChangesContext.tsx` | Git changes tracking and UI state |
| `/src/renderer/contexts/RepositoryContext.tsx` | Repository-specific UI state |
| `/src/renderer/contexts/SelectedRepositoryContext.tsx` | Currently selected repository tracking |
| `/src/renderer/contexts/VisibleProjectsContext.tsx` | Visibility state for projects |
| `/src/renderer/contexts/WorkspaceFilterContext.tsx` | Workspace filtering state |
| `/src/renderer/contexts/HighlightLayersContext.tsx` | Highlight layer state for visualization |

### Task/Palace System

| File | Purpose |
|------|---------|
| `/src/main/palace-tasks/palaceTasksHandlers.ts` | IPC handlers for Memory Palace task operations |
| `/src/renderer/main-process-api/PalaceTasksService.ts` | Renderer client for task operations |
| `/src/shared/main-process-api-interfaces/PalaceTasksAPI.ts` | Shared type definitions for task API |

### Configuration & Types

| File | Purpose |
|------|---------|
| `/src/shared/types/namespaces.types.ts` | StaticNamespaces enum - defines all valid storage namespaces |
| `/docs/STORE_NAMESPACES.md` | Documentation mapping namespaces to UI features |
| `/docs/PANEL_EXTENSION_STORE_SPECIFICATION.md` | Panel loading and store spec for extensions |

---

## 3. State Management Pattern: Multi-Store Manager

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                         │
├─────────────────────────────────────────────────────────────┤
│ React Components → Context API (Local UI State)             │
│                 ↓                                            │
│ StoreService (IPC Client) → window.mainProcess.store        │
└──────────────────────┬──────────────────────────────────────┘
                       │ IPC Channel
┌──────────────────────┴──────────────────────────────────────┐
│                    MAIN PROCESS                             │
├─────────────────────────────────────────────────────────────┤
│ IPC Handler (storeHandlers.ts)                              │
│        ↓                                                     │
│ TypedMultiStoreWrapper (Type-Safe Operations)               │
│        ↓                                                     │
│ MultiStoreManager (Namespace + Backend Routing)             │
│        ↓                                                     │
│ Storage Providers:                                          │
│   ├─ ElectronStoreLocalStorageProvider (Primary)            │
│   └─ S3RemoteStorageProvider (Future/Optional)              │
│        ↓                                                     │
│ File System (userData directory)                            │
└─────────────────────────────────────────────────────────────┘
```

### Type Safety Flow

```
StaticNamespaces (Enum)
    ↓
NamespaceDataTypes (Interface mapping namespace → data type)
    ↓
TypedMultiStoreWrapper (Enforces type checking)
    ↓
MultiStoreManager (Routes to backend)
```

---

## 4. Namespaces (Storage Segregation)

### Static Namespaces (Defined in `/src/shared/types/namespaces.types.ts`)

#### Core Data
- `user-preferences` - User settings and preferences (Primary)
- `repositories` - Repository configurations and metadata
- `ai-configuration` - AI provider configurations
- `llm-models` - LLM model configurations

#### Session & History
- `global-session-registry` - Global session index and tracking (Primary)
- `session-summaries` - Recent session summaries for quick access

#### Cache & Temp
- `cache` - In-memory cache (Provider: memory, not persisted)
- `temp` - Temporary storage (Provider: memory, not persisted)

#### Docker Management
- `docker-containers` - Docker container state and management
- `docker-sessions` - Docker analysis session tracking

#### Secrets & Links
- `secrets-metadata` - Encrypted secrets metadata
- `repository-links` - Repository links and bookmarks

### Namespace Features

Each namespace has:
- **Name**: Unique identifier
- **StorageProvider**: Backend (electron-store, memory, s3)
- **Category**: CORE or CACHE
- **Config**: Path, defaults, read-only status
- **isPrimary**: Flag for special namespaces

---

## 5. Typical Store Operation Flow

### Example: Getting User Preferences

```typescript
// Renderer Process
const prefs = await StoreService.get('settings', 'user-preferences');

// Translates to:
window.mainProcess.store.get(key, namespace, defaultValue)

// Via IPC to Main Process
ipcMain.handle(StoreEvents.GET, async (_, key, namespace, defaultValue) => {
  const typedManager = await getTypedStorageManagerInstance();
  const result = await typedManager.get(key, namespace, defaultValue);
  return result;
});

// Type-Safe Operations
TypedMultiStoreWrapper.get(key, namespace) // Types enforced
  ↓
MultiStoreManager.get(key, namespace)
  ↓
ElectronStoreLocalStorageProvider.get(key)
  ↓
electron-store storage file
```

### Example: Type-Safe Storage

```typescript
// TypeScript enforces correct types per namespace
const repos: Repository[] = await store.set(
  'repo-1',
  repoData,
  StaticNamespaces.REPOSITORIES  // Type: Repository
);

const userPrefs: UserPreferences = await store.get(
  'settings',
  StaticNamespaces.USER_PREFERENCES  // Type: UserPreferences
);
```

---

## 6. Persistence Layer Details

### Backend: Electron-Store

- **Provider**: ElectronStoreLocalStorageProvider
- **Storage Location**: `app.getPath('userData')`
  - Example: `~/Library/Application Support/AppName/` (macOS)
- **File Format**: JSON files per namespace
  - `user-preferences.json`
  - `repositories.json`
  - `ai-configuration.json`
  - etc.

### Namespace-to-File Mapping

```typescript
// Each namespace gets dedicated electron-store instance
const dedicatedProvider = new ElectronStoreLocalStorageProvider(
  `${namespaceName}-store`
);

// Initialized with namespace config
await dedicatedProvider.initialize(namespace.config);
```

### Non-Persisted Namespaces

- `cache` and `temp` use **memory provider** (lost on app restart)
- Used for performance-critical operations

### Data Persistence Features

- **Automatic**: All electron-store data persists automatically
- **No ORM**: Direct JSON storage, no database
- **Synchronous Reads**: electron-store has sync API, but wrapped in async IPC
- **Hot Reload**: Not implemented (no watch/observe pattern)

---

## 7. Renderer Context API (UI State)

### Purpose
Local UI state management using React Context, **separate from persistent storage**.

### Key Contexts

#### PanelContext
```typescript
interface ExtendedPanelContextValue {
  currentScope: { type: 'repository' | 'workspace'; workspace; repository };
  slices: Map<string, DataSlice>;  // Data slices (git, workspace, repositories)
  repositoryPath: string | null;
  gitStatus: { staged, unstaged, untracked, deleted };
  terminalSessions: TerminalInfo[];
  loading: boolean;
}

interface PanelProviderValue {
  context: ExtendedPanelContextValue;
  actions: ExtendedPanelActions;  // openFile, openRepository, createTerminalSession, etc.
  events: PanelEventEmitter;  // Event bus for cross-panel communication
}
```

Usage:
```typescript
const { context, actions, events } = usePanelProvider();

// Actions
actions.openFile(filePath);
actions.createTerminalSession({ cwd: context.repositoryPath });

// Events
events.emit({ type: 'file:opened', source: 'alexandria-workspace', payload: {...} });
```

#### Other Contexts
- **GitChangesContext**: Track staged/unstaged changes
- **RepositoryContext**: Current repository metadata
- **SelectedRepositoryContext**: Track selected repo
- **WorkspaceFilterContext**: Filter/search state
- **HighlightLayersContext**: Visualization highlights

---

## 8. Task & MCP-Related Data Structures

### Palace Tasks (Memory Palace Integration)

**Location**: `/src/main/palace-tasks/palaceTasksHandlers.ts`

**API**:
```typescript
interface Task {
  id: string;
  title: string;
  status: TaskStatus;  // 'pending' | 'completed' | 'failed'
  priority?: TaskPriority;
  // ... (from @principal-ai/alexandria-core-library)
}

interface GetTasksResponse {
  tasks: Task[];
  total: number;
}

enum PalaceTasksAPIEvent {
  GET_TASKS = 'palace-tasks:get-tasks',
  GET_TASK = 'palace-tasks:get-task',
  UPDATE_TASK_STATUS = 'palace-tasks:update-task-status',
  DELETE_TASK = 'palace-tasks:delete-task',
}
```

**Usage**:
```typescript
// Renderer
const tasks = await PalaceTasksService.getTasks(repositoryPath, options);
await PalaceTasksService.updateTaskStatus(repositoryPath, taskId, 'completed');

// Main Process
const palace = new MemoryPalace(validatedPath, fsAdapter);
const tasks = palace.getTasks(options);
palace.completeTask(taskId, gitRefs);
```

### No MCP-Specific Store Found

- MCP bridge data uses generic storage patterns
- Referenced in docs but not separate namespace (yet)
- Tasks are stored within Memory Palace, not as separate store namespace

---

## 9. Integration with Renderer Process

### Step 1: Service Layer Abstraction
```typescript
// Renderer calls service
StoreService.get('settings', StaticNamespaces.USER_PREFERENCES)
```

### Step 2: IPC Bridge
```typescript
// Service delegates to main process via IPC
window.mainProcess.store.get(key, namespace, defaultValue)
```

### Step 3: Main Process Handler
```typescript
// Handler verifies namespace, applies type checking
ipcMain.handle(StoreEvents.GET, async (_, key, namespace, defaultValue) => {
  const typedManager = await getTypedStorageManagerInstance();
  return await typedManager.get(key, namespace, defaultValue);
});
```

### Step 4: Storage Retrieval
```typescript
// TypedMultiStoreWrapper enforces types
const result = await wrapper.get(key, namespace);
// Returns with proper type from NamespaceDataTypes
```

---

## 10. Store Architecture Example: User Preferences

```
File Structure:
~/Library/Application Support/App/user-preferences.json

Content:
{
  "autoCommitOnStop": false,
  "theme": "dark",
  "workspace": "my-workspace"
}

Access Path:
1. React Component → usePanelProvider() or direct context
2. Renders UI, calls action or reads context
3. On save: StoreService.set('settings', userPrefs, 'user-preferences')
4. IPC → Main Process → TypedMultiStore → ElectronStore
5. Written to disk

Persistence:
- Automatic on each set() call
- JSON format
- File path: `{userData}/user-preferences.json`
```

---

## 11. Key Characteristics

### Strengths
- **Type Safety**: TypeScript enforces correct data types per namespace
- **Isolation**: Namespaces prevent cross-concern data mixing
- **Modularity**: Easy to add new namespaces
- **Flexibility**: Supports multiple backends (electron-store, S3, memory)
- **Scalability**: Namespace-specific providers can be optimized independently

### Limitations
- **No Real-Time Sync**: No watch/observe pattern currently (disabled for performance)
- **No Database**: Pure JSON file storage, not suitable for very large datasets
- **No Transactions**: No rollback or atomic multi-namespace operations
- **No Query Language**: Key-value only, no complex queries
- **Limited Caching**: Cache/temp use memory, not persistent

### Performance Considerations
- Each namespace gets dedicated electron-store instance
- Batch operations (batchGet, batchSet, deleteMultiple) for performance
- Chunk-based processing for large operations (100-item chunks)
- Memory providers for cache/temp to avoid disk I/O

---

## 12. Data Validation & Type Safety

### Validation Strategy
```typescript
// In TypedMultiStoreWrapper.set()
if (isStaticNamespace(namespace)) {
  if (!NamespaceDataValidator.validateNamespaceData(namespace, value)) {
    console.warn(`Validation failed for ${namespace}`);
  }
}
// Warning only, does not block operation
```

### Type Definitions
```typescript
// Compile-time type checking
interface NamespaceDataTypes {
  [StaticNamespaces.USER_PREFERENCES]: UserPreferences;
  [StaticNamespaces.REPOSITORIES]: Repository;
  // ... one entry per namespace
}

// Usage
const data: NamespaceDataTypes['user-preferences'];  // Type: UserPreferences
```

---

## 13. Extension/Configuration Points

### Adding a New Namespace

1. **Add to Enum**
   ```typescript
   export enum StaticNamespaces {
     MY_NAMESPACE = 'my-namespace'
   }
   ```

2. **Define Data Type**
   ```typescript
   interface MyNamespaceData {
     id: string;
     // ...
   }
   
   export interface NamespaceDataTypes {
     [StaticNamespaces.MY_NAMESPACE]: MyNamespaceData;
   }
   ```

3. **Register in MultiStoreManager**
   ```typescript
   private setupDefaultNamespaces() {
     this.namespaces.set(StaticNamespaces.MY_NAMESPACE, {
       name: StaticNamespaces.MY_NAMESPACE,
       storageProvider: 'electron-store',
       category: NamespaceCategory.CORE,
       // ...
     });
   }
   ```

4. **Use in Renderer**
   ```typescript
   const data = await StoreService.get('key', 'my-namespace');
   ```

---

## 14. MCP Integration Approach

Based on the codebase structure, integrating tasks into store infrastructure:

### Current Approach: MemoryPalace Independent
- Tasks managed by MemoryPalace library
- No separate "tasks" namespace in store
- Accessed via PalaceTasksService, not StoreService

### Potential Approach: Store-Backed Tasks
```typescript
// Future: Add to store namespaces
export enum StaticNamespaces {
  TASKS = 'palace-tasks',  // Could store task metadata
  TASK_EVENTS = 'task-events'  // Store task event logs
}

// Then access via unified StoreService
const tasks = await StoreService.get('tasks-index', 'palace-tasks');
```

---

## Summary

This Electron app uses a **sophisticated Multi-Store Manager pattern** with:
- **Backend**: Namespace-based storage with electron-store JSON persistence
- **Frontend**: IPC bridge with type-safe wrapper
- **UI State**: React Context API for local component state
- **Type Safety**: Compile-time enforcement via TypeScript
- **Persistence**: Automatic JSON serialization in app userData directory
- **No Framework**: Custom implementation (not Redux/Zustand/MobX)

The architecture is well-suited for the app's needs: modular configuration storage, session tracking, and cached data management across a complex Electron + renderer process environment.
