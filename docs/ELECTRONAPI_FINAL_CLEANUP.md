# ElectronAPI Final Cleanup Plan

## Overview
This document tracks the final cleanup of ElectronAPI usage to complete the migration to MainProcessAPI.

**Current Status**: 25 files still using `window.electron` APIs

## Migration Priority Order

### 🔴 Priority 1: Quick Wins (Already Migrated APIs)

#### 1.1 getResolvedMcpScriptPath → McpToolsAPI
**Files to Update**:
- `src/renderer/services/MCPService.ts` (2 occurrences)

**Action**: 
- Already exists in McpToolsAPI, just needs to be moved
- Update MCPService to use `window.mainProcess.mcpTools.getResolvedMcpScriptPath()`

#### 1.2 restartApp → SystemAPI  
**Files to Update**:
- Used via `window.electron.restartApp()` in preload

**Action**:
- Already exists in SystemAPI as `window.mainProcess.system.restartApp()`
- Remove from ElectronAPI

#### 1.3 Remove Duplicate API Exposures
**APIs to Remove from ElectronAPI**:
- `typeExtraction` - Already in `window.mainProcess.typeExtraction`
- `typeSchema` - Already in `window.mainProcess.typeSchema`
- `packageManager` - Already in `window.mainProcess.packageManager`
- `mcpTools` - Already in `window.mainProcess.mcpTools`

**Files to Update**:
- `src/renderer/providers/ElectronPackageManagerApiProvider.ts` (6 occurrences)
- Update to use `window.mainProcess.packageManager` instead

---

### 🟡 Priority 2: IPC Channel Migrations

#### 2.1 violations:collect Channel
**Files to Update**:
- `src/renderer/validation/runners/ESLintRunner.ts`
- `src/renderer/services/ViolationMonitoringServiceIPC.ts`

**Action**:
- Check if this belongs in ValidationAPI or needs a new ViolationsAPI
- Migrate `violations:collect` and `violations:clearCache` channels

#### 2.2 git:status-update Channel (GitWatcherService)
**Files to Update**:
- `src/renderer/main-process-api/GitWatcherService.ts`

**Action**:
- This should use the GitAPI event system
- Update to use proper GitAPI event listeners

---

### 🟠 Priority 3: Missing APIs (Need Investigation)

#### 3.1 AI API (analyzePackageScripts)
**Files to Update**:
- `src/renderer/services/validation/AIScriptAnalysisService.ts` (2 occurrences)

**Investigation Needed**:
- Does this API exist somewhere?
- Should it be part of ValidationAPI or a new AIAPI?

#### 3.2 FileSystem API
**Files to Update** (15+ occurrences):
- `src/renderer/services/validation/ValidationService.ts`
- `src/renderer/services/validation/ToolDetectionService.ts`

**Methods Used**:
- `readFile`, `readDirectory`, `getFileStats`, `glob`

**Action**:
- Check if FileSystemAPI exists in MainProcessAPI
- These methods might already be in `window.mainProcess.fileSystem`

#### 3.3 System.executeCommand
**Files to Update**:
- `src/renderer/services/GitignoreAnalysisService.ts` (5 occurrences)

**Action**:
- Check if this exists in SystemAPI
- Might need to extend SystemAPI

#### 3.4 Shell.runCommand
**Files to Update**:
- `src/renderer/services/validation/ValidationService.ts` (2 occurrences)

**Action**:
- Check if this exists in ShellAPI
- Might already be `window.mainProcess.shell.runCommand`

---

### 🟢 Priority 4: Storage API (Do Last)

#### 4.1 Storage API (get/set)
**Files to Update**:
- `src/renderer/services/validation/ConfiguredValidationService.ts`
- `src/renderer/services/validation/AIScriptAnalysisService.ts`
- `src/renderer/services/storage/CustomLayersStorageService.ts`
- `src/renderer/services/storage/TodoStorageService.ts`

**Action**:
- Check if StoreAPI can be used instead
- May need to create StorageAPI or extend StoreAPI

---

## Implementation Steps

### Phase 1: Quick Wins (Day 1)
1. [ ] Move `getResolvedMcpScriptPath` usage to McpToolsAPI
2. [ ] Remove `restartApp` from ElectronAPI
3. [ ] Update ElectronPackageManagerApiProvider to use MainProcessAPI
4. [ ] Remove duplicate API exposures from ElectronAPI

### Phase 2: Investigation (Day 2)
1. [ ] Check if FileSystemAPI exists in MainProcessAPI
2. [ ] Check if system.executeCommand exists in SystemAPI
3. [ ] Check if shell.runCommand exists in ShellAPI
4. [ ] Investigate AI API status
5. [ ] Investigate violations channels

### Phase 3: Migration (Days 3-4)
1. [ ] Migrate violations channels to appropriate API
2. [ ] Migrate or create missing APIs
3. [ ] Update all affected files

### Phase 4: Storage Migration (Day 5)
1. [ ] Investigate StoreAPI vs Storage needs
2. [ ] Migrate storage usage to appropriate API
3. [ ] Update storage service files

### Phase 5: Final Cleanup (Day 6)
1. [ ] Remove ElectronAPI interface
2. [ ] Remove electronExposure from preload.ts
3. [ ] Remove window.electron from global types
4. [ ] Update documentation
5. [ ] Run full test suite

---

## Success Criteria
- [ ] No files using `window.electron`
- [ ] ElectronAPI interface deleted
- [ ] electronExposure removed from preload
- [ ] All functionality working through MainProcessAPI
- [ ] Tests passing

---

## Notes
- Storage API migration saved for last as it may require more investigation
- Some APIs might already exist in MainProcessAPI but aren't being used
- Need to verify each API exists before migrating usage