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

## Current Status (Updated - 2026-02-14)

**Total unused files: 61** ⬇️ **-15 from previous (was 76)** ✅

### By Top-Level Directory

| Directory | Unused Files | Change |
|-----------|--------------|--------|
| renderer | 33 | ⬆️ **+1** |
| shared | 16 | - |
| main | 13 | ⬇️ **-2** ✅ |
| window | 3 | ⬇️ **-3** ✅ |
| terminal-worker | 3 | - |
| titlebar | 2 | - |
| setupTests.js | 1 | - |
| event-processing-server | ✅ Clean | - |

### Renderer Breakdown

| Subdirectory | Unused Files | Change |
|--------------|--------------|--------|
| main-process-api | 11 | - |
| utils | 10 | - |
| services | 4 | - |
| principal-window | 2 | - |
| extension-window | 1 | 🆕 **New** |
| dev-workspace | 1 | - |
| hooks | 1 | - |
| contexts | 1 | - |
| pages | 1 | 🆕 **New** 🚨 |
| styles | 1 | - |
| global.d.ts | 1 | - |
| components | ✅ Clean | - |
| panels | ✅ Clean | - |
| types | ✅ Clean | - |
| adapters | ✅ Clean | - |
| config | ✅ Clean | - |
| repo-manager | ✅ Removed | Directory removed |

## Detailed File Lists

### renderer/components (0 files) ✅

**Status:** ✅ Clean

**Notes:**
- `DeleteWorkspaceConfirmationModal.tsx` was wired up to WorkspacesView (2025-12-27)
- `SaveWorkspaceModal.tsx` deleted as unused (2025-12-27)

---

### renderer/pages (1 file) 🆕

```
src/renderer/pages/CallimachusWindow/index.tsx
```

**Status:** ⏳ Pending review

**Notes:**
- New unused file detected (2026-02-14)
- Callimachus window - may be legacy or work-in-progress

---

### renderer/principal-window (2 files)

```
src/renderer/principal-window/views/SkillBrowserView/GlobalDirectoriesConfig.tsx
src/renderer/principal-window/views/SkillBrowserView/PendingChangesPanel.tsx
```

**Status:** ⏳ Pending review

**Notes:**
- New unused files detected in SkillBrowserView (2026-01-26)
- Related to skills feature - may be work-in-progress

---

### renderer/contexts (1 file)

```
src/renderer/contexts/UserCollectionsContext.tsx
```

**Status:** ⏳ Pending review

**Notes:**
- Regressed from clean status (2026-01-26)
- New unused context file detected

---

### renderer/hooks (1 file)

```
src/renderer/hooks/useSkillsPendingChanges.ts
```

**Status:** ⏳ Pending review

**Notes:**
- Regressed from clean status (2026-01-26)
- Related to skills feature

---

### renderer/styles (1 file)

```
src/renderer/styles/mdx-editor.ts
```

**Status:** ⏳ Pending review

**Notes:**
- New unused styles file detected (2026-01-26)

---

### renderer/extension-window (1 file) 🆕

```
src/renderer/extension-window/global.d.ts
```

**Status:** ⏳ Pending review

**Notes:**
- New unused file detected (2026-02-14)
- Global type definitions - may be needed for TypeScript

---

### renderer/services (4 files)

```
src/renderer/services/CloneVisibilityService.ts
src/renderer/services/SourceSelectionService.ts
src/renderer/services/storage/CustomLayersStorageService.ts
src/renderer/services/WorkspaceLayoutService.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `RepositoryDataCache.ts` deleted as unused (2026-01-29)
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

### renderer/other (1 file)

```
src/renderer/global.d.ts
src/renderer/dev-workspace/global.d.ts
```

**Status:** ⏳ Pending review (global.d.ts files may be needed for TypeScript)

---

## Main Process Unused Files (13 files)

```
src/main/quality-lenses/PackageLayerToToolConfigBridge.ts
src/main/services/FastForwardIPC.ts
src/main/services/GitSyncIPC.ts
src/main/services/OrbitIPC.ts
src/main/services/PresenceIPC.ts
src/main/services/SecureTokenIPC.ts
src/main/services/store/types/index.ts
src/main/services/store/types/session.types.ts
src/main/skills/skillUpdateService.ts
src/main/terminal/TerminalAuthorizationService.ts
src/main/window/callimachusWindow.ts
src/main/window/windowDefaults.ts
src/main/window/windowTypes.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `services/store/types/*` - May be imported dynamically or needed for type definitions
- `services/*IPC.ts` - 5 IPC files detected as unused (FastForward, GitSync, Orbit, Presence, SecureToken)
- `FastForwardIPC.ts` - 🆕 New unused file detected (2026-01-26)
- `TerminalAuthorizationService.ts` - 🆕 New unused file detected (2026-01-26)
- `skills/skillUpdateService.ts` - 🆕 New unused file detected (2026-02-14)
- `terminal/phase2-future/worker/*` - No longer detected as unused ✅ (2026-02-14)
- `system/clipboardHandler.ts` - No longer detected as unused ✅

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

## Titlebar Unused Files (2 files)

```
src/titlebar/index.js
src/titlebar/index.tsx
```

**Status:** ⏳ Pending review

