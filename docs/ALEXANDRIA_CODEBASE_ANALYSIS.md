# Alexandria Codebase Analysis

## Executive Summary
Complete analysis of Alexandria functionality in the electron-app codebase, with focus on delete/remove operations, local repositories panel, and UI components.

**Key Finding:** Delete functionality is fully implemented in the backend but NOT exposed in the UI for user interaction.

---

## 1. Delete/Remove Operations - FULLY IMPLEMENTED

### Backend Implementation Files

#### AlexandriaRegistryService.ts
**Path:** `src/main/stores/AlexandriaRegistryService.ts` (lines 359-403)

```typescript
async removeRepository(name: string, deleteLocal = false): Promise<boolean>
```

**Functionality:**
- Retrieves repository details before removal
- Accesses internal `projectRegistry` via reflection (workaround)
- Removes from registry via `projectRegistry.removeProject(name)`
- Optionally deletes local files via `FileSystemService.deleteDirectory()`
- Handles errors gracefully
- Returns success/failure boolean

**Features:**
- Conditional local file deletion
- Error handling for both registry and file system operations
- Logging for debugging

#### AlexandriaApiEventHandler.ts
**Path:** `src/main/stores/AlexandriaApiEventHandler.ts` (lines 67-83)

**Responsibility:**
- Wraps `AlexandriaRegistryService.removeRepository()`
- Broadcasts `REPOSITORY_REMOVED` event to all windows
- Unregisters repository from monitoring system
- Handles IPC communication

**Event Broadcasting:**
```typescript
this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_REMOVED, { name })
```

### IPC/API Layer

#### AlexandriaAPI Interface
**Path:** `src/shared/main-process-api-interfaces/AlexandriaAPI.ts` (lines 66-71)

```typescript
removeRepository(name: string, deleteLocal?: boolean): Promise<boolean>
```

**IPC Event:**
```typescript
enum AlexandriaAPIEvent {
  REMOVE = 'alexandria:remove',
  REPOSITORY_REMOVED = 'alexandria:repository-removed',
}
```

#### Window Implementation
**Path:** `src/window/main-process-api-implementations/alexandriaApi.ts` (line 62-63)

```typescript
removeRepository: (name: string, deleteLocal?: boolean) =>
  ipcRenderer.invoke(AlexandriaAPIEvent.REMOVE, name, deleteLocal),
```

#### Renderer Service
**Path:** `src/renderer/main-process-api/AlexandriaService.ts` (lines 37-42)

```typescript
static async removeRepository(
  name: string,
  deleteLocal?: boolean,
): Promise<boolean> {
  return window.mainProcess.alexandria.removeRepository(name, deleteLocal);
}
```

---

## 2. Local Repositories Panel

### Panel Container
**File:** `src/renderer/panels/components/LocalProjectsPanel.tsx`

**Features:**
- Search/filter input
- Responsive grid of repository cards
- Sorted by most recent commit (descending)
- Loading and empty states
- Filter repositories by:
  - Repository name
  - GitHub owner/name
  - Remote URL

**Dependencies:**
- Uses `useAllRepositories()` hook for cached data
- Renders `LocalProjectCard` for each repository

### Individual Project Card
**File:** `src/renderer/panels/components/LocalProjectCard.tsx`

**Component Structure:**
```
┌─ Avatar (32x32)
│
├─ Main Content
│  ├─ Name
│  ├─ Path (clickable copy)
│  └─ Language / Description
│
└─ Action Buttons
   ├─ Location Indicator (workspace)
   ├─ Move to Workspace (conditional)
   ├─ Open/Focus
   └─ Remove from Workspace (workspace only, X button)
```

**State Management:**
```typescript
const [windowState, setWindowState] = useState<'closed' | 'opening' | 'ready'>('closed');
const [isInWorkspaceDirectory, setIsInWorkspaceDirectory] = useState<boolean | null>(null);
const [isMoving, setIsMoving] = useState(false);
const [isRemoving, setIsRemoving] = useState(false);
const [copiedPath, setCopiedPath] = useState(false);
```

**Important:** The `isRemoving` state is for "remove from workspace", NOT repository deletion.

---

## 3. UI Actions Currently Available

### LocalProjectCard Buttons
1. **Copy Path** - Copies `entry.path` to clipboard
2. **Move to Workspace** - Moves repository to workspace directory
3. **Open/Focus** - Opens repository window or focuses if already open
4. **Remove from Workspace** (X button) - Removes from workspace (not deletion)

### What's Missing
- NO delete button
- NO context menu (right-click)
- NO delete confirmation dialog
- NO delete UI state management

---

## 4. Alexandria Documents Panel

### Panel Component
**File:** `src/renderer/repo-manager/shared/AlexandriaDocsPanel.tsx`

**Functionality:**
- Lists markdown documents for a repository
- Search documents by name or path
- Filter: all documents vs. tracked only
- Sort: alphabetically vs. recently edited
- Show coverage overlay
- Highlight associated CodebaseView files

### Document Item Component
**File:** `src/renderer/repo-manager/shared/AlexandriaDocItem.tsx`

**Features:**
- Document name and relative path
- Tracked/untracked indicator
- Expandable list of associated files
- Modification time display
- File change indicators

**Important:** No delete functionality for documents.

---

## 5. Event System

### Event Types
```typescript
enum AlexandriaEventType {
  ADDED = 'added',
  UPDATED = 'updated',
  REMOVED = 'removed',
}
```

