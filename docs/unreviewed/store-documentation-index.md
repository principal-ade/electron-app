# Store Infrastructure Documentation Index

This index provides quick navigation to store-related documentation and code files.

## Documentation Files

### 1. STORE_INFRASTRUCTURE_ANALYSIS.md
**Purpose**: Comprehensive technical reference document  
**Length**: 527 lines, 17 KB  
**Best for**: Understanding the full architecture, deep dives, architectural decisions

**Contents**:
- Executive summary of the Multi-Store Manager architecture
- Complete file listing with purposes
- State management pattern explanation (Custom Multi-Store vs Context API)
- Namespace segregation strategy (17 namespaces defined)
- Type safety implementation details
- Renderer process integration
- Persistence layer (Electron-Store) details
- Context API usage patterns (PanelContext, etc.)
- Task and MCP integration
- Data validation and type checking
- Extension points for adding namespaces
- Key characteristics (strengths/limitations)

**Read this if you need to**:
- Understand how data flows through the system
- Learn about namespace architecture
- Understand type safety implementation
- Plan architectural changes
- Integrate new systems

---

### 2. STORE_QUICK_REFERENCE.md
**Purpose**: Quick lookup guide for developers  
**Length**: 323 lines, 8.3 KB  
**Best for**: Copy-paste code examples, quick answers, debugging

**Contents**:
- Quick access patterns (read/write/task operations)
- Available namespaces list
- Step-by-step adding a new namespace
- File location quick map
- Key classes and interfaces
- Common tasks with code examples
- Persistence information
- Performance tips
- Debugging methods
- Important notes and gotchas

**Read this if you need to**:
- Write code that accesses the store
- Find a file quickly
- Debug store issues
- Add a new namespace
- Check persistence details

---

## Key Files in Codebase

### Main Process - Storage Backend

| File | Purpose | Key Class |
|------|---------|-----------|
| `src/main/storage-providers/MultiStoreManager.ts` | Core namespace + backend routing | `MultiStoreManager` |
| `src/main/storage-providers/typed-multistore-wrapper.ts` | Type-safe wrapper | `TypedMultiStoreWrapper` |
| `src/main/storage-providers/typed-namespaces.ts` | Type definitions per namespace | `NamespaceDataTypes`, `TypedNamespaceRegistry` |
| `src/main/storage-providers/ElectronStoreLocalStorageProvider.ts` | JSON file storage backend | `ElectronStoreLocalStorageProvider` |
| `src/main/stores/storeHandlers.ts` | IPC handler registration | IPC event handlers |

### Renderer Process - Frontend Access

| File | Purpose | Key Class |
|------|---------|-----------|
| `src/renderer/main-process-api/StoreService.ts` | Store client for renderer | `StoreService` (static) |
| `src/window/main-process-api-implementations/storeApi.ts` | IPC implementation | IPC renderer bridge |

### UI State Management

| File | Purpose | Key Hook |
|------|---------|----------|
| `src/renderer/contexts/PanelContext.tsx` | Panel/workspace state | `usePanelProvider()` |
| `src/renderer/contexts/GitChangesContext.tsx` | Git status tracking | Context |
| `src/renderer/contexts/RepositoryContext.tsx` | Repository metadata | Context |
| `src/renderer/contexts/SelectedRepositoryContext.tsx` | Selected repo tracking | Context |
| `src/renderer/contexts/WorkspaceFilterContext.tsx` | Workspace filtering | Context |
| `src/renderer/contexts/VisibleProjectsContext.tsx` | Project visibility | Context |
| `src/renderer/contexts/HighlightLayersContext.tsx` | Highlight visualization | Context |

### Task Integration

| File | Purpose | Key Class |
|------|---------|-----------|
| `src/main/palace-tasks/palaceTasksHandlers.ts` | Task IPC handlers | IPC event handlers |
| `src/renderer/main-process-api/PalaceTasksService.ts` | Task client | `PalaceTasksService` (static) |
| `src/shared/main-process-api-interfaces/PalaceTasksAPI.ts` | Task API types | Type definitions |

### Configuration

