# Store Infrastructure - Quick Reference

## Quick Access Patterns

### Reading from Store (Renderer)
```typescript
import { StoreService } from '@/renderer/main-process-api/StoreService';
import { StaticNamespaces } from '@/shared/types/namespaces.types';

// Simple get
const userPrefs = await StoreService.get('settings', StaticNamespaces.USER_PREFERENCES);

// With default value
const theme = await StoreService.get('theme', StaticNamespaces.USER_PREFERENCES, 'dark');

// Check if key exists
const hasKey = await StoreService.has('settings', StaticNamespaces.USER_PREFERENCES);

// Get all keys in namespace
const allKeys = await StoreService.keys(StaticNamespaces.USER_PREFERENCES);
```

### Writing to Store (Renderer)
```typescript
// Simple set
await StoreService.set('settings', userPrefs, StaticNamespaces.USER_PREFERENCES);

// Delete a key
await StoreService.delete('settings', StaticNamespaces.USER_PREFERENCES);

// Clear entire namespace
await StoreService.clear(StaticNamespaces.USER_PREFERENCES);
```

### Using Context API (Renderer)
```typescript
import { usePanelProvider } from '@/renderer/contexts/PanelContext';

function MyComponent() {
  const { context, actions, events } = usePanelProvider();
  
  // Access context data
  const repoPath = context.repositoryPath;
  const gitStatus = context.gitStatus;
  
  // Call actions
  actions.openFile('/path/to/file');
  actions.createTerminalSession({ cwd: context.repositoryPath });
  
  // Emit events
  events.emit({
    type: 'file:opened',
    source: 'my-component',
    timestamp: Date.now(),
    payload: { filePath: '/path/to/file' }
  });
}
```

### Tasks API (Renderer)
```typescript
import { PalaceTasksService } from '@/renderer/main-process-api/PalaceTasksService';

// Get all tasks
const response = await PalaceTasksService.getTasks(repositoryPath, { status: 'pending' });

// Get single task
const task = await PalaceTasksService.getTask(repositoryPath, taskId);

// Update task status
await PalaceTasksService.updateTaskStatus(repositoryPath, taskId, 'completed');

// Delete task
await PalaceTasksService.deleteTask(repositoryPath, taskId);
```

---

## Available Namespaces

### Core Data
- `user-preferences` - User settings
- `repositories` - Repo configs
- `ai-configuration` - AI settings
- `llm-models` - LLM configs

### Session & History
- `global-session-registry` - Session tracking
- `session-summaries` - Quick summaries

### Infrastructure
- `cache` - In-memory cache
- `temp` - Temporary storage
- `docker-containers` - Docker state
- `docker-sessions` - Docker sessions
- `secrets-metadata` - Secret metadata
- `repository-links` - Bookmarks

---

## Adding a New Namespace

### 1. Add to StaticNamespaces enum
**File**: `src/shared/types/namespaces.types.ts`
```typescript
export enum StaticNamespaces {
  MY_NAMESPACE = 'my-namespace',
  // ...
}
```

### 2. Define data type
**File**: `src/main/storage-providers/typed-namespaces.ts`
```typescript
export interface NamespaceDataTypes {
  [StaticNamespaces.MY_NAMESPACE]: MyDataType;
  // ...
}
```

### 3. Register in MultiStoreManager
**File**: `src/main/storage-providers/MultiStoreManager.ts` (setupDefaultNamespaces)
```typescript
this.register(StaticNamespaces.MY_NAMESPACE, {
  name: StaticNamespaces.MY_NAMESPACE,
  description: 'My namespace description',
  storageProvider: 'electron-store',
  category: NamespaceCategory.CORE,
});
```

### 4. Use in code
```typescript
import { StoreService } from '@/renderer/main-process-api/StoreService';

const data = await StoreService.get('key', StaticNamespaces.MY_NAMESPACE);
```

---

## File Locations Quick Map