### IPC Events
```typescript
enum AlexandriaAPIEvent {
  REPOSITORY_ADDED = 'alexandria:repository-added',
  REPOSITORY_UPDATED = 'alexandria:repository-updated',
  REPOSITORY_REMOVED = 'alexandria:repository-removed',
  // ... other events
}
```

### Event Flow
```
User Action → AlexandriaService.removeRepository()
    ↓
IPC invoke → AlexandriaAPI.REMOVE
    ↓
Main Process Handler → AlexandriaRegistryService.removeRepository()
    ↓
Remove from registry + Optional file deletion
    ↓
Broadcast REPOSITORY_REMOVED to all windows
    ↓
Monitoring system notified
    ↓
Event listeners in panels/components update UI
```

---

## 6. Related Files Summary

### Core Alexandria Files
| File | Purpose |
|------|---------|
| `src/main/stores/AlexandriaRegistryService.ts` | Backend registry management |
| `src/main/stores/AlexandriaApiEventHandler.ts` | IPC event handling + broadcasting |
| `src/shared/main-process-api-interfaces/AlexandriaAPI.ts` | API interface definition |
| `src/window/main-process-api-implementations/alexandriaApi.ts` | IPC implementation |
| `src/renderer/main-process-api/AlexandriaService.ts` | Renderer service layer |

### UI Components
| File | Purpose |
|------|---------|
| `src/renderer/panels/components/LocalProjectsPanel.tsx` | Panel container |
| `src/renderer/panels/components/LocalProjectCard.tsx` | Individual repository item |
| `src/renderer/repo-manager/shared/AlexandriaDocsPanel.tsx` | Documents display |
| `src/renderer/repo-manager/shared/AlexandriaDocItem.tsx` | Document item |

### Documentation
| File | Purpose |
|------|---------|
| `docs/SUGGESTED_ALEXANDRIA_UI_CHANGES.md` | Proposed improvements to Alexandria components |

---

## 7. Implementation Status

### Delete Operations
- **Backend:** Fully implemented and functional
- **API Layer:** Complete (IPC + service)
- **UI:** NOT IMPLEMENTED
- **Context Menu:** NOT IMPLEMENTED

### Search & Navigation
- **Backend:** Fully implemented
- **UI:** Fully implemented in panels
- **Search:** Works with name, owner, URL

### Workspace Management
- **Backend:** Fully implemented
- **UI:** Move to workspace button available
- **Remove from workspace:** Available (non-destructive)

### Document Management
- **Backend:** No delete functionality
- **UI:** Read-only display only
- **Delete:** Not implemented

---

## 8. How to Add Delete Functionality to UI

### Option 1: Add Delete Button to LocalProjectCard
**Location:** `src/renderer/panels/components/LocalProjectCard.tsx`

**Steps:**
1. Import `Trash2` icon from lucide-react
2. Add button in the action buttons section (around line 365)
3. Add state: `const [isDeleting, setIsDeleting] = useState(false)`
4. Create handler:
```typescript
const handleDeleteRepository = async (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!confirm(`Delete "${entry.name}" from Alexandria?\n\nThis will remove the repository from the registry.`)) {
    return;
  }
  try {
    setIsDeleting(true);
    await AlexandriaService.removeRepository(entry.name, false);
  } catch (error) {
    alert(`Failed to delete: ${error}`);
  } finally {
    setIsDeleting(false);
  }
};
```

### Option 2: Add Context Menu
**Location:** `src/renderer/panels/components/LocalProjectCard.tsx` (line ~222)

```typescript
const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  // Use Electron context menu API or custom context menu
  // Options: Open, Delete, Copy Path, Remove from Workspace
};
```

---

## 9. Architecture Notes

### Reflection Usage
The `removeRepository()` method uses reflection to access private `projectRegistry`:
```typescript
const registryField = (this.outpostManager as any).projectRegistry;
```

This is a workaround because `AlexandriaOutpostManager` doesn't expose a public removal method. This could be refactored when the upstream library is updated.

### Monitoring System Integration
Removed repositories are unregistered from the monitoring system:
```typescript
await this.unregisterFromMonitoring(existing.path);
```

This ensures the file system monitoring stops tracking the deleted repository.

### Event Broadcasting
All window instances are notified of changes:
```typescript
const windows = BrowserWindow.getAllWindows();
windows.forEach((window) => {
  if (!window.isDestroyed()) {
    window.webContents.send(eventType, data);
  }
});
```

---

## 10. Testing Considerations

### Delete Operation Tests
- ✓ Verify removal from registry
- ✓ Verify event broadcasting to all windows
- ✓ Test with `deleteLocal: false` (registry only)
- ✓ Test with `deleteLocal: true` (registry + files)
- ✓ Test error handling (non-existent repository)
- ✓ Test monitoring system unregistration

### UI Tests (if implemented)
- [ ] Delete button appears only when appropriate
- [ ] Confirmation dialog functions correctly
- [ ] Loading state during deletion
- [ ] UI updates after successful deletion
- [ ] Error messages display correctly
- [ ] Context menu functionality

---

## Conclusion

The Alexandria repository delete functionality is **fully implemented at the backend** with complete IPC support and event broadcasting. The missing piece is the **UI layer** - there are no buttons, context menus, or handlers exposed to users for executing the delete operation.

Adding delete functionality to the UI would require:
1. Adding UI controls (button or context menu) in `LocalProjectCard.tsx`
2. Calling `AlexandriaService.removeRepository()`
3. Adding confirmation dialogs and error handling
4. Optional: Listen to deletion events to update local state

The infrastructure is ready; implementation is straightforward.
