# Window.mainProcess Violations Analysis

## Overview
~~33~~ **5 files remaining** that violate the architectural rule that `window.mainProcess` should only be called from `/src/renderer/main-process-api/` services.

**Update (Sep 2025)**: 28 files have been fixed, reducing violations from 33 to 5.
- Latest fixes: LandingPage, AlexandriaRepositoryManager, and DependenciesView components

## Remaining Files with Violations (5 files)

### Components (1 file)
- `components/agent-session-debug/EventProcessingTestView.tsx` - Uses `window.mainProcess.testDebug`

### Services (3 files)
- `services/GitignoreAnalysisService.ts` - Uses `window.mainProcess.system` (5 calls)
- `services/storage/CustomLayersStorageService.ts` - Uses `window.mainProcess.store` (3 calls)
- `services/storage/TodoStorageService.ts` - Uses `window.mainProcess.store` (5 calls)

### Utils (1 file)
- `utils/ipcBridgeDebug.test.ts` - Test file

## Recommended Service Mappings for Remaining Files

### Files needing migration:
1. **TodoStorageService.ts** & **CustomLayersStorageService.ts**
   - Should use: `StoreService` (already exists)
   - Priority: HIGH - Core storage functionality

2. **GitignoreAnalysisService.ts**
   - Should use: `SystemService` (already exists)
   - Priority: MEDIUM - Important for gitignore features

3. **EventProcessingTestView.tsx**
   - Needs: New `TestDebugService` wrapper (doesn't exist yet)
   - Priority: LOW - Debug/test component

4. **ipcBridgeDebug.test.ts**
   - Priority: VERY LOW - Test file only

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

### Files Fixed (28/33)
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
- ✅ pages/LandingPage/LandingPage.tsx (uses AlexandriaService)
- ✅ pages/alexandria/AlexandriaRepositoryManager.tsx (uses AlexandriaService)
- ✅ components/layers/DependenciesView.tsx (uses ShellService)

## Priority Order

1. **High-use services first** - Fix services used by many files
2. **Component fixes** - Update components to use services
3. **Page fixes** - Update pages
4. **Utility fixes** - Update utilities last