# Unused Code Cleanup Tracker

Files identified by knip as unused. Grouped by feature area with risk assessment.

## Risk Levels
- **Low**: Safe to delete - clearly orphaned, no dynamic imports likely
- **Medium**: Verify before deleting - might have indirect usage or be needed soon
- **High**: Investigate first - could have dynamic imports or be foundational

---

## Group 1: Orbit/P2P Feature (Abandoned)
**Risk: Low** - Appears to be a fully abandoned P2P sync feature

| File | Status |
|------|--------|
| `src/renderer/services/p2p/GitSyncManager.ts` | ✅ Deleted |
| `src/renderer/services/p2p/OrbitSignalingBridge.ts` | ✅ Deleted |
| `src/renderer/services/p2p/PeerManager.ts` | ✅ Deleted |
| `src/renderer/config/orbit.config.ts` | ✅ Deleted |
| `src/renderer/main-process-api/OrbitService.ts` | ✅ Deleted |
| `src/main/preload-git-sync.ts` | ✅ Deleted |
| `src/renderer/config/git-sync.ts` | ✅ Deleted |

**Note:** Active git-sync feature uses separate files (`src/renderer/services/git-sync/`, `GitSyncWebSocketManager.ts`) and is unaffected.

---

## Group 2: Main Process API Services (Abandoned)
**Risk: Low** - Services with no consumers

| File | Status |
|------|--------|
| `src/renderer/main-process-api/ActRunnerService.ts` | Pending |
| `src/renderer/main-process-api/ActWorkflowService.ts` | Pending |
| `src/renderer/main-process-api/ApiProxyService.ts` | Pending |
| `src/renderer/main-process-api/ClipboardService.ts` | Pending |
| `src/renderer/main-process-api/DockerService.ts` | Pending |
| `src/renderer/main-process-api/LinksService.ts` | Pending |
| `src/renderer/main-process-api/LLMModelsService.ts` | Pending |
| `src/renderer/main-process-api/PackageManagerService.ts` | Pending |
| `src/renderer/main-process-api/PrincipalService.ts` | Pending |
| `src/renderer/main-process-api/SecretsService.ts` | Pending |
| `src/renderer/main-process-api/TypeExtractionService.ts` | Pending |
| `src/renderer/main-process-api/TypeSchemaService.ts` | Pending |

---

## Group 3: Terminal Phase 2 (Unfinished Feature)
**Risk: Low** - Clearly a future/experimental feature never completed

| File | Status |
|------|--------|
| `src/main/terminal/phase2-future/worker/ptyWorker.ts` | Pending |
| `src/main/terminal/phase2-future/worker/types.ts` | Pending |
| `src/main/terminal/phase2-future/worker/WorkerManager.ts` | Pending |

---

## Group 4: Renderer Services (Abandoned)
**Risk: Low** - Services with no consumers

| File | Status |
|------|--------|
| `src/renderer/services/CloneVisibilityService.ts` | Pending |
| `src/renderer/services/ContentProviders.ts` | Pending |
| `src/renderer/services/GitignoreAnalysisService.ts` | Pending |
| `src/renderer/services/RepositoryDataCache.ts` | ✅ Deleted (2026-01-29) |
| `src/renderer/services/SourceSelectionService.ts` | Pending |
| `src/renderer/services/storage/CustomLayersStorageService.ts` | Pending |
| `src/renderer/services/WorkspaceLayoutService.ts` | Pending |

---

## Group 5: Renderer Utils
**Risk: Low-Medium** - Utilities, verify no dynamic imports

| File | Status |
|------|--------|
| `src/renderer/utils/devComponentHelper.ts` | Pending |
| `src/renderer/utils/docsThemeValidator.ts` | Pending |
| `src/renderer/utils/EventEmitter.ts` | Pending |
| `src/renderer/utils/licenseUtils.ts` | Pending |
| `src/renderer/utils/loadManifestContents.ts` | Pending |
| `src/renderer/utils/monacoErrorSuppressor.ts` | Pending |
| `src/renderer/utils/sessionCollisionDetector.ts` | Pending |
| `src/renderer/utils/sessionPathNormalization.ts` | Pending |
| `src/renderer/utils/toolVisualizationConfig.ts` | Pending |
| `src/renderer/utils/workflowParser.ts` | Pending |

---

