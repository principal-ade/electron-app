# Unused Renderer Components for Review

This document groups renderer components located in `src/renderer/components` that are not imported by `src/renderer/pages`, `src/renderer/principal-window`, or `src/renderer/repo-manager`.

## Collaboration & Notification Widgets
- `AgentUpdateNotifications.tsx`
- `AuthStatusIndicator.tsx`
- `CollaborationPanel.tsx`
- `CollaborationPanelWithSync.tsx`

## Developer & Utility Components
- `DiagramWorkspace.tsx`
- `DiffViewer.tsx`
- `SDKServiceDebug.tsx`
- `MonacoEditorErrorBoundary.tsx`
- `withComponentTracking.tsx`

## Modal & Overlay Components
- `FeedbackModal.tsx`

## Feature Directories Without Current Consumers

### `GitChanges/`
- `GitChangesDropdown.tsx`

### `agent-session-debug/` ✅ **DELETED (2025-10-06)**
- ~~`AgentSessionCollisionIndicator.tsx`~~

### `configuration/`
- `IDEConfigurationView.tsx`
- `TerminalConfigurationView.tsx`

### `dialogs/` ✅ **DELETED (2025-10-06)**
- ~~`RemoveRepositoryDialog.tsx`~~ (Note: A different version exists in principal-window and is actively used)

### `session-history/` ✅ **DELETED (2025-10-06)**
- ~~`EventHistoryModal.tsx`~~

### `settings/`
- `UpdateSettings.tsx`

### `agent-overview/`
- `ActiveSegmentTimeline.tsx`
- `CommitPreview.tsx`
- `FileActivityView.tsx`
- `SegmentSummary.tsx`
- `SessionDetailCards.tsx`
- `SessionSummaryOverlay/utils.ts`
- `ToolUseView.tsx`
- `timelineHelpers.tsx`

### `quality/`
- `QualityHexagonPanel.tsx`
- `index.ts`

### `landing-page/`
- `AnimatedTimelineEvent.tsx`

### `icons/` ✅ **DELETED (2025-10-06)**
- ~~`AppLogo.tsx`~~
- ~~`CanvasOwlIcon.tsx`~~
- ~~`LayeredOwlIcon.tsx`~~
- ~~`ThemedOwlIcon.tsx`~~

### `alexandria/` ✅ **DELETED (2025-10-06)**
- ~~`AlexandriaRepositoryCard.tsx`~~
- ~~`AlexandriaRepositoryList.tsx`~~

### `system/` ✅ **DELETED (2025-10-06)**
- ~~`DiskSpaceWidget.tsx`~~
- ~~`MemoryWidget.tsx`~~
- ~~`SystemResourceWidget.tsx`~~
- ~~`index.ts`~~

### `layers/` ✅ **DELETED (2025-10-06)**
- ~~`CategoriesView.tsx`~~
- ~~`DependenciesView.tsx`~~
- ~~`EmptyState.tsx`~~
- ~~`FileView.tsx`~~
- ~~`LoadingState.tsx`~~
- ~~`README.md`~~
- ~~`badges/FrameworkBadge.tsx`~~
- ~~`badges/PackageManagerBadge.tsx`~~
- ~~`badges/PythonVersionBadge.tsx`~~
- ~~`badges/StatusBadge.tsx`~~
- ~~`badges/TypeScriptBadge.tsx`~~
- ~~`badges/index.ts`~~
- ~~`index.ts`~~

## Cleanup Summary (2025-10-06)

**Deleted directories:**
1. `layers/` - 13 files (5 components + 5 badges + 3 support files)
2. `icons/` - 4 files (AppLogo + 3 Owl icon variants)
3. `alexandria/` - 2 files (repository card components)
4. `system/` - 4 files (3 resource widgets + index)
5. `dialogs/` - 1 file (RemoveRepositoryDialog - duplicate, unused version)
6. `session-history/` - 1 file (EventHistoryModal)
7. `agent-session-debug/` - 1 file (AgentSessionCollisionIndicator)

**Total cleanup impact:**
- Files removed: 26 files across 7 directories
- ESLint issues: 1536 → 1502 (↓34 issues, 2.2% reduction)
- TypeScript errors: 276 → 274 (↓2 errors, 0.7% reduction)
