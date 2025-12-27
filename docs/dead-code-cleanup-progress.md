# Dead Code Cleanup Progress

This document tracks potentially unused files identified by knip for review and cleanup.

## Tracking Commands

```bash
# Total unused files
npx knip --files 2>&1 | wc -l

# Unused files by top-level directory
npx knip --files 2>&1 | grep "^src/" | cut -d'/' -f2 | sort | uniq -c | sort -nr

# Unused renderer files by subdirectory
npx knip --files 2>&1 | grep "^src/renderer/" | cut -d'/' -f3 | sort | uniq -c | sort -nr

# List all unused files
npx knip --files

# List unused files in a specific directory
npx knip --files 2>&1 | grep "^src/renderer/components/"
```

## Current Status (Updated - 2025-12-27)

**Total unused files: 71** ⬆️ **+1 from previous (was 70)**

### By Top-Level Directory

| Directory | Unused Files | Change |
|-----------|--------------|--------|
| renderer | 28 | ⬇️ **-4** (1 wired up, 3 deleted) |
| shared | 16 | ⬆️ **+1** |
| main | 14 | ⬇️ **-1** |
| window | 5 | ⬆️ **+2** |
| titlebar | 4 | - |
| terminal-worker | 3 | 🆕 (new) |
| setupTests.js | 1 | - |
| event-processing-server | ✅ Clean | - |

### Renderer Breakdown

| Subdirectory | Unused Files | Change |
|--------------|--------------|--------|
| main-process-api | 11 | - |
| utils | 10 | - |
| services | 5 | ⬇️ **-2** (deleted) |
| global.d.ts | 1 | - |
| dev-workspace | 1 | - |
| components | ✅ Clean | ⬇️ **-2** 🎉 |
| hooks | ✅ Clean | - |
| panels | ✅ Clean | - |
| types | ✅ Clean | - |
| contexts | ✅ Clean | - |
| adapters | ✅ Clean | - |
| pages | ✅ Clean | - |
| config | ✅ Clean | - |
| repo-manager | ✅ Removed | Directory removed |

## Detailed File Lists

### renderer/components (0 files) ✅

**Status:** ✅ Clean

**Notes:**
- `DeleteWorkspaceConfirmationModal.tsx` was wired up to WorkspacesView (2025-12-27)
- `SaveWorkspaceModal.tsx` deleted as unused (2025-12-27)

---

### renderer/services (5 files)

```
src/renderer/services/CloneVisibilityService.ts
src/renderer/services/RepositoryDataCache.ts
src/renderer/services/SourceSelectionService.ts
src/renderer/services/storage/CustomLayersStorageService.ts
src/renderer/services/WorkspaceLayoutService.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `ContentProviders.ts` deleted as unused (2025-12-27)
- `GitignoreAnalysisService.ts` deleted as unused (2025-12-27)

---

### renderer/main-process-api (11 files)

```
src/renderer/main-process-api/ActRunnerService.ts
src/renderer/main-process-api/ActWorkflowService.ts
src/renderer/main-process-api/ApiProxyService.ts
src/renderer/main-process-api/ClipboardService.ts
src/renderer/main-process-api/DockerService.ts
src/renderer/main-process-api/LinksService.ts
src/renderer/main-process-api/PackageManagerService.ts
src/renderer/main-process-api/PrincipalService.ts
src/renderer/main-process-api/SecretsService.ts
src/renderer/main-process-api/TypeExtractionService.ts
src/renderer/main-process-api/TypeSchemaService.ts
```

**Status:** ⏳ Pending review

---

### renderer/utils (10 files)

```
src/renderer/utils/devComponentHelper.ts
src/renderer/utils/docsThemeValidator.ts
src/renderer/utils/EventEmitter.ts
src/renderer/utils/licenseUtils.ts
src/renderer/utils/loadManifestContents.ts
src/renderer/utils/monacoErrorSuppressor.ts
src/renderer/utils/sessionCollisionDetector.ts
src/renderer/utils/sessionPathNormalization.ts
src/renderer/utils/toolVisualizationConfig.ts
src/renderer/utils/workflowParser.ts
```

**Status:** ⏳ Pending review

---

### renderer/other (2 files)

```
src/renderer/global.d.ts
src/renderer/dev-workspace/global.d.ts
```

**Status:** ⏳ Pending review (global.d.ts files may be needed for TypeScript)

---

## Main Process Unused Files (14 files)

```
src/main/quality-lenses/PackageLayerToToolConfigBridge.ts
src/main/services/GitSyncIPC.ts
src/main/services/OrbitIPC.ts
src/main/services/PresenceIPC.ts
src/main/services/SecureTokenIPC.ts
src/main/services/store/types/index.ts
src/main/services/store/types/session.types.ts
src/main/system/clipboardHandler.ts
src/main/terminal/phase2-future/worker/ptyWorker.ts
src/main/terminal/phase2-future/worker/types.ts
src/main/terminal/phase2-future/worker/WorkerManager.ts
src/main/window/callimachusWindow.ts
src/main/window/windowDefaults.ts
src/main/window/windowTypes.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `terminal/phase2-future/*` - WIP worker implementation, keep for now
- `services/store/types/*` - May be imported dynamically or needed for type definitions
- `services/*IPC.ts` - 4 IPC files detected as unused (GitSync, Orbit, Presence, SecureToken)
- `version-control-providers/GitService.ts` - No longer detected as unused ⬇️ **-1**

---

## Shared Unused Files (16 files)

