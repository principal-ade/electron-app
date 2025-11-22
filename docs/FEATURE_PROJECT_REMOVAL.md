# Project Removal Feature Implementation

## Overview
Add functionality to remove projects from the Alexandria registry with options to either:
1. Remove from registry only (keeps local files)
2. Remove from registry and delete local files

## Current State Analysis
- ✅ API interface already defines `removeRepository` in `AlexandriaAPI.ts`
- ✅ Window API implementation handles remove events
- ⚠️ `AlexandriaRegistryService.removeRepository()` is stubbed, returns false
- ❌ No UI for removal functionality
- ❌ No confirmation dialog

## Implementation Tasks

### 1. Backend - AlexandriaRegistryService Enhancement
**File:** `src/main/stores/AlexandriaRegistryService.ts`

- [x] Check if AlexandriaOutpostManager supports repository removal
  - ✅ AlexandriaOutpostManager doesn't have removal, but ProjectRegistryStore has `removeProject(name: string): boolean`
  - ✅ Implemented workaround accessing private `projectRegistry` field
- [x] Implement `removeRepository(name: string, deleteLocal?: boolean)` method
- [x] Add file system deletion logic using FileSystemService.deleteDirectory()
- [x] Handle edge cases (repository not found, deletion failures)
- [x] Return success/failure status

### 2. Main Process - IPC Handler Updates
**File:** `src/main/stores/AlexandriaApiEventHandler.ts`

- [x] Updated IPC handler for `alexandria:remove` event
- [x] Accept parameters: `name` and optional `deleteLocal` flag
- [x] Call AlexandriaRegistryService.removeRepository()
- [x] Send `alexandria:repository-removed` event to renderer
- [x] Updated method signatures to support deleteLocal parameter

### 3. Frontend - Confirmation Dialog Component
**New File:** `src/renderer/components/dialogs/RemoveRepositoryDialog.tsx`

- [x] Create modal dialog component
- [x] Display repository name and path
- [x] Two action options:
  - Remove from registry only
  - Remove from registry and delete local files (with warning)
- [x] Cancel option
- [x] Clear visual distinction between destructive and non-destructive actions
- [x] Warning icon and red colors for delete option
- [x] Explicit warning message showing full path when delete is selected

### 4. Frontend - UI Updates
**File:** `src/renderer/pages/alexandria/AlexandriaRepositoryManager.tsx`

- [x] Add state for selected repository
- [x] Add remove button next to "Open Dashboard" button
- [x] Show button only when repository is selected
- [x] Handle remove button click to show confirmation dialog
- [x] Process removal based on user choice in dialog
- [x] Auto-refresh list after successful removal

**File:** `src/renderer/components/alexandria/AlexandriaRepositoryCard.tsx`

- [x] Add visual indication when repository is selected (blue border)
- [x] Pass selection state from parent component

### 5. Frontend - Service Layer Update
**File:** `src/renderer/main-process-api/AlexandriaService.ts`

- [x] Updated `removeRepository(name: string, deleteLocal?: boolean)` method
- [x] Calls window.mainProcess.alexandria.removeRepository()
- [x] Returns Promise<boolean> for success/failure

### 6. FileSystem Service Enhancement
**File:** `src/main/file-system-service.ts`

- [x] Added `deleteDirectory(dirPath: string)` method for safe directory deletion
- [x] Added `pathExists(path: string)` utility method
- [x] Handles ENOENT errors gracefully
- [x] Uses fs/promises for async operations

### 7. Safety Features
- [x] Confirmation dialog requires explicit action (radio button selection)
- [x] Show full path when "delete local files" is selected
- [x] Use red/warning colors for destructive action
- [x] Warning message with AlertTriangle icon for delete option
- [x] Log removal actions for debugging

### 8. Testing Requirements
- [ ] Test remove from registry only (files remain)
- [ ] Test remove with local deletion (files deleted)
- [ ] Test cancellation flow
- [ ] Test error handling (permission issues, missing files)
- [ ] Test UI updates after removal
- [ ] Test with multiple repositories

## API Changes

### AlexandriaAPI Interface Update
```typescript
removeRepository(name: string, deleteLocal?: boolean): Promise<boolean>
```

### Event Flow
1. User clicks remove button
2. Confirmation dialog appears
3. User selects removal type
4. Frontend calls AlexandriaService.removeRepository()
5. IPC message sent to main process
6. Main process executes removal
7. Repository removed event broadcasted
8. UI updates automatically via existing subscription

## UI/UX Considerations

### Remove Button Placement
- Position next to "Open Dashboard" button
- Only visible when repository is selected
- Use trash icon or "Remove" text
- Appropriate spacing to prevent accidental clicks

### Confirmation Dialog Design
```
┌─────────────────────────────────────┐
│  Remove Repository                  │
├─────────────────────────────────────┤
│  Repository: [repo-name]            │
│  Path: [/full/path/to/repo]         │
│                                     │
│  Choose removal option:             │
│                                     │
│  ○ Remove from registry only        │
│    (Local files will be kept)       │
│                                     │
│  ○ Delete local files too           │
│    ⚠️ This cannot be undone!         │
│                                     │
│  [Cancel]  [Remove]                 │
└─────────────────────────────────────┘
```

## Error Handling

### Possible Errors
1. Repository not found in registry
2. Insufficient permissions to delete files
3. Files in use/locked
4. Network issues (if remote operations involved)

### Error Messages
- "Repository not found in registry"
- "Failed to delete local files: [specific error]"
- "Some files could not be deleted. Please check permissions."

## Dependencies

### External Libraries
- Check if AlexandriaOutpostManager from `@principal-ai/alexandria-core-library` supports removal
- May need to use Node.js `fs` module for file deletion
- May need `rimraf` or similar for recursive directory deletion

### Internal Dependencies
- Existing Alexandria service infrastructure
- IPC communication system
- Event subscription system

## Implementation Order
1. Check AlexandriaOutpostManager capabilities
2. Implement backend removal logic
3. Add IPC handlers
4. Create confirmation dialog
5. Update UI with remove button
6. Connect all components
7. Test thoroughly

## Notes
- Consider adding "undo" functionality for registry removal
- May want to add "archive" option instead of delete
- Consider backing up Alexandria configuration before deletion
- Add telemetry/logging for removal actions

## Status: Implementation Complete - Ready for Testing
Started: 2025-09-20
Last Updated: 2025-09-20

## Summary of Implementation

### ✅ Completed Features

1. **Backend Infrastructure**
   - FileSystemService enhanced with `deleteDirectory()` method
   - AlexandriaRegistryService `removeRepository()` implemented with optional local deletion
   - IPC handlers updated to support deletion flag
   - API interfaces updated throughout the stack

2. **Frontend Components**
   - RemoveRepositoryDialog with clear UX for two removal options
   - Visual warnings and confirmation for destructive actions
   - Selected repository state management
   - Remove button appears only when repository is selected

3. **Safety Measures**
   - Radio button selection prevents accidental deletion
   - Clear visual distinction with warning colors
   - Full path displayed when delete option is selected
   - Graceful error handling at all levels

### 🎯 Ready for Testing

The feature is fully implemented and ready for testing. Users can now:
1. Select a repository from the list (visual indicator shows selection)
2. Click the "Remove" button that appears in the header
3. Choose between removing from registry only or deleting local files
4. Confirm the action with clear understanding of consequences