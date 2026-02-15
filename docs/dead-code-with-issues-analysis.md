# Dead Code Files with Linting/TypeScript Issues

This document cross-references unused files (from knip) with files that have linting or TypeScript errors, to help prioritize cleanup efforts.

**Last Updated:** 2026-02-14

## Priority Summary

🔴 **High Priority** - Unused files WITH issues (safe to delete, will also clean up issues)
🟢 **Low Priority** - Unused files WITHOUT issues (safe to delete, but no issue reduction)

---

## 🔴 High Priority: Unused Files WITH Issues (12 files)

These files are both unused AND have linting/TypeScript issues. **Deleting these will reduce both dead code and linting issues!**

### renderer/pages (1 file) - 🔴 HIGH PRIORITY

| File | ESLint | TypeScript | Notes |
|------|--------|------------|-------|
| `CallimachusWindow/index.tsx` | ✓ | ✗ | Callimachus window page - likely legacy |

**Impact if deleted:** -1 ESLint issue

---

### renderer/principal-window (2 files) - 🔴 HIGH PRIORITY

| File | ESLint | TypeScript | Notes |
|------|--------|------------|-------|
| `views/SkillBrowserView/GlobalDirectoriesConfig.tsx` | ✓ | ✗ | Skills feature config component |
| `views/SkillBrowserView/PendingChangesPanel.tsx` | ✓ | ✗ | Skills feature panel |

**Impact if deleted:** -2 ESLint issues

---

### renderer/main-process-api (1 file) - 🔴 HIGH PRIORITY

| File | ESLint | TypeScript | Notes |
|------|--------|------------|-------|
| `TypeExtractionService.ts` | ✓ | ✗ | Type extraction IPC service |

**Note:** 10 other files in main-process-api are unused but have no issues.

**Impact if deleted:** -1 ESLint issue

---

### renderer/utils (8 files) - 🔴 HIGH PRIORITY

| File | ESLint | TypeScript | Notes |
|------|--------|------------|-------|
| `devComponentHelper.ts` | ✓ | ✗ | Dev component utilities |
| `docsThemeValidator.ts` | ✓ | ✗ | Documentation theme validation |
| `EventEmitter.ts` | ✓ | ✗ | Event emitter utility |
| `loadManifestContents.ts` | ✓ | ✗ | Manifest loader |
| `monacoErrorSuppressor.ts` | ✓ | ✗ | Monaco error handling |
| `sessionCollisionDetector.ts` | ✓ | ✗ | Session collision detection |
| `workflowParser.ts` | ✓ | ✗ | Workflow parsing utility |
| `licenseUtils.ts` | ✗ | ✗ | License utilities (no issues) |

**Note:** 2 other files in utils are unused but have no issues (licenseUtils.ts, sessionPathNormalization.ts, toolVisualizationConfig.ts)

**Impact if deleted:** -7 ESLint issues (8 files total, 7 with issues)

---

## 🟢 Low Priority: Unused Files WITHOUT Issues (49 files)

These files are unused but have no linting/TypeScript issues. Deleting them will reduce dead code but won't improve issue counts.

### renderer/contexts (1 file)

- `UserCollectionsContext.tsx` ✅ Clean

### renderer/hooks (1 file)

- `useSkillsPendingChanges.ts` ✅ Clean

### renderer/styles (1 file)

- `mdx-editor.ts` ✅ Clean

### renderer/extension-window (1 file)

- `global.d.ts` ✅ Clean

### renderer/services (4 files)

- `CloneVisibilityService.ts` ✅ Clean
- `SourceSelectionService.ts` ✅ Clean
- `storage/CustomLayersStorageService.ts` ✅ Clean
- `WorkspaceLayoutService.ts` ✅ Clean

### renderer/main-process-api (10 files)

All clean except TypeExtractionService.ts (listed above):

- `ActRunnerService.ts` ✅ Clean
- `ActWorkflowService.ts` ✅ Clean
- `ApiProxyService.ts` ✅ Clean
- `ClipboardService.ts` ✅ Clean
- `DockerService.ts` ✅ Clean
- `LinksService.ts` ✅ Clean
- `PackageManagerService.ts` ✅ Clean
- `PrincipalService.ts` ✅ Clean
- `SecretsService.ts` ✅ Clean
- `TypeSchemaService.ts` ✅ Clean

### renderer/utils (2 files)

All clean except the 8 listed above:

- `licenseUtils.ts` ✅ Clean
- `sessionPathNormalization.ts` ✅ Clean
- `toolVisualizationConfig.ts` ✅ Clean

### renderer/other (2 files)

- `global.d.ts` ✅ Clean
- `dev-workspace/global.d.ts` ✅ Clean

### main (13 files) - ✅ All Clean