## Group 6: Window Management (Callimachus)
**Risk: Medium** - Window-related, verify not used dynamically

| File | Status |
|------|--------|
| `src/main/window/callimachusWindow.ts` | Pending |
| `src/main/window/windowDefaults.ts` | Pending |
| `src/main/window/windowTypes.ts` | Pending |
| `src/shared/ipc-events/CallimachusEvents.ts` | Pending |

---

## Group 7: Shared Types & Configs
**Risk: Medium** - Type files might be imported in ways knip misses

| File | Status |
|------|--------|
| `src/shared/configs/gitignorePatterns.ts` | Pending |
| `src/shared/configs/index.ts` | Pending |
| `src/shared/configs/types.ts` | Pending |
| `src/shared/types/alexandria.types.ts` | Pending |
| `src/shared/types/devServer.types.ts` | Pending |
| `src/shared/types/docsTheme.types.ts` | Pending |
| `src/shared/types/document-discovery.types.ts` | Pending |
| `src/shared/ipc-events/MonitoringEvents.ts` | Pending |
| `src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts` | Pending |
| `src/shared/repository-core/FileSystemCore.ts` | Pending |
| `src/shared/repository-core/index.ts` | Pending |
| `src/shared/git/githubTokenAuth.ts` | Pending |
| `src/shared/utils/githubUrlParser.ts` | Pending |

---

## Group 8: Miscellaneous
**Risk: Low-Medium**

| File | Status |
|------|--------|
| `src/main/quality-lenses/PackageLayerToToolConfigBridge.ts` | Pending |
| `src/main/system/clipboardHandler.ts` | Pending |
| `src/renderer/pages/CustomTitlebar/CustomTitlebar.tsx` | Pending |
| `src/renderer/panels/panelPreviews.tsx` | Pending |
| `src/renderer/panels/registry.tsx` | Pending |
| `src/renderer/dev-workspace/global.d.ts` | Pending |
| `src/renderer/global.d.ts` | Pending |
| `src/renderer/components/markdown/index.ts` | Pending |
| `src/renderer/components/landing-page/AnimatedTimelineEvent.tsx` | Pending |
| `src/setupTests.js` | Pending |
| `tests/fixtures/manifest-fixture.ts` | Pending |

---

## Already Deleted

| File | Date |
|------|------|
| `src/renderer/services/RepositoryDataCache.ts` | 2026-01-29 |
| `src/renderer/components/Titlebar/RepositoryTitlebar.tsx` | 2024-12-13 |
| `src/renderer/components/Titlebar/RepositoryTitlebarSimple.tsx` | 2024-12-13 |
| `src/renderer/components/FileTreeContextMenu.tsx` | 2024-12-13 |
| `src/renderer/components/GitChanges/GitChangesDropdown.tsx` | 2024-12-13 |
| `src/renderer/components/GitChangesContextMenu.tsx` | 2024-12-13 |
| `src/renderer/components/OAuthCallbackModal.tsx` | 2024-12-13 |
| `src/renderer/components/PanelEmptyState.tsx` | 2024-12-13 |
| `src/renderer/components/Titlebar/TitlebarGitChanges.tsx` | 2024-12-13 |
| `src/renderer/components/withComponentTracking.tsx` | 2024-12-13 |
| `src/renderer/components/MonacoEditorErrorBoundary.tsx` | 2024-12-13 |
| `src/renderer/services/p2p/GitSyncManager.ts` | 2024-12-13 |
| `src/renderer/services/p2p/OrbitSignalingBridge.ts` | 2024-12-13 |
| `src/renderer/services/p2p/PeerManager.ts` | 2024-12-13 |
| `src/renderer/config/orbit.config.ts` | 2024-12-13 |
| `src/renderer/main-process-api/OrbitService.ts` | 2024-12-13 |
| `src/main/preload-git-sync.ts` | 2024-12-13 |
| `src/renderer/config/git-sync.ts` | 2024-12-13 |

---

## Recommended Deletion Order

1. **Group 1 (Orbit/P2P)** - Complete abandoned feature, safe batch delete
2. **Group 3 (Terminal Phase 2)** - Clearly experimental, safe to remove
3. **Group 2 (Main Process API Services)** - Large cleanup, low risk
4. **Group 4 (Renderer Services)** - Abandoned services
5. **Group 5 (Utils)** - One by one, verify each
6. **Group 6-8** - Review individually
