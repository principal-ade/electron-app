# Cleanup Tasks: Window.mainProcess Abstraction Violations

## Issue Overview
Direct access to `window.mainProcess` should only occur within the `/src/renderer/main-process-api` directory. All other renderer code should use the service abstractions provided in that directory. This maintains proper separation of concerns and makes the codebase more maintainable.

## Current Violations

### Components/Pages (15 files)
- [ ] `/src/renderer/components/agent-session-debug/EventProcessingTestView.tsx`
- [ ] `/src/renderer/components/landing-page/SettingsModal.tsx`
- [ ] `/src/renderer/pages/alexandria/AlexandriaRepositoryManager.tsx`
- [ ] `/src/renderer/pages/RepoManager/LocalDevelopmentView.tsx`
- [ ] `/src/renderer/pages/RepoManager/PlanningView.tsx`
- [ ] `/src/renderer/pages/RepoManager/shared/DocumentSearchPanel.tsx`
- [ ] `/src/renderer/pages/RepoManager/shared/AgentSessionsTab.tsx`
- [ ] `/src/renderer/components/repository-maps/SearchTab.tsx`
- [ ] `/src/renderer/components/layers/DependenciesView.tsx`

### Services (6 files)
- [ ] `/src/renderer/services/DocumentSearchService.ts`
- [ ] `/src/renderer/services/git-sync/GitSyncConnectionManager.ts`
- [ ] `/src/renderer/services/storage/TodoStorageService.ts`
- [ ] `/src/renderer/services/storage/CustomLayersStorageService.ts`
- [ ] `/src/renderer/services/GitignoreAnalysisService.ts`
- [ ] `/src/renderer/providers/ElectronPackageManagerApiProvider.ts`

### Test Files (2 files - may be acceptable for testing)
- [ ] `/src/renderer/utils/ipcBridgeReal.test.ts`
- [ ] `/src/renderer/utils/ipcBridgeDebug.test.ts`

## Refactoring Guidelines

### 1. Identify the API Being Used
Look for patterns like:
```typescript
// BAD - Direct access
window.mainProcess.fileSystem.readFile(path)
window.mainProcess.store.get(key)
window.mainProcess.git.status()
```

### 2. Find or Create the Appropriate Service
Check if a service already exists in `/src/renderer/main-process-api/`:
- `FileSystemService` - for file operations
- `StoreService` - for storage operations
- `GitService` - for git operations
- `AgentSessionService` - for agent sessions
- etc.

### 3. Import and Use the Service
```typescript
// GOOD - Using abstraction
import { FileSystemService } from '../main-process-api/FileSystemService';
import { StoreService } from '../main-process-api/StoreService';

// Use the service methods
const content = await FileSystemService.readFile(path);
const value = await StoreService.get(key);
```

### 4. Handle Return Value Differences
**Important:** Some services may return different structures than direct access:

```typescript
// Example: FileSystemService.readFile returns { content, filePath }
const result = await FileSystemService.readFile(path);
if (result && typeof result === 'object' && 'content' in result) {
    const content = result.content;
    // use content
}
```

### 5. Create Missing Service Methods
If a needed method doesn't exist in the service:
1. Add it to the appropriate service file
2. Keep the interface consistent with existing methods
3. Document any special return value handling

## Common Patterns to Fix

### Storage Access
```typescript
// BAD
const data = await window.mainProcess.store.get('key');

// GOOD
import { StoreService } from '../main-process-api/StoreService';
const data = await StoreService.get('key');
```

### File Operations
```typescript
// BAD
const content = await window.mainProcess.fileSystem.readFile(path);

// GOOD
import { FileSystemService } from '../main-process-api/FileSystemService';
const result = await FileSystemService.readFile(path);
// Note: Handle the result structure appropriately
```

### Git Operations
```typescript
// BAD
const status = await window.mainProcess.git.status();

// GOOD
import { GitService } from '../main-process-api/GitService';
const status = await GitService.status();
```

## Testing Your Changes
After refactoring:
1. Test that the functionality still works as expected
2. Check for TypeScript errors
3. Verify return value handling is correct
4. Test error cases

## Priority Order
1. **High Priority**: User-facing components (pages, views)
2. **Medium Priority**: Service files
3. **Low Priority**: Test files (may need direct access for mocking)

## Notes
- Some test files may legitimately need direct access for mocking/testing purposes
- When in doubt, check how similar functionality is implemented elsewhere
- Preserve existing behavior - only change the access pattern, not the functionality