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
- `FileViewerModal.tsx`
- `GitCloneModal.tsx`
- `OAuthCallbackModal.tsx`
- `SessionDeleteConfirmDialog.tsx`
- `UpdateNotification.tsx`
- `PackageFilter.tsx`

## Feature Directories Without Current Consumers

### `GitChanges/`
- `GitChangesDropdown.tsx`

### `agent-session-debug/`
- `AgentSessionCollisionIndicator.tsx`

### `configuration/`
- `IDEConfigurationView.tsx`
- `TerminalConfigurationView.tsx`

### `dialogs/`
- `RemoveRepositoryDialog.tsx`

### `session-history/`
- `EventHistoryModal.tsx`

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

### `icons/`
- `AppLogo.tsx`
- `CanvasOwlIcon.tsx`
- `LayeredOwlIcon.tsx`
- `ThemedOwlIcon.tsx`

### `alexandria/`
- `AlexandriaRepositoryCard.tsx`
- `AlexandriaRepositoryList.tsx`

### `system/`
- `DiskSpaceWidget.tsx`
- `MemoryWidget.tsx`
- `SystemResourceWidget.tsx`
- `index.ts`

### `layers/`
- `CategoriesView.tsx`
- `DependenciesView.tsx`
- `EmptyState.tsx`
- `FileView.tsx`
- `LoadingState.tsx`
- `README.md`
- `badges/FrameworkBadge.tsx`
- `badges/PackageManagerBadge.tsx`
- `badges/PythonVersionBadge.tsx`
- `badges/StatusBadge.tsx`
- `badges/TypeScriptBadge.tsx`
- `badges/index.ts`
- `index.ts`
