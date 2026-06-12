# Unused Code Cleanup

Snapshot of files reported by `npx knip --files`.

**Last updated:** 2026-05-07
**Total unused files:** 89

## How to refresh

```bash
npx knip --files
```

## By top-level directory

| Directory          | Count |
| ------------------ | ----: |
| src/renderer       |    39 |
| src/main           |    14 |
| src/pty-daemon     |    14 |
| src/shared         |    14 |
| src/window         |     2 |
| src/titlebar       |     2 |
| src/terminal-worker |    2 |
| src/types          |     1 |
| src/setupTests.js  |     1 |

## Suggested triage order

1. **`src/pty-daemon/` (14)** — entire directory appears orphaned (both `.ts` and built `.js` siblings). Likely a whole feature that was extracted/replaced; verify against `src/main/terminal/PtyDaemonClient.ts` (also unused) before bulk-deleting.
2. **`src/titlebar/` (2) + `src/window/preload-*.ts` (2) + `src/renderer/{splash,goodbye}-screen/index.tsx`** — splash/goodbye/titlebar entry points. Check `electron-builder`/main-process `BrowserWindow` calls for dynamic refs first.
3. **`src/renderer/main-process-api/` (6)** — `Clipboard`, `Docker`, `Links`, `PackageManager`, `Principal`, `TypeExtraction`. Service shims with no consumers.
4. **`src/renderer/services/` (4)** — `CloneVisibility`, `DocumentSearch`, `SourceSelection`, `storage/CustomLayersStorage`.
5. **`src/main/services/*IPC.ts` (5)** — `FastForward`, `GitSync`, `Orbit`, `Presence`, `SecureToken`. IPC handlers wired up to nothing.
6. **`src/renderer/components/` modals (5)** — `AISummaryPanel`, `CreateWorkspaceModal`, `DeleteWorkspaceConfirmationModal`, `FileDeleteConfirmDialog`, `ThemedMonaco` + the `index.ts` barrels for `ActivityCities` and `OnboardingWizard`.
7. **`src/renderer/utils/` (9)** — review one-by-one; utils sometimes get dynamic-imported.
8. **`src/shared/types/` and `src/shared/configs/`** — type/config files knip can flag falsely; verify before delete.

## Full list

### src/pty-daemon (14)

- `src/pty-daemon/daemon.js`
- `src/pty-daemon/daemon.ts`
- `src/pty-daemon/DaemonSessionManager.js`
- `src/pty-daemon/DaemonSessionManager.ts`
- `src/pty-daemon/index.js`
- `src/pty-daemon/index.ts`
- `src/pty-daemon/Logger.js`
- `src/pty-daemon/Logger.ts`
- `src/pty-daemon/ScrollbackBuffer.js`
- `src/pty-daemon/ScrollbackBuffer.ts`
- `src/pty-daemon/SocketServer.js`
- `src/pty-daemon/SocketServer.ts`
- `src/pty-daemon/telemetry.js`
- `src/pty-daemon/telemetry.ts`

### src/main (14)

- `src/main/quality-lenses/PackageLayerToToolConfigBridge.ts`
- `src/main/services/AuthMethodDetector.ts`
- `src/main/services/FastForwardIPC.ts`
- `src/main/services/GitSyncIPC.ts`
- `src/main/services/OrbitIPC.ts`
- `src/main/services/PresenceIPC.ts`
- `src/main/services/SecureTokenIPC.ts`
- `src/main/services/store/types/index.ts`
- `src/main/services/store/types/session.types.ts`
- `src/main/skills/skillUpdateService.ts`
- `src/main/terminal/PtyDaemonClient.ts`
- `src/main/terminal/TerminalAuthorizationService.ts`
- `src/main/window/windowDefaults.ts`
- `src/main/window/windowTypes.ts`

### src/renderer/components (7)

- `src/renderer/components/ActivityCities/index.ts`
- `src/renderer/components/AISummaryPanel.tsx`
- `src/renderer/components/CreateWorkspaceModal.tsx`
- `src/renderer/components/DeleteWorkspaceConfirmationModal.tsx`
- `src/renderer/components/FileDeleteConfirmDialog.tsx`
- `src/renderer/components/OnboardingWizard/index.ts`
- `src/renderer/components/shared/ThemedMonaco.tsx`