**Notes:**
- Appears to have duplicate JS/TSX files - may need cleanup
- Could be entry points not configured in knip.json
- `RemoteAgentTitlebar.js` and `RemoteAgentTitlebar.tsx` no longer detected as unused ✅ (2026-01-26)

---

## Window Unused Files (3 files)

```
src/window/main-process-api-implementations/extensionApi.ts
src/window/preload-dev-workspace.ts
src/window/preload-extension-window.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `preload-*.ts` files are likely preload script entry points
- May need to be added to knip.json entry points
- `preload-remote-terminal-viewer.ts` - No longer detected as unused ✅ (2026-02-14)
- `preload-quick-open.ts` - No longer detected as unused ✅ (2026-02-14)
- `preload-window-switcher.ts` - No longer detected as unused ✅ (2026-02-14)

---

## Terminal Worker Unused Files (3 files)

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
| 2026-02-14 | 0 | Status update - major improvement! window improved (-3), main improved (-2), renderer +1 |
| 2026-01-26 | 0 | Status update - renderer regressed +5, new skills-related files detected |
| 2025-12-27 | 0 | Status update - terminal-worker detected, window preloads increased |
| 2025-12-16 | 0 | Status update - 4 new IPC files detected as unused in main |
| 2025-12-14 | 4 | Removed AnimatedTimelineEvent, markdown/index, TitlebarOpenInIDE, WorkspaceSelector |
| 2025-12-14 | ~41 | Major cleanup - many renderer subdirectories now clean |
| 2025-11-28 | 2 | Removed `MetricBox.tsx`, `RightPaneContainer.tsx` from renderer/components |
| 2025-11-28 | 2 | Removed `src/event-processing-server/types/` directory (duplicate of `types.ts`) |
| 2025-11-28 | 0 | Initial audit |

### 2026-02-14 Summary

**Total:** 76 → 61 files (-15, -19.7% decrease) ✅

**New unused files detected:**
- `src/renderer/pages/CallimachusWindow/index.tsx`
- `src/renderer/extension-window/global.d.ts`
- `src/main/skills/skillUpdateService.ts`

**Files no longer detected as unused:**
- `src/main/terminal/phase2-future/worker/ptyWorker.ts` ✅
- `src/main/terminal/phase2-future/worker/types.ts` ✅
- `src/main/terminal/phase2-future/worker/WorkerManager.ts` ✅
- `src/window/preload-quick-open.ts` ✅
- `src/window/preload-window-switcher.ts` ✅
- `src/window/preload-remote-terminal-viewer.ts` ✅

**Directory changes:**
- **renderer**: 32 → 33 (+1) - slight regression
  - **pages**: 0 → 1 (new unused file)
  - **extension-window**: 0 → 1 (new category)
- **main**: 15 → 13 (-2) ✅
  - **terminal/phase2-future/worker**: 3 → 0 (all files now in use!)
  - **skills**: 0 → 1 (new unused file)
- **window**: 6 → 3 (-3) ✅
  - All preload scripts now in use!
- **titlebar**: 2 (no change)

**Notes:**
- **Major improvement overall**: 15 fewer unused files (-19.7%)
- **window directory major cleanup**: All 3 preload scripts now in use
- **main/terminal/phase2-future/worker**: All 3 worker files now in use - phase2 implementation is active!
- **Slight renderer regression**: +1 file (CallimachusWindow/index.tsx, extension-window global.d.ts)
- **main/skills**: New unused skillUpdateService.ts detected
- This is the largest improvement since the 2025-12-14 major cleanup

---

### 2026-01-26 Summary

**Total:** 71 → 76 files (+5, +7% increase) 🚨

**New unused files detected:**
- `src/renderer/principal-window/views/SkillBrowserView/GlobalDirectoriesConfig.tsx`
- `src/renderer/principal-window/views/SkillBrowserView/PendingChangesPanel.tsx`
- `src/renderer/contexts/UserCollectionsContext.tsx`
- `src/renderer/hooks/useSkillsPendingChanges.ts`
- `src/renderer/styles/mdx-editor.ts`
- `src/main/services/FastForwardIPC.ts`
- `src/main/terminal/TerminalAuthorizationService.ts`
- `src/window/preload-remote-terminal-viewer.ts`

**Files no longer detected as unused:**
- `src/main/system/clipboardHandler.ts` ✅
- `src/titlebar/RemoteAgentTitlebar.js` ✅
- `src/titlebar/RemoteAgentTitlebar.tsx` ✅

**Directory changes:**
- **renderer**: 28 → 33 (+5) 🚨
  - **principal-window**: 0 → 2 (new unused files)
  - **contexts**: 0 → 1 (regressed from clean)
  - **hooks**: 0 → 1 (regressed from clean)
  - **styles**: 0 → 1 (new category)
- **main**: 14 → 15 (+1)
- **window**: 5 → 6 (+1)
- **titlebar**: 4 → 2 (-2) ✅

**Notes:**
- Major regression in renderer (+5 files) - several skills-related components now unused
- Three directories regressed from clean status (principal-window, contexts, hooks)
- Skills feature appears to have unused components (SkillBrowserView files, useSkillsPendingChanges)
- Titlebar improved with RemoteAgentTitlebar files now in use
- New IPC service detected as unused (FastForwardIPC)

---

### 2025-12-27 Summary

**Total:** 70 → 71 files (+1, +1.4% increase)

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

---