- `quality-lenses/PackageLayerToToolConfigBridge.ts` ✅ Clean
- `services/FastForwardIPC.ts` ✅ Clean
- `services/GitSyncIPC.ts` ✅ Clean
- `services/OrbitIPC.ts` ✅ Clean
- `services/PresenceIPC.ts` ✅ Clean
- `services/SecureTokenIPC.ts` ✅ Clean
- `services/store/types/index.ts` ✅ Clean
- `services/store/types/session.types.ts` ✅ Clean
- `skills/skillUpdateService.ts` ✅ Clean
- `terminal/TerminalAuthorizationService.ts` ✅ Clean
- `window/callimachusWindow.ts` ✅ Clean
- `window/windowDefaults.ts` ✅ Clean
- `window/windowTypes.ts` ✅ Clean

**Note:** main directory has 1 ESLint issue total, but it's not in these unused files.

### shared (16 files) - ✅ All Clean

- `configs/gitignorePatterns.ts` ✅ Clean
- `configs/index.ts` ✅ Clean
- `configs/types.ts` ✅ Clean
- `git/githubTokenAuth.ts` ✅ Clean
- `ipc-events/CallimachusEvents.ts` ✅ Clean
- `ipc-events/MonitoringEvents.ts` ✅ Clean
- `main-process-api-interfaces/DevWorkspaceAPI.ts` ✅ Clean
- `repository-core/FileSystemCore.ts` ✅ Clean
- `repository-core/index.ts` ✅ Clean
- `sessionTypes.ts` ✅ Clean
- `types/alexandria.types.ts` ✅ Clean
- `types/devServer.types.ts` ✅ Clean
- `types/docsTheme.types.ts` ✅ Clean
- `types/document-discovery.types.ts` ✅ Clean
- `types/git.types.ts` ✅ Clean
- `utils/githubUrlParser.ts` ✅ Clean

### window (3 files) - ✅ All Clean

- `main-process-api-implementations/extensionApi.ts` ✅ Clean
- `preload-dev-workspace.ts` ✅ Clean
- `preload-extension-window.ts` ✅ Clean

### titlebar (2 files) - ✅ All Clean

- `index.js` ✅ Clean
- `index.tsx` ✅ Clean

**Note:** Likely duplicate entry points - may need knip config update

### terminal-worker (3 files) - ✅ All Clean

- `types.ts` ✅ Clean
- `worker-entry.js` ✅ Clean
- `worker-entry.ts` ✅ Clean

**Note:** Duplicate JS/TS files - likely entry points not in knip config

### other (1 file) - ✅ Clean

- `setupTests.js` ✅ Clean

---

## Recommended Cleanup Order

### Phase 1: High-Impact Deletions (12 files, -11 ESLint issues)

1. **renderer/utils** (8 files) - Delete 7 unused utils with ESLint issues
   - Impact: -7 ESLint issues, -8 dead code files

2. **renderer/principal-window** (2 files) - Delete unused SkillBrowserView components
   - Impact: -2 ESLint issues, -2 dead code files

3. **renderer/pages** (1 file) - Delete unused CallimachusWindow page
   - Impact: -1 ESLint issue, -1 dead code file

4. **renderer/main-process-api** (1 file) - Delete TypeExtractionService
   - Impact: -1 ESLint issue, -1 dead code file

**Total Phase 1 Impact:** -11 ESLint issues, -12 dead code files

### Phase 2: Main Process Cleanup (13 files, no issues but good hygiene)

Review and delete unused main process files:
- 5 IPC service files (FastForward, GitSync, Orbit, Presence, SecureToken)
- 3 window-related files (callimachusWindow, windowDefaults, windowTypes)
- Other utilities

### Phase 3: Renderer Services & APIs (15 files, no issues)

Review remaining unused renderer files:
- 10 main-process-api services
- 4 services
- Other utilities

### Phase 4: Shared & Config Files (16 files, requires careful review)

Review unused shared types and configs - these may be:
- Type definitions used in dynamic imports
- Config files loaded at runtime
- IPC event definitions

---

## Validation Before Deletion

For each file before deletion, run:

```bash
# Check for any imports or references
grep -r "filename" src/

# Check git history to understand why it exists
git log --oneline -10 -- path/to/file.ts

# For services, check for IPC usage
grep -r "ServiceName" src/main/
grep -r "ServiceName" src/shared/
```

---

## Expected Impact Summary

**If all high-priority files are deleted:**
- ✅ Dead code: -12 files (-19.7% of total 61 unused files)
- ✅ ESLint issues: -11 issues (-2.3% of total 473 issues)
- ✅ TypeScript errors: 0 change (none of these unused files have TS errors)
- ✅ Improved codebase maintainability

**Combined with low-priority deletions:**
- ✅ Dead code: -61 files (-100% of unused files!)
- ✅ ESLint issues: -11 issues
- ✅ TypeScript errors: 0 change
