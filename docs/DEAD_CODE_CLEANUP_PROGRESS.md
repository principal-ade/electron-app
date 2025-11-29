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

## Current Status (Updated - 2025-11-28)

**Total unused files: 113**

### By Top-Level Directory

| Directory | Unused Files |
|-----------|--------------|
| renderer | 82 |
| main | 11 |
| event-processing-server | ✅ Clean |

### Renderer Breakdown

| Subdirectory | Unused Files | Status |
|--------------|--------------|--------|
| components | 21 | ⏳ Pending review |
| services | 14 | ⏳ Pending review |
| main-process-api | 11 | ⏳ Pending review |
| utils | 10 | ⏳ Pending review |
| repo-manager | 5 | ⏳ Pending review |
| hooks | 5 | ⏳ Pending review |
| panels | 3 | ⏳ Pending review |
| pages | 1 | ⏳ Pending review |
| types | 2 | ⏳ Pending review |
| contexts | 2 | ⏳ Pending review |
| adapters | 2 | ⏳ Pending review |
| unused | 1 | ⏳ Pending review |
| global.d.ts | 1 | ⏳ Pending review |
| dev-workspace | 1 | ⏳ Pending review |
| config | 1 | ⏳ Pending review |

## Detailed File Lists

### renderer/components (21 files)

```
src/renderer/components/agent-overview/FileActivityView.tsx
src/renderer/components/agent-overview/SegmentSummary.tsx
src/renderer/components/agent-overview/SessionDetailCards.tsx
src/renderer/components/agent-overview/SessionSummaryOverlay/utils.ts
src/renderer/components/agent-overview/ToolUseView.tsx
src/renderer/components/common/Icons.tsx
src/renderer/components/common/LicenseBadge.tsx
src/renderer/components/common/Tooltip.tsx
src/renderer/components/landing-page/AnimatedTimelineEvent.tsx
src/renderer/components/markdown/index.ts
src/renderer/components/MonacoEditorErrorBoundary.tsx
src/renderer/components/OAuthCallbackModal.tsx
src/renderer/components/repository-maps/AgentSessionDetailView.tsx
src/renderer/components/repository-maps/EmptyState.tsx
src/renderer/components/repository-maps/GitChangesHelpModal.tsx
src/renderer/components/repository-maps/HeaderSearchBar.tsx
src/renderer/components/repository-maps/ImageCropper.tsx
src/renderer/components/repository-maps/LoadingAnimation.tsx
src/renderer/components/repository-maps/SessionEventsView.tsx
src/renderer/components/shared/RepositoryNotesPanel.tsx
src/renderer/components/withComponentTracking.tsx
```

**Status:** ⏳ Pending review

---

### renderer/services (14 files)

```
src/renderer/services/CityDataCacheService.ts
src/renderer/services/EventSegmenterService.ts
src/renderer/services/FileTypeLayerService.ts
src/renderer/services/GitignoreAnalysisService.ts
src/renderer/services/MockQualityMetricsService.ts
src/renderer/services/NavigationService.ts
src/renderer/services/p2p/GitSyncManager.ts
src/renderer/services/p2p/PeerManager.ts
src/renderer/services/p2p/SignalingClient.ts
src/renderer/services/p2p/SignalingClientHTTP.ts
src/renderer/services/RepositoryTreeCacheService.ts
src/renderer/services/sessionContextFormatterService.ts
src/renderer/services/sessionContextService.ts
src/renderer/services/storage/CustomLayersStorageService.ts
```

**Status:** ⏳ Pending review

---

### renderer/main-process-api (11 files)