| File | Purpose | Key Type |
|------|---------|----------|
| `src/shared/types/namespaces.types.ts` | Namespace enum | `StaticNamespaces` enum |
| `src/main/storage-providers/all-namespaces.ts` | Namespace helpers | Helper functions |

---

## Namespace Quick Reference

### Core Data Namespaces
- **user-preferences** - User settings (persisted)
- **repositories** - Repository metadata (persisted)
- **ai-configuration** - AI provider config (persisted)
- **llm-models** - LLM configurations (persisted)

### Session Namespaces
- **global-session-registry** - Session tracking (persisted)
- **session-summaries** - Session summaries (persisted)

### Cache Namespaces
- **cache** - General cache (memory only, not persisted)
- **temp** - Temporary storage (memory only, not persisted)

### Infrastructure Namespaces
- **docker-containers** - Docker state (persisted)
- **docker-sessions** - Docker sessions (persisted)
- **secrets-metadata** - Secret metadata (persisted)
- **repository-links** - Bookmarks (persisted)

**Total: 17 namespaces**

---

## Common Operations

### Reading Data
```typescript
import { StoreService } from '@/renderer/main-process-api/StoreService';
import { StaticNamespaces } from '@/shared/types/namespaces.types';

const data = await StoreService.get('key', StaticNamespaces.USER_PREFERENCES);
```

### Writing Data
```typescript
await StoreService.set('key', value, StaticNamespaces.USER_PREFERENCES);
```

### Using Context
```typescript
import { usePanelProvider } from '@/renderer/contexts/PanelContext';

const { context, actions, events } = usePanelProvider();
const repoPath = context.repositoryPath;
actions.openFile(filePath);
events.emit({ type: 'file:opened', /* ... */ });
```

### Task Operations
```typescript
import { PalaceTasksService } from '@/renderer/main-process-api/PalaceTasksService';

const tasks = await PalaceTasksService.getTasks(repositoryPath);
await PalaceTasksService.updateTaskStatus(repositoryPath, taskId, 'completed');
```

---

## How to...

### Add a New Namespace
1. See "Adding a New Namespace" in STORE_QUICK_REFERENCE.md
2. Steps: enum → type → registration → usage
3. Detailed example in STORE_INFRASTRUCTURE_ANALYSIS.md

### Access Store Data in Renderer
1. Import StoreService
2. Import StaticNamespaces enum
3. Use StoreService.get() / set() / delete()
4. See code examples in STORE_QUICK_REFERENCE.md

### Use Panel Context
1. Import usePanelProvider hook
2. Destructure { context, actions, events }
3. Access context data or call actions
4. Full API in PanelContext.tsx

### Debug Store Issues
1. Check namespace exists: `StoreService.listNamespaces()`
2. Get stats: `StoreService.getNamespaceStats(namespace)`
3. Find file: `StoreService.getNamespaceFilePath(namespace)`
4. See "Debugging" section in STORE_QUICK_REFERENCE.md

### Work with Tasks
1. Import PalaceTasksService
2. Use getTasks(), getTask(), updateTaskStatus()
3. Tasks use Memory Palace library (not namespace store)
4. See STORE_INFRASTRUCTURE_ANALYSIS.md section 8

---

## Architecture Layers

```
┌─ Layer 1: React Components ──────────────────┐
│  ├─ Context API (usePanelProvider)          │
│  └─ Context Hooks (useGitChanges, etc.)     │
├─ Layer 2: Service Layer ─────────────────────┤
│  ├─ StoreService (IPC wrapper)              │
│  └─ PalaceTasksService (IPC wrapper)        │
├─ Layer 3: IPC Bridge ─────────────────────────┤
│  └─ storeApi.ts / storeHandlers.ts          │
├─ Layer 4: Type Safety ────────────────────────┤
│  └─ TypedMultiStoreWrapper                  │
├─ Layer 5: Core Manager ───────────────────────┤
│  └─ MultiStoreManager (namespace routing)   │
├─ Layer 6: Storage Backend ────────────────────┤
│  └─ ElectronStoreLocalStorageProvider       │
├─ Layer 7: File System ────────────────────────┤
│  └─ electron-store (JSON files)             │
└─ Layer 8: Persistence ────────────────────────┘
   ~/.../AppName/user-preferences.json (etc.)
```

