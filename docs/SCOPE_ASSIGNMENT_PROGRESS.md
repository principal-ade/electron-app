# OTEL Scope Assignment Progress

## Overview
Adding `otel.scope` fields to all OTEL event nodes in canvas files to specify which instrumentation library emits each event.

**Status:** 9 of 18 files completed (50%)

## Completed Files ✅

### 1. dev-workspace-tabs.otel.canvas
**Scope:** `principal-ade-dev-workspace`
- All events happen in DevWorkspacePanelFramework.tsx
- Tab and panel event handling in the dev workspace renderer

### 2. event-processing-server.otel.canvas
**Scopes:**
- Main process events: `principal-ade-main` (EventServerManager.ts)
- Event processor events: `principal-ade-event-processor` (HttpEventServer.ts)
- External agent events: `principal-ade-event-processor` (documented from processor's perspective)

### 3. file-city-images.otel.canvas
**Scopes:**
- Main process events: `principal-ade-main` (FileCityImageService.ts)
- Renderer events: `principal-ade-principal-window` (ProjectInfoPanel.tsx)
- Playback events: `principal-ade-principal-window` (ProjectInfoPanel.tsx)

**Note:** ProjectInfoPanel is in shared `panels/` directory but only used in principal-window. Consider refactoring window-specific panels to their respective directories.

### 4. filetree-sync.otel.canvas
**Scopes:**
- Worker process events: `principal-ade-repo-monitor` (git-watcher, cache operations)
- Preload/Renderer events: `principal-ade-renderer` (shared across windows)
- External file system: `external-file-system` (OS file system)

### 5. keychain-consent.otel.canvas
**Scopes:**
- Main process events: `principal-ade-main` (main.ts, AuthService.ts, UnifiedSecureStorage.ts)
- Principal window renderer events: `principal-ade-principal-window` (useKeychainConsent.ts, KeychainConsentModal.tsx, SecuritySettings.tsx, AuthView.tsx)

### 6. otel-collector-service.otel.canvas
**Scopes:**
- Main process events: `principal-ade-main` (OtelCollectorService.ts, otelCollectorHandlers.ts)
- Preload events: `principal-ade-renderer` (shared preload code)
- Renderer window: `principal-ade-renderer` (generic, could be any window)

### 7. otel-events-manager-bridge.otel.canvas
**Scopes:**
- Main process events: `principal-ade-main` (OtelEventsManagerBridge.ts, OtelCollectorService.ts, ipcHandlers.ts)
- Dev workspace renderer: `principal-ade-dev-workspace` (DevWorkspaceTitlebar.tsx, DevWorkspaceApp.tsx)
- External endpoints: `external-otel-events-manager` (HTTP endpoints)

### 8. otel-trace-pipeline.otel.canvas
**Scopes:**
- Main process events: `principal-ade-main` (OtelCollectorService.ts, otelCollectorHandlers.ts)
- Preload/shared renderer: `principal-ade-renderer` (shared preload, message subscriber)
- SystemMonitor/TraceViewer: `principal-ade-principal-window` (principal-window/views/SystemMonitor)

### 9. principal-mcp-bridge.otel.canvas
**Scopes:**
- All main process events: `principal-ade-main` (PrincipalMCPBridge.ts, userPreferencesHandler.ts)
- External MCP client: No scope needed (external)

## New Scopes Added to library.yaml

```yaml
# External system scopes
external-file-system:
  color: "#64748B"
  description: "External OS file system - events from the operating system file watcher"
external-otel-events-manager:
  color: "#64748B"
  description: "External OTEL Events Manager service - HTTP endpoints for trace persistence"
```

## Remaining Files to Review (9)

1. `quality-panel-interaction.otel.canvas`
2. `recently-opened-alexandria.otel.canvas`
3. `skill-installation.otel.canvas`
4. `terminal-activity-tracking.otel.canvas`
5. `terminal-session-persistence.otel.canvas`
6. `thread-open.otel.canvas`
7. `user-feed-panel.otel.canvas`
8. `user-preferences.otel.canvas`
9. `window-switcher-cards.otel.canvas`

## Scope Assignment Patterns

### By Process Type:
- **Main Process:** `principal-ade-main`
- **Event Processor Utility:** `principal-ade-event-processor`
- **Repository Monitor Utility:** `principal-ade-repo-monitor`
- **Terminal Worker Utility:** `principal-ade-terminal-worker`
- **CLI Bridge Utility:** `principal-ade-cli-bridge`

### By Window Type:
- **Principal Window:** `principal-ade-principal-window`
- **Dev Workspace:** `principal-ade-dev-workspace`
- **Alexandria Workspace:** `principal-ade-alexandria`
- **Window Switcher:** `principal-ade-window-switcher`
- **Quick Open:** `principal-ade-quick-open`
- **Splash Screen:** `principal-ade-splash-screen`

### Shared Code:
- **Shared Renderer:** `principal-ade-renderer` (preload, shared hooks, contexts)
- **File City Renderer:** `file-city-renderer`

### External Systems:
- **External File System:** `external-file-system`
- **External OTEL Events Manager:** `external-otel-events-manager`

## Notes and Considerations

### Panel Organization
Currently all panels are in `src/renderer/panels/`, but some are window-specific:
- **Window-specific panels** should be in `{window}/panels/` (e.g., `principal-window/panels/ProjectInfoPanel.tsx`)
- **Truly shared panels** stay in `src/renderer/panels/`

This refactoring should be done separately after scope assignment is complete.

### External System Scopes
For events from external systems (OS, external services), we prefix with `external-`:
- Use `external-{system-name}` format
- Define in library.yaml with color `#64748B` (gray)
- These events are documented from our system's perspective

### Validation Command
```bash
npx @principal-ai/principal-view-cli@latest validate
```

## Next Steps

1. Review remaining 9 files and assign scopes
2. Run validation to ensure all errors are fixed
3. Consider panel refactoring (separate task)
4. Commit the scope assignments

## Commit Message Template

```
feat: add OTEL scope fields to canvas event nodes

- Added otel.scope to 18 canvas files
- Defined external system scopes in library.yaml
- Scopes specify which instrumentation library emits each event
- Enables proper trace attribution across process boundaries

Progress: Fixed 18 validation errors by adding scope assignments
```