### src/renderer/contexts, hooks, panels, principal-window (8)

- `src/renderer/contexts/GitSyncPanelContext.tsx`
- `src/renderer/hooks/useRemoteCommitHeatMap.ts`
- `src/renderer/hooks/useSkillsPendingChanges.ts`
- `src/renderer/hooks/useWatchedActivityFeed.ts`
- `src/renderer/principal-window/views/SkillBrowserView/GlobalDirectoriesConfig.tsx`
- `src/renderer/principal-window/views/SkillBrowserView/PendingChangesPanel.tsx`

### src/renderer/main-process-api (6)

- `src/renderer/main-process-api/ClipboardService.ts`
- `src/renderer/main-process-api/DockerService.ts`
- `src/renderer/main-process-api/LinksService.ts`
- `src/renderer/main-process-api/PackageManagerService.ts`
- `src/renderer/main-process-api/PrincipalService.ts`
- `src/renderer/main-process-api/TypeExtractionService.ts`

### src/renderer/services (4)

- `src/renderer/services/CloneVisibilityService.ts`
- `src/renderer/services/DocumentSearchService.ts`
- `src/renderer/services/SourceSelectionService.ts`
- `src/renderer/services/storage/CustomLayersStorageService.ts`

### src/renderer/utils (9)

- `src/renderer/utils/docsThemeValidator.ts`
- `src/renderer/utils/EventEmitter.ts`
- `src/renderer/utils/libraryResourcesLoader.ts`
- `src/renderer/utils/licenseUtils.ts`
- `src/renderer/utils/loadManifestContents.ts`
- `src/renderer/utils/sessionCollisionDetector.ts`
- `src/renderer/utils/sessionPathNormalization.ts`
- `src/renderer/utils/toolVisualizationConfig.ts`
- `src/renderer/utils/workflowParser.ts`

### src/renderer entry points & globals (5)

- `src/renderer/dev-workspace/global.d.ts`
- `src/renderer/extension-window/global.d.ts`
- `src/renderer/global.d.ts`
- `src/renderer/goodbye-screen/index.tsx`
- `src/renderer/splash-screen/index.tsx`

### src/shared (14)

- `src/shared/configs/gitignorePatterns.ts`
- `src/shared/configs/index.ts`
- `src/shared/configs/types.ts`
- `src/shared/git/githubTokenAuth.ts`
- `src/shared/ipc-events/MonitoringEvents.ts`
- `src/shared/pty-daemon/index.ts`
- `src/shared/repository-core/FileSystemCore.ts`
- `src/shared/repository-core/index.ts`
- `src/shared/sessionTypes.ts`
- `src/shared/types/alexandria.types.ts`
- `src/shared/types/devServer.types.ts`
- `src/shared/types/docsTheme.types.ts`
- `src/shared/types/document-discovery.types.ts`
- `src/shared/types/thread.types.ts`

### src/window, src/titlebar, src/terminal-worker, misc (8)

- `src/window/preload-goodbye-screen.ts`
- `src/window/preload-splash-screen.ts`
- `src/titlebar/index.js`
- `src/titlebar/index.tsx`
- `src/terminal-worker/types.ts`
- `src/terminal-worker/worker-entry.js`
- `src/types/usebruno-requests.d.ts`
- `src/setupTests.js`

## Notes / known false positives

- `activeFile` slice looks dead but is required by third-party `@industry-theme` panels' context type — see memory `project_active_file_slice_orphaned`. Keep this in mind for any slice/type that knip flags but is referenced via external typings.
- `.d.ts` global declaration files (`global.d.ts`, `*.d.ts`) often appear unused even when picked up by `tsconfig` includes. Verify before deletion.
- Files that look like window entry points (`splash-screen`, `goodbye-screen`, `titlebar`, preload scripts) may be loaded by `BrowserWindow.loadFile` / `loadURL` at runtime — grep the main process before deleting.