```
src/
├── main/
│   ├── storage-providers/
│   │   ├── MultiStoreManager.ts          (Core manager)
│   │   ├── typed-multistore-wrapper.ts   (Type safety)
│   │   ├── typed-namespaces.ts          (Data types)
│   │   └── ElectronStoreLocalStorageProvider.ts (Persistence)
│   ├── stores/
│   │   └── storeHandlers.ts             (IPC handlers)
│   └── palace-tasks/
│       └── palaceTasksHandlers.ts       (Task handlers)
│
├── renderer/
│   ├── contexts/
│   │   ├── PanelContext.tsx             (UI state)
│   │   └── *.tsx                        (Other UI contexts)
│   └── main-process-api/
│       ├── StoreService.ts              (Store client)
│       └── PalaceTasksService.ts        (Tasks client)
│
├── window/
│   └── main-process-api-implementations/
│       └── storeApi.ts                  (IPC bridge)
│
└── shared/
    ├── types/
    │   └── namespaces.types.ts          (Namespace enums)
    └── main-process-api-interfaces/
        ├── StoreAPI.ts                  (Store interface)
        └── PalaceTasksAPI.ts            (Tasks interface)
```

---

## Key Classes & Interfaces

### MultiStoreManager
Core store manager with namespace routing.
```typescript
manager.get(key, namespace, defaultValue)
manager.set(key, value, namespace)
manager.delete(key, namespace)
manager.has(key, namespace)
manager.clear(namespace)
manager.keys(namespace)
manager.getNamespaceStats(namespace)
```

### TypedMultiStoreWrapper
Type-safe wrapper (use this, not MultiStoreManager directly).
```typescript
wrapper.get(key, namespace, defaultValue)  // Returns typed data
wrapper.set(key, value, namespace)         // Enforces types
wrapper.namespace(ns)                      // Get namespace ops
```

### StoreService (Renderer)
IPC client for accessing store from renderer.
```typescript
StoreService.get(key, namespace, defaultValue)
StoreService.set(key, value, namespace)
StoreService.delete(key, namespace)
StoreService.has(key, namespace)
```

### PanelContext (UI State)
React Context for panel/UI state.
```typescript
const { context, actions, events } = usePanelProvider();
```

---

## Common Tasks

### Save user preferences
```typescript
await StoreService.set('settings', {
  theme: 'dark',
  autoCommit: true
}, StaticNamespaces.USER_PREFERENCES);
```

### Load all repositories
```typescript
const keys = await StoreService.keys(StaticNamespaces.REPOSITORIES);
const repos = await Promise.all(
  keys.map(key => StoreService.get(key, StaticNamespaces.REPOSITORIES))
);
```

### Cache operation results
```typescript
// Cache some data
await StoreService.set(`cache-${id}`, data, StaticNamespaces.CACHE);

// Retrieve from cache
const cached = await StoreService.get(`cache-${id}`, StaticNamespaces.CACHE);
```

### Handle git status
```typescript
const { context } = usePanelProvider();
const { staged, unstaged, untracked } = context.gitStatus;
```

### Create terminal session
```typescript
const { actions } = usePanelProvider();
const sessionId = await actions.createTerminalSession({ 
  cwd: '/path/to/repo' 
});
```

---

## Persistence

Data persists to:
- macOS: `~/Library/Application Support/AppName/`
- Linux: `~/.config/AppName/`
- Windows: `%APPDATA%\AppName\`

Files created per namespace:
- `user-preferences.json`
- `repositories.json`
- `ai-configuration.json`
- etc.

---

## Performance Tips

1. **Use batch operations for multiple keys**
   ```typescript
   // Instead of multiple gets
   const result = await wrapper.batchGet(namespace, [key1, key2, key3]);
   ```

2. **Cache in-memory where possible**
   Use `StaticNamespaces.CACHE` for temporary data

3. **Avoid large watch operations**
   Watch/observe pattern removed for performance

4. **Use namespace-specific operations**
   Each namespace has optimized storage provider instance

---

## Debugging

### View all namespaces
```typescript
const namespaces = await StoreService.listNamespaces();
console.log(namespaces);
```

### Get namespace stats
```typescript
const stats = await StoreService.getNamespaceStats(StaticNamespaces.USER_PREFERENCES);
console.log(stats);
```

### Check file location
```typescript
const filePath = await StoreService.getNamespaceFilePath(StaticNamespaces.USER_PREFERENCES);
console.log('Store file:', filePath);
```

---

## Important Notes

- **No watch pattern**: Store changes don't auto-sync across processes
- **Type safety**: All operations enforce types at compile time
- **IPC bridge**: All renderer access goes through IPC
- **Async/await**: All operations are async
- **Default namespacing**: Must always specify namespace in calls
- **No transactions**: Each operation is independent