```
src/shared/configs/gitignorePatterns.ts
src/shared/configs/index.ts
src/shared/configs/types.ts
src/shared/git/githubTokenAuth.ts
src/shared/ipc-events/CallimachusEvents.ts
src/shared/ipc-events/MonitoringEvents.ts
src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts
src/shared/repository-core/FileSystemCore.ts
src/shared/repository-core/index.ts
src/shared/sessionTypes.ts
src/shared/types/alexandria.types.ts
src/shared/types/devServer.types.ts
src/shared/types/docsTheme.types.ts
src/shared/types/document-discovery.types.ts
src/shared/types/git.types.ts
src/shared/utils/githubUrlParser.ts
```

**Status:** ⏳ Pending review

**Notes:**
- Many of these may be type definitions imported elsewhere
- `ipc-events/*` - IPC event definitions that may be used at runtime
- `types/git.types.ts` - 🆕 New unused file detected

---

## Titlebar Unused Files (4 files) 🆕

```
src/titlebar/index.js
src/titlebar/index.tsx
src/titlebar/RemoteAgentTitlebar.js
src/titlebar/RemoteAgentTitlebar.tsx
```

**Status:** ⏳ Pending review

**Notes:**
- Appears to have duplicate JS/TSX files - may need cleanup
- Could be entry points not configured in knip.json

---

## Window Unused Files (5 files)

```
src/window/main-process-api-implementations/extensionApi.ts
src/window/preload-dev-workspace.ts
src/window/preload-extension-window.ts
src/window/preload-quick-open.ts
src/window/preload-window-switcher.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `preload-*.ts` files are likely preload script entry points
- May need to be added to knip.json entry points
- `preload-quick-open.ts` - 🆕 New unused file detected
- `preload-window-switcher.ts` - 🆕 New unused file detected

---

## Terminal Worker Unused Files (3 files) 🆕

```
src/terminal-worker/types.ts
src/terminal-worker/worker-entry.js
src/terminal-worker/worker-entry.ts
```

**Status:** ⏳ Pending review

**Notes:**
- Worker entry points may need to be added to knip.json
- Duplicate JS/TS files - may need cleanup

---

## Other Unused Files (1 file)

```
src/setupTests.js
```

**Status:** ⏳ Pending review - May be Jest setup file

---

## Event Processing Server

**Status:** ✅ Clean

Entry points added to knip.json. Removed duplicate `types/` directory (unused - imports use `types.ts` instead).

---

## Review Guidelines

When reviewing files for removal:

1. **Check for dynamic imports** - Some files may be loaded dynamically
2. **Check for IPC usage** - Services may be called via IPC from main process
3. **Check git history** - Recently added files might be work-in-progress
4. **Check for comments** - Files marked TODO or WIP should be kept
5. **Verify with grep** - Search for the exported names across the codebase

### Commands for verification

```bash
# Search for usage of a specific export
grep -r "ExportedName" src/

# Check git history for a file
git log --oneline -10 -- path/to/file.ts

# Check if file is imported anywhere
grep -r "from.*filename" src/
```

## Cleanup Progress

| Date | Files Removed | Notes |
|------|---------------|-------|
| 2025-12-27 | 0 | Status update - terminal-worker detected, window preloads increased |
| 2025-12-16 | 0 | Status update - 4 new IPC files detected as unused in main |
| 2025-12-14 | 4 | Removed AnimatedTimelineEvent, markdown/index, TitlebarOpenInIDE, WorkspaceSelector |
| 2025-12-14 | ~41 | Major cleanup - many renderer subdirectories now clean |
| 2025-11-28 | 2 | Removed `MetricBox.tsx`, `RightPaneContainer.tsx` from renderer/components |
| 2025-11-28 | 2 | Removed `src/event-processing-server/types/` directory (duplicate of `types.ts`) |
| 2025-11-28 | 0 | Initial audit |

### 2025-12-27 Summary

**Total:** 70 → 75 files (+5, +7% increase)

**New unused files detected:**
- `src/terminal-worker/types.ts` (new directory)
- `src/terminal-worker/worker-entry.js` (new directory)
- `src/terminal-worker/worker-entry.ts` (new directory)
- `src/window/preload-quick-open.ts`
- `src/window/preload-window-switcher.ts`
- `src/shared/types/git.types.ts`

**Files no longer detected as unused:**
- `src/main/version-control-providers/GitService.ts` (-1)

**Notes:**
- terminal-worker directory now tracked (3 files) - likely entry points not in knip config
- window preload scripts increased (+2) - likely entry points not in knip config
- shared types increased (+1) - git.types.ts now detected
- main decreased (-1) - GitService.ts now in use
- renderer unchanged (32 files)

---

### 2025-12-16 Summary

**Total:** 68 → 70 files (+2, +3% increase)

**New unused files detected in main:**
- `src/main/services/GitSyncIPC.ts`
- `src/main/services/OrbitIPC.ts`
- `src/main/services/PresenceIPC.ts`
- `src/main/services/SecureTokenIPC.ts`

**Notes:**
- These 4 IPC service files are now detected as unused
- May indicate these features are disabled or not currently in use
- All other directories unchanged

---

### 2025-12-14 Summary

**Total:** 113 → 68 files (-45, -40% reduction)

**Cleaned renderer subdirectories:**
- hooks (5 files removed)
- panels (3 files removed - moved to external package)
- types (2 files removed)
- contexts (2 files removed)
- adapters (2 files removed)
- pages (1 file removed)
- config (1 file removed)
- repo-manager (5 files - directory removed entirely)

**New categories identified:**
- shared: 15 files (newly detected by knip)
- titlebar: 4 files (entry points may need knip config)
- window: 3 files (preload scripts may need knip config)

