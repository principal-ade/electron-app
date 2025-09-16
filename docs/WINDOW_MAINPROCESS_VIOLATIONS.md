# Window.mainProcess Violations Analysis

## Overview
33 files are violating the architectural rule that `window.mainProcess` should only be called from `/src/renderer/main-process-api/` services.

## Files by Category

### Adapters (2 files)
- `adapters/ElectronShellAdapter.ts`
- `adapters/github/GitHubFileSystemAdapter.ts`

### Components (12 files)
- `AppErrorBoundary.tsx`
- `components/agent-overview/SessionDetailsPanel.tsx`
- `components/agent-session-debug/AgentSessionDebugModal.tsx`
- `components/DiffViewer.tsx`
- `components/landing-page/SettingsModal.tsx`
- `components/repository-maps/AgentSessionArchiveConfigModal.tsx`
- `components/repository-maps/ArchivedAgentSessionsPanel.tsx`
- `components/repository-maps/CloneManagementModal.tsx`
- `components/repository-maps/SyncStatusIndicator.tsx`
- `components/settings/UpdateSettings.tsx`
- `components/Terminal/TabbedTerminalPanel.tsx`
- `components/UpdateNotification.tsx`

### Contexts (1 file)
- `contexts/GitChangesContext.tsx`

### Hooks (1 file)
- `hooks/useAuthState.ts`

### Pages (7 files)
- `pages/LandingPage/AgentConfigurationView/DetailedConfigurationView.tsx`
- `pages/LandingPage/ProjectsView.tsx`
- `pages/MultiFileEditorWindow.tsx`
- `pages/RepoManager/LocalDevelopmentView.tsx`
- `pages/RepoManager/shared/AgentSessionsTab.tsx`
- `pages/RepoManager/shared/SecretsModal.tsx`
- `pages/StoreViewer.tsx`

### Services (5 files)
- `services/ContentProviders.ts`
- `services/git-sync/GitSyncConnectionManager.ts`
- `services/p2p/GitHubAuthDirect.ts`
- `services/p2p/GitHubAuthIPC.ts`
- `services/SecureAuthService.ts`

### Utils (3 files)
- `utils/ipcServices/shell.ts`
- `utils/loadFileSystemTree.ts`
- `utils/terminalUtils.ts`

## APIs Being Used (Need Investigation)

To determine which service wrappers are needed, we need to check what specific APIs each file is calling.

## Action Plan

1. **Group by API usage** - Identify which mainProcess APIs are being used ✅
2. **Check existing services** - See if service wrappers already exist ✅
3. **Create missing services** - Add any missing service wrappers ✅
   - AuthenticationService ✅
   - SecretsService ✅
   - AgentSessionArchiveService ✅
   - AgentSessionEventsService ✅
4. **Update files** - Replace direct calls with service calls (IN PROGRESS)
5. **Test** - Ensure everything still works

## Progress Tracker

### Services Created (All Complete! ✅)
- ✅ PackageManagerService
- ✅ AuthenticationService
- ✅ SecretsService
- ✅ AgentSessionArchiveService
- ✅ AgentSessionEventsService
- ✅ ApiProxyService
- ✅ OrbitService

### All Required Services Now Exist!
Every API used by the 33 violating files now has a corresponding service wrapper.

### Files Fixed (14/33)
- ✅ ElectronPackageManagerApiProvider.ts (uses PackageManagerService)
- ✅ MCPService.ts (uses McpToolsService)
- ✅ SecureAuthService.ts (uses AuthenticationService)
- ✅ GitHubAuthDirect.ts (uses ApiProxyService)
- ✅ GitHubAuthIPC.ts (uses OrbitService)
- ✅ ArchivedAgentSessionsPanel.tsx (uses AgentSessionArchiveService)
- ✅ AgentSessionArchiveConfigModal.tsx (uses AgentSessionArchiveService)
- ✅ SessionDetailsPanel.tsx (uses AgentSessionArchiveService)
- ✅ SecretsModal.tsx (uses SecretsService)
- ✅ UpdateNotification.tsx (uses AppVersionManagerService)

## Priority Order

1. **High-use services first** - Fix services used by many files
2. **Component fixes** - Update components to use services
3. **Page fixes** - Update pages
4. **Utility fixes** - Update utilities last