```
src/renderer/main-process-api/A24zService.ts
src/renderer/main-process-api/ActRunnerService.ts
src/renderer/main-process-api/ActWorkflowService.ts
src/renderer/main-process-api/ApiProxyService.ts
src/renderer/main-process-api/ClipboardService.ts
src/renderer/main-process-api/DockerService.ts
src/renderer/main-process-api/LLMModelsService.ts
src/renderer/main-process-api/OrbitService.ts
src/renderer/main-process-api/PrincipalService.ts
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
src/renderer/utils/monacoErrorSuppressor.ts
src/renderer/utils/sessionCollisionDetector.ts
src/renderer/utils/sessionPathNormalization.ts
src/renderer/utils/terminalCleanup.ts
src/renderer/utils/terminalUtils.ts
src/renderer/utils/toolVisualizationConfig.ts
```

**Status:** ⏳ Pending review

---

### renderer/repo-manager (5 files)

```
src/renderer/repo-manager/components/RepositoryLoadingState.tsx
src/renderer/repo-manager/shared/MarkdownSearchPanel.tsx
src/renderer/repo-manager/shared/ProcessingDetailsModal.tsx
src/renderer/repo-manager/shared/RepositorySwitcherModal.tsx
src/renderer/repo-manager/shared/TerminalCleanupButton.tsx
```

**Status:** ⏳ Pending review

---

### renderer/hooks (5 files)

```
src/renderer/hooks/useAgentSessions.ts
src/renderer/hooks/useFeedbackContextMenu.tsx
src/renderer/hooks/useGitHubDetection.ts
src/renderer/hooks/useSessionEventProcessor.ts
src/renderer/hooks/useToolUIEvents.ts
```

**Status:** ⏳ Pending review

---

### renderer/panels (3 files)

```
src/renderer/panels/components/RecentCommitsPanel.tsx
src/renderer/panels/components/RepositoryNotesPanel.tsx
src/renderer/panels/components/RepositoryTasksAndNotesPanel.tsx
```

**Status:** ⏳ Pending review

---

### renderer/pages (1 file)

```
src/renderer/pages/CustomTitlebar/CustomTitlebar.tsx
```

**Status:** ⏳ Pending review

---

### renderer/types (2 files)

```
src/renderer/types/file-activity.types.ts
src/renderer/types/sessionContext.ts
```

**Status:** ⏳ Pending review

---

### renderer/contexts (2 files)

```
src/renderer/contexts/RepositoryContext.tsx
src/renderer/contexts/VisibleProjectsContext.tsx
```

**Status:** ⏳ Pending review

---

### renderer/adapters (2 files)

```
src/renderer/adapters/SimpleGitHubConfigAdapter.ts
src/renderer/adapters/SourceFileSystemAdapter.ts
```

**Status:** ⏳ Pending review

---

### renderer/other (4 files)

```
src/renderer/unused/RepositorySettingsModal.tsx
src/renderer/global.d.ts
src/renderer/dev-workspace/global.d.ts
src/renderer/config/orbit.config.ts
```

**Status:** ⏳ Pending review

---

## Main Process Unused Files (11 files)

```
src/main/agent-management/ClaudeInstallationService.ts
src/main/agent-sessions/SessionEventProcessorBackend.ts
src/main/preload-git-sync.ts
src/main/quality-lenses/PackageLayerToToolConfigBridge.ts
src/main/services/ipc/auth/authHandlers.ts
src/main/system/clipboardHandler.ts
src/main/terminal/phase2-future/worker/ptyWorker.ts
src/main/terminal/phase2-future/worker/types.ts
src/main/terminal/phase2-future/worker/WorkerManager.ts
src/main/window/callimachusWindow.ts
src/main/window/windowDefaults.ts
```

**Status:** ⏳ Pending review

**Notes:**
- `terminal/phase2-future/*` - WIP worker implementation, keep for now
- `preload-git-sync.ts` - May be a preload script entry point

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
| 2025-11-28 | 2 | Removed `MetricBox.tsx`, `RightPaneContainer.tsx` from renderer/components |
| 2025-11-28 | 2 | Removed `src/event-processing-server/types/` directory (duplicate of `types.ts`) |
| 2025-11-28 | 0 | Initial audit |