---

## Performance Notes

1. **Batch Operations**: Use batchGet/batchSet for multiple keys
2. **Chunk Processing**: Large operations split into 100-item chunks
3. **Memory Cache**: Use cache/temp namespaces for temporary data
4. **Namespace Providers**: Each namespace has dedicated provider instance
5. **No Watch**: Real-time sync disabled for performance

See "Performance Tips" in STORE_QUICK_REFERENCE.md

---

## Type Safety

The store enforces TypeScript compile-time type checking:

```typescript
// Type enforced at compile time
interface NamespaceDataTypes {
  [StaticNamespaces.USER_PREFERENCES]: UserPreferences;
  [StaticNamespaces.REPOSITORIES]: Repository;
  // ... one per namespace
}

// TypeScript enforces correct types
const data: NamespaceDataTypes['user-preferences']; // Type: UserPreferences
```

See "Data Validation & Type Safety" in STORE_INFRASTRUCTURE_ANALYSIS.md

---

## Persistence Details

- **Backend**: electron-store library (npm)
- **Location**: `app.getPath('userData')`
  - macOS: `~/Library/Application Support/AppName/`
  - Linux: `~/.config/AppName/`
  - Windows: `%APPDATA%\AppName\`
- **Format**: JSON files per namespace
- **Behavior**: Auto-persisted on set()

See "Persistence Layer Details" in STORE_INFRASTRUCTURE_ANALYSIS.md

---

## Limitations

- No real-time sync (watch pattern disabled)
- Pure JSON file storage (not database)
- No transactions or rollback
- Key-value only (no complex queries)
- Cache/temp not persisted (memory-backed)

See "Key Characteristics" in STORE_INFRASTRUCTURE_ANALYSIS.md

---

## Related Documentation

- **PANEL_EXTENSION_STORE_SPECIFICATION.md** - Panel loading and store spec
- **STORE_NAMESPACES.md** - Mapping namespaces to UI features
- **src/shared/main-process-api-interfaces/StoreAPI.ts** - Store interface
- **src/shared/main-process-api-interfaces/PalaceTasksAPI.ts** - Task interface

---

## Quick Links

### Code
- MultiStoreManager: `/src/main/storage-providers/MultiStoreManager.ts`
- StoreService: `/src/renderer/main-process-api/StoreService.ts`
- PanelContext: `/src/renderer/contexts/PanelContext.tsx`
- StaticNamespaces enum: `/src/shared/types/namespaces.types.ts`

### Interfaces
- StoreAPI: `/src/shared/main-process-api-interfaces/StoreAPI.ts`
- PalaceTasksAPI: `/src/shared/main-process-api-interfaces/PalaceTasksAPI.ts`

### Documentation
- STORE_INFRASTRUCTURE_ANALYSIS.md - Technical reference
- STORE_QUICK_REFERENCE.md - Developer guide
- STORE_DOCUMENTATION_INDEX.md - This file

---

## Questions & Troubleshooting

**Q: How do I access store data from a React component?**  
A: See "Using Context API" section above and code examples in STORE_QUICK_REFERENCE.md

**Q: How do I add a new namespace?**  
A: See "Adding a New Namespace" in STORE_QUICK_REFERENCE.md or detailed explanation in STORE_INFRASTRUCTURE_ANALYSIS.md

**Q: Where is data persisted?**  
A: See "Persistence Details" above - JSON files in app userData directory

**Q: How do tasks integrate with the store?**  
A: See "Task Integration" in STORE_INFRASTRUCTURE_ANALYSIS.md - currently separate from namespace store

**Q: Why is my store data not syncing across windows?**  
A: Real-time sync (watch pattern) is disabled for performance - use polling if needed

**Q: Can I add a database backend?**  
A: Yes, implement StorageProvider interface and register in MultiStoreManager

See STORE_INFRASTRUCTURE_ANALYSIS.md section 13 for more extension points.

---

**Last Updated**: November 14, 2025  
**Documentation Version**: 1.0
