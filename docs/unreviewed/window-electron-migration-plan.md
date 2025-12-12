# Window.Electron to Window.MainProcess Migration Plan

## ✅ MIGRATION COMPLETE

All `window.electron` references have been successfully migrated to `window.mainProcess`.

### Special Cases Handled

#### Test/Debug APIs
For test and debug utilities (e.g., `EventProcessingTestView`), we created a dedicated `testDebug` API:
- **Location**: `window.mainProcess.testDebug`
- **Purpose**: Isolates debug/test utilities from production APIs
- **Documentation**: These APIs are clearly marked as debug-only and should NOT be used in production code

Example:
```typescript
// Before:
window.electron.ipcRenderer.invoke('test:process-event', agent, rawEvent)

// After:
window.mainProcess.testDebug.processEvent(agent, rawEvent)
```

## ⚠️ IMPORTANT: Deprecated utils/ipcServices Directory

The `src/renderer/utils/ipcServices/` directory contains deprecated compatibility layers that should be replaced with proper service classes in `src/renderer/main-process-api/`. 

### Deprecated Services to Migrate:
1. **typeExtraction.ts** → Create `TypeExtractionService.ts` in main-process-api
2. **typeSchema.ts** → Create `TypeSchemaService.ts` in main-process-api  
3. **shell.ts** → Use existing `ShellService.ts`
4. **validation.ts** → Use existing `ValidationService.ts`
5. **mcp.ts** → Use existing `McpToolsService.ts`

### Files Currently Using Deprecated Services:
- `AppInitializer.tsx` - uses waitForWindowAPIs
- `useValidation.ts` - uses validation from utils/ipcServices
- `ShellService.ts` - imports shell from utils/ipcServices (circular!)
- `IDEConfigurationView.tsx` - uses shell from utils/ipcServices
- `TerminalConfigurationView.tsx` - uses shell from utils/ipcServices
- `MarkdownView.tsx` - uses shell from utils/ipcServices
- `AgentSelectionModal.tsx` - uses shell from utils/ipcServices

## ⚠️ IMPORTANT: No More Defensive Checks
When creating new services in `main-process-api/`, DO NOT use defensive checks like:
```typescript
// ❌ DON'T DO THIS
if (window.mainProcess?.api?.method) {
  return window.mainProcess.api.method();
}
console.warn('API not available');
```

Instead, directly call the API and use try-catch for error handling:
```typescript
// ✅ DO THIS
try {
  return await window.mainProcess.api.method();
} catch (error) {
  console.error('[ServiceName] Error calling method:', error);
  // Handle error appropriately
}
```

## Current Status
- **Total `window.electron.*` instances**: 97
- **Files affected**: 37+
- **APIs to migrate**: 8 categories

## Migration Categories & Actions

### ✅ Category 1: Already Migrated APIs (Just need usage updates)

#### 1.1 FileSystemAPI ✅ EXISTS
**Current Usage**: `window.electron.fileSystem.*`
**Target**: `window.mainProcess.fileSystem.*`
**Files to Update** (28 instances):
- `src/renderer/services/validation/ValidationService.ts` (10 instances)
- `src/renderer/services/validation/ToolDetectionService.ts` (12 instances)
- `src/renderer/services/validation/ConfiguredValidationService.ts` (2 instances)
- `src/renderer/services/GitignoreAnalysisService.ts` (4 instances)

**Methods**: `readFile`, `readDirectory`, `getFileStats`, `glob`
**Action**: Simple find/replace from `window.electron.fileSystem` to `window.mainProcess.fileSystem`

#### 1.2 ShellAPI ✅ EXISTS  
**Current Usage**: `window.electron.shell.*`
**Target**: `window.mainProcess.shell.*`
**Files to Update** (3 instances):
- `src/renderer/services/validation/ValidationService.ts` (2 instances)
- `src/renderer/components/layers/DependenciesView.tsx` (1 instance)

**Methods**: `runCommand`
**Action**: Simple find/replace from `window.electron.shell` to `window.mainProcess.shell`

#### 1.3 SystemAPI ✅ EXISTS
**Current Usage**: `window.electron.system.*`
**Target**: `window.mainProcess.system.*`
**Files to Update** (5 instances):
- `src/renderer/services/GitignoreAnalysisService.ts` (5 instances)

**Methods**: `executeCommand`
**Action**: Simple find/replace from `window.electron.system` to `window.mainProcess.system`

### 🔄 Category 2: Storage → StoreAPI Migration

#### 2.1 StorageAPI → StoreAPI
**Current Usage**: `window.electron.storage.*`
**Target**: `window.mainProcess.store.*`
**Files to Update** (9 instances):
- `src/renderer/services/storage/TodoStorageService.ts` (4 instances)
- `src/renderer/services/storage/CustomLayersStorageService.ts` (3 instances)
- `src/renderer/services/validation/ConfiguredValidationService.ts` (2 instances)
- `src/renderer/services/validation/AIScriptAnalysisService.ts` (1 instance)

**Methods**: `get`, `set`
**Action**: 
- Check if StoreAPI has same interface
- May need to update method signatures
- Migrate from `window.electron.storage` to `window.mainProcess.store`

### ❓ Category 3: AI API (Needs Investigation)

#### 3.1 AI API
**Current Usage**: `window.electron.ai.*`
**Target**: TBD - Need to check if AI API exists
**Files to Update** (5 instances):
- `src/renderer/pages/LandingPage/LandingPage.tsx` (2 instances)
- `src/renderer/services/validation/AIScriptAnalysisService.ts` (1 instance)
- `src/renderer/components/agent-overview/SegmentedTimelineView.tsx` (1 instance)
- `src/renderer/components/OllamaModelSuggestionModal.tsx` (2 instances)
- `src/renderer/hooks/useAIConfiguration.ts` (1 instance)

**Methods**: `checkOllamaStatus`, `getProviderConfig`, `analyzePackageScripts`, `pullOllamaModel`, `onPullOllamaProgress`
**Action**: 
- Check if AIAPI or LLMModelsAPI covers this
- May need to create new API or extend existing

### 🔄 Category 4: Layer Validation API

#### 4.1 LayerValidationAPI
**Current Usage**: `window.electron.layerValidation.*`
**Target**: Likely `window.mainProcess.validation.*`
**Files to Update** (1 instance):
- `src/renderer/hooks/useAIConfiguration.ts` (1 instance)

**Methods**: `checkAIConfiguration`
**Action**: Check if this belongs in ValidationAPI

### 🔄 Category 5: Type APIs (Already Migrated, Remove Duplicates)

#### 5.1 TypeExtraction & TypeSchema
**Current Usage**: `window.electron.typeExtraction.*`, `window.electron.typeSchema.*`
**Target**: `window.mainProcess.typeExtraction.*`, `window.mainProcess.typeSchema.*`
**Files to Update** (8 instances):
- `src/renderer/utils/ipcServices/typeExtraction.ts` (4 instances)
- `src/renderer/utils/ipcServices/typeSchema.ts` (4 instances)

**Action**: Update to use MainProcess versions

### 🔄 Category 6: Raw IPC Renderer Calls

#### 6.1 Direct ipcRenderer.invoke calls
**Files to Update** (19 instances):
- `src/renderer/services/ViolationMonitoringServiceIPC.ts` (3 instances - violations:*)
- `src/renderer/main-process-api/GitWatcherService.ts` (5 instances - git-watcher:*)
- `src/renderer/components/archive/ArchiveSettingsModal.tsx` (3 instances - archive:*)
- `src/renderer/components/agent-session-debug/*.tsx` (5 instances - archive:*, agent-session-events:*)
- `src/renderer/components/repository-maps/ArchivedAgentSessionCard.tsx` (1 instance)
- `src/renderer/validation/runners/ESLintRunner.ts` (1 instance - violations:collect)

**Action**: 
- violations:* → ValidationAPI or new ViolationsAPI
- git-watcher:* → Already has GitWatcherService, just needs cleanup
- archive:* → AgentSessionArchiveAPI
- agent-session-events:* → AgentSessionEventsAPI

### 🔄 Category 7: PackageManager (Already Fixed)
**Status**: ✅ Fixed - Changed method names from `invokeCheckVersions` to `checkVersions`

### 🔴 Category 8: Final Cleanup

#### 8.1 Remove ElectronAPI
- Remove `ElectronAPI` interface from `src/shared/electron-api-interfaces/index.ts`
- Remove `electronExposure` from `src/window/preload.ts`
- Remove `window.electron` from global type definitions
- Delete `src/shared/electron-api-interfaces/` directory

## Implementation Priority

### Phase 0: Fix Deprecated Service Layer (Priority!)
1. [ ] Create TypeExtractionService.ts in main-process-api
2. [ ] Create TypeSchemaService.ts in main-process-api
3. [ ] Update all imports from utils/ipcServices to main-process-api services
4. [ ] Remove utils/ipcServices directory

### Phase 1: Quick Wins (Day 1)
1. [ ] Migrate FileSystemAPI usage (28 instances) - Simple find/replace
2. [ ] Migrate ShellAPI usage (3 instances) - Simple find/replace  
3. [ ] Migrate SystemAPI usage (5 instances) - Simple find/replace
4. [ ] Migrate TypeExtraction/TypeSchema usage (8 instances)

### Phase 2: Storage Migration (Day 2)
1. [ ] Verify StoreAPI interface compatibility
2. [ ] Migrate Storage to StoreAPI (9 instances)
3. [ ] Test storage functionality

### Phase 3: AI/LLM Investigation (Day 3)
1. [ ] Investigate if AI functionality exists in LLMModelsAPI
2. [ ] Create migration path or new API if needed
3. [ ] Migrate AI API usage (7 instances)

### Phase 4: IPC Channel Cleanup (Days 4-5)
1. [ ] Migrate violations channels to ValidationAPI
2. [ ] Clean up GitWatcherService 
3. [ ] Migrate archive channels to AgentSessionArchiveAPI
4. [ ] Remove all direct ipcRenderer.invoke calls

### Phase 5: Final Cleanup (Day 6)
1. [ ] Remove ElectronAPI interface
2. [ ] Remove electronExposure from preload
3. [ ] Update global type definitions
4. [ ] Delete electron-api-interfaces directory
5. [ ] Run tests and verify functionality

## Success Metrics
- Zero instances of `window.electron.*` in codebase
- All functionality working through `window.mainProcess.*`
- ElectronAPI completely removed
- All tests passing

## Quick Migration Script
```bash
# Phase 1 - Quick wins (run these after backing up!)
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.electron\.fileSystem/window.mainProcess.fileSystem/g'
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.electron\.shell/window.mainProcess.shell/g'
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.electron\.system/window.mainProcess.system/g'
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.electron\.typeExtraction/window.mainProcess.typeExtraction/g'
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.electron\.typeSchema/window.mainProcess.typeSchema/g'
```

## Notes
- FileSystemAPI, ShellAPI, SystemAPI already exist - just need usage updates
- Storage might map directly to StoreAPI
- AI functionality needs investigation - might be in LLMModelsAPI
- Most migrations are simple find/replace operations
- GitWatcherService already properly structured, just needs to stop using window.electron.ipcRenderer