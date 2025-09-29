# Linting and TypeScript Cleanup Progress

This document tracks our progress in cleaning up linting and TypeScript issues across the codebase.

## Tracking Commands

### Overall Issue Count
```bash
# Total ESLint issues
npm run lint 2>&1 | grep "✖" | tail -1

# Total TypeScript errors
npm run typecheck 2>&1 | grep "error TS" | wc -l
```

### Issues by Top-Level Directory
```bash
# ESLint issues by directory
npm run lint 2>&1 | grep -E "^/Users/griever/Developer/electron-app/src/" | sed 's|/Users/griever/Developer/electron-app/src/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr

# TypeScript errors by directory
npm run typecheck 2>&1 | grep "error TS" | sed 's|.*src/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr
```

### Renderer-Specific Breakdown
```bash
# ESLint issues in renderer
npm run lint 2>&1 | grep -E "^/Users/griever/Developer/electron-app/src/renderer/" | sed 's|/Users/griever/Developer/electron-app/src/renderer/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr

# TypeScript errors in renderer
npm run typecheck 2>&1 | grep "error TS" | grep "src/renderer/" | sed 's|.*src/renderer/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr
```

### Console.log Issue Count
```bash
# Count console.log warnings specifically
npm run lint 2>&1 | grep "Unexpected console statement" | wc -l
```

## Current Status (Updated - 2025-09-29)

### Overall Issues
- **ESLint**: 1749 issues (1154 errors, 595 warnings) ↓ 371 from baseline
- **TypeScript**: 302 errors ↓ 101 from baseline (25% reduction!)
- **Console.log warnings**: 395 ↓ 248 from baseline (39% reduction!)

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total | Change |
|-----------|--------|------------| -------|
| renderer | 219 | 12.5% | - |
| main | 92 | 5.3% | - |
| window | 0 | 0.0% | ✅ Cleaned |
| shared | 0 | 0.0% | ✅ Cleaned |
| repository-monitoring-server | 0 | 0.0% | ✅ Clean |
| event-processing-server | 0 | 0.0% | ✅ Clean |

#### TypeScript Errors
| Directory | Errors | % of Total | Change |
|-----------|--------|------------| -------|
| renderer | 300 | 99.3% | ↑ 8 |
| main | 2 | 0.7% | ↓ 32 |
| repository-monitoring-server | 0 | 0.0% | ✅ Cleaned |
| window | 0 | 0.0% | ✅ Cleaned |
| event-processing-server | 0 | 0.0% | ✅ Clean |
| shared | 0 | 0.0% | ✅ Cleaned |
| pure-core | 0 | 0.0% | ✅ Clean |

### Renderer Subdirectories (Most Problematic)

#### ESLint Issues
| Subdirectory | Issues | Change |
|--------------|--------| -------|
| components | 83 | - |
| pages | 36 | - |
| services | 31 | - |
| principal-window | 16 | - |
| main-process-api | 15 | - |
| utils | 11 | - |
| hooks | 8 | - |
| types | 5 | - |
| adapters | 5 | - |
| providers | 2 | - |
| contexts | 2 | - |
| validation | 1 | - |
| themes | 1 | - |
| test-scripts | 1 | - |
| GlobalFeedbackProvider.tsx | 1 | - |
| App.tsx | 1 | - |

#### TypeScript Errors
| Subdirectory | Errors | Change |
|--------------|--------| -------|
| components | 107 | - |
| pages | 71 | ↑ 9 |
| principal-window | 50 | - |
| services | 28 | - |
| utils | 18 | - |
| adapters | 9 | - |
| main-process-api | 5 | ↓ 2 |
| hooks | 5 | - |
| providers | 2 | - |
| validation | 1 | - |
| types | 1 | - |
| GlobalFeedbackProvider.tsx | 1 | - |
| contexts | 1 | - |
| config | 1 | - |

Additional renderer diagnostics include a single error in `GlobalFeedbackProvider.tsx` reporting an unexpected `additionalData` property.

## Priority Areas for Cleanup

1. **renderer/components** - Highest TypeScript error count (107) + significant ESLint issues (83)
2. **main** - High ESLint issues (92) + minimal TypeScript errors (2)
3. **renderer/pages** - High TypeScript errors (71) + ESLint issues (36)
4. **renderer/principal-window** - High TypeScript errors (50), moderate ESLint issues (16)
5. **renderer/services** - Moderate issues in both (28 TS, 31 ESLint)

✅ **Completed Directories**: window, shared, repository-monitoring-server, event-processing-server, pure-core

## Cleanup Strategy

### Phase 1: Quick Wins
- [ ] Fix console.log performance issues (423 warnings)
- [ ] Fix unused variable warnings (prefix with `_`)
- [ ] Remove unused imports

### Phase 2: Type Safety
- [ ] Fix `@typescript-eslint/no-explicit-any` errors
- [ ] Fix missing type exports/imports
- [ ] Fix type mismatches

### Phase 3: Component-by-Component
- [ ] renderer/components cleanup
- [ ] renderer/pages cleanup
- [ ] renderer/principal-window cleanup
- [ ] renderer/services cleanup

## Cleanup Patterns & Best Practices

### Dead Code Detection
1. **Check for actual usage** - Don't trust imports, check if components/services are actually called
   - Use `grep -r "ComponentName" src/` to find all references
   - Look for `<ComponentName` for React components
   - Look for `ClassName.` or `instanceName.` for service usage

2. **Follow the chain** - Dead code often has dependencies
   - If a component is unused, check what it imports
   - Those imports might also be dead code
   - Example: We deleted 7 files by following the chain from AgentInstallationCard

3. **Check main process handlers** - When removing renderer services
   - Check for corresponding IPC handlers in `src/main/`
   - Check for API definitions in `src/shared/main-process-api-interfaces/`
   - Check for window implementations in `src/window/main-process-api-implementations/`

### Type Safety Improvements
1. **Avoid `unknown` when possible** - Use proper types instead
   - Look for type definitions in shared interfaces
   - Check return types of API methods
   - Example: Instead of `status?: unknown`, use `status?: { hasMCP: boolean; mcpCount: number }`

2. **Fix unused parameters** - Prefix with underscore
   - `callback: (data) => void` → `_callback: (data) => void`
   - This tells TypeScript the parameter is intentionally unused

3. **Remove console.log for production** - Performance impact
   - console.log is blocking and slows down processes
   - Use console.warn/error/info for important messages
   - Remove or comment out debug console.logs

### Stub Service Patterns
Many "services" are just stubs that:
- Always return true/success
- Open URLs instead of doing real work
- Have "STUB:" comments
- These can often be simplified or removed entirely

## Progress Tracking

Update this section after each cleanup session:

### 2025-09-25 - Dead Code Cleanup Session
- **Overall Before**: 2120 total issues (1477 errors, 643 warnings)
- **Overall After**: 2060 total issues (1431 errors, 629 warnings)
- **Total Improvement**: 60 issues fixed (2.8% reduction)

**Specific improvements:**
- renderer/main-process-api: 23 → 19 (4 fixed)
- renderer/services: 56 → 30 (26 fixed! 46% reduction)
- renderer/pages: 36 → 34 (2 fixed)
- renderer/components: 87 → 85 (2 fixed)
- Fixed:
  - Deleted unused AIService.ts (stub that threw "not implemented" errors)
  - Deleted unused AgentAutoUpdateService.ts (stub with non-existent methods)
  - Deleted unused AgentInstallationService.ts (fake installation service)
  - Deleted 4 unused components (SegmentedTimelineView, OllamaModelSuggestionModal, AgentInstallationCard, OnboardingFlowV2)
  - Refactored AgentSetupWizard to remove fake installation management
  - Fixed AgentConfigurationService with proper types instead of `any`
  - Cleaned up AgentSessionSDKService:
    - Removed 7 unused methods
    - Removed corresponding main process handlers
    - Removed API interface definitions
    - Removed window implementation code
  - **Total lines removed: ~1500+ lines of dead/stub code**

### 2025-09-28 - Continued Cleanup (Current Session)
- **Overall Before**: 2060 total issues (1431 errors, 629 warnings)
- **Overall After**: 1956 total issues (1318 errors, 638 warnings)
- **Total Improvement**: 104 issues fixed (5.0% reduction)
- **TypeScript Errors**: 403 → 402 (1 fixed)
- **Console.log warnings**: 643 → 435 (208 fixed! 32% reduction)

**Directory-level improvements:**
- renderer: 219 → 218 (1 fixed)
- main: 96 → 89 (7 fixed)
- window: 25 → 27 (2 more issues - likely from better type checking)
- shared: 17 → 15 (2 fixed)
- event-processing-server: 6 → 5 (1 fixed)
- repository-monitoring-server: 3 → 5 (2 more issues)

**Renderer subdirectory improvements:**
- components: 87 → 82 (5 fixed)
- services: 30 → 31 (1 more issue)
- main-process-api: 23 → 17 (6 fixed!)
- principal-window: 7 → 14 (7 more issues - possibly from stricter checking)

**TypeScript error distribution changes:**
- renderer: 351 → 289 (62 fixed! 18% reduction)
- main: 19 → 39 (20 more errors - possibly from enabling stricter checks)
- window: 4 → 35 (31 more errors - likely from enabling stricter type checking)
- repository-monitoring-server: 0 → 26 (new errors detected)
- shared: 12 → 9 (3 fixed)

**Key changes made (based on git status):**
- Removed multiple deprecated/unused files:
  - EventMigrationHelper.ts
  - mcp-integration.ts and mcp-server.ts (MCP app control)
  - MCPService.ts and related API implementations
  - Multiple legacy event type definitions
  - Several unused React components (EventCarousel, EventSegmentView, etc.)
  - Unused repository card components
  - Test authentication file
- Major console.log cleanup (208 instances removed)
- Updated build configurations (eslint.config.mjs, knip.json)
- Cleaned up imports and dependencies
- Improved type safety in many files

### 2025-09-28 - Event Processing Server Cleanup
- **Overall Before**: 1956 total issues (1318 errors, 638 warnings)
- **Overall After**: 1906 total issues (1282 errors, 624 warnings)
- **Total Improvement**: 50 issues fixed (2.6% reduction)
- **Console.log warnings**: 435 → 422 (13 additional cleaned)
- **Event-processing-server**: ESLint 5 → 0, TypeScript stay at 0

**Key fixes:**
- Eliminated chokidar watcher leaks by resetting tracked file paths and ensuring clean shutdowns
- Replaced console logging with level-aware `info/warn/error` helpers to satisfy lint policy
- Typed pending request management and IPC payloads for safer message handling
- Hardened the utility worker bridge with validation around incoming/outgoing messages

### 2025-09-29 - Status Verification
- **Overall Before**: 1906 total issues (1282 errors, 624 warnings)
- **Overall After**: 1912 total issues (1285 errors, 627 warnings)
- **Total Change**: +6 issues (0.3% regression)
- **TypeScript Errors**: 383 → 384 (+1)
- **Console.log warnings**: 422 → 424 (+2)

**Observations:**
- Renderer ESLint issues rose slightly (218 → 220), while other top-level directories remained steady.
- Repository monitoring server TypeScript diagnostics increased by one, suggesting recent changes or stricter checks in that area.
- No cleanup actions were taken during this snapshot; counts reflect organic drift since the previous session.

### 2025-09-29 - Shared API Cleanup
- **Overall Before**: 1912 total issues (1285 errors, 627 warnings)
- **Overall After**: 1849 total issues (1224 errors, 625 warnings)
- **Total Improvement**: 63 issues fixed (3.3% reduction)
- **TypeScript Errors**: 384 → 386 (+2)
- **Console.log warnings**: 424 → 423 (-1)

**Directory-level improvements:**
- shared: 15 → 0 (all shared ESLint errors cleared)
- renderer: 220 → 217 (3 issues resolved via API type updates)
- window: 27 → 23 (4 issues resolved by aligning preload adapters with new types)

**Key fixes:**
- Replaced `any` usages across shared main-process API interfaces with explicit, reusable types (e.g., `KnipRunOptions`, `GitSyncLockInfo`, `ViolationPackageSummary`).
- Hardened shared repository utilities by removing unsafe casts and tightening pattern handling in `FileSystemCore` and `GitCore`.
- Updated renderer and preload API clients to consume the new types, eliminating stale casts and ensuring raw session events use structured data.

### 2025-09-29 - Directory Snapshot Review
- **Overall Before**: 1849 total issues (1224 errors, 625 warnings)
- **Overall After**: 1857 total issues (1234 errors, 623 warnings)
- **Total Change**: +8 issues (0.4% regression)
- **TypeScript Errors**: 386 → 415 (+29)
- **Console.log warnings**: 423 → 421 (-2)

**Observations:**
- `repository-monitoring-server` TypeScript diagnostics climbed sharply (28 → 61), suggesting regressions or newly surfaced checks.
- ESLint counts held steady across renderer, main, and window, but `GlobalFeedbackProvider.tsx` now trips a renderer validation error.
- Console log cleanup continues trending down despite the broader regression, indicating logging policy adherence is improving.

### 2025-09-29 - Repository Monitoring Server Lint Cleanup
- **Area Focused**: `repository-monitoring-server`
- **ESLint Issues**: 6 → 0 (validated with `npx eslint src/repository-monitoring-server`)
- **TypeScript Errors**: unchanged (follow-up pass needed)

**Key fixes:**
- Removed duplicated test suites across the `.ts` and `.js` versions to eliminate conflicting declarations picked up by the linter.
- Consolidated Jest mocks and helper utilities so each file now exports a single coherent suite that matches the current watcher implementation.
- Verified the cleanup across the entire directory with the command above; repository-monitoring-server now lint-clean, enabling us to focus next on TypeScript diagnostics.

### 2025-09-29 - Current Status Update
- **Overall Before**: 1857 total issues (1234 errors, 623 warnings)
- **Overall After**: 1784 total issues (1179 errors, 605 warnings)
- **Total Improvement**: 73 issues fixed (3.9% reduction)
- **TypeScript Errors**: 415 → 341 (-74, 17.8% reduction!)
- **Console.log warnings**: 421 → 405 (-16)

**Observations:**
- Significant TypeScript error reduction, especially in `repository-monitoring-server` (61 → 14) and `window` (33 → 1)
- ESLint issues remain relatively stable with slight improvements
- Window directory shows major improvement in both ESLint (23 → 10) and TypeScript (33 → 1)
- Renderer remains the highest priority area with 219 ESLint issues and 292 TypeScript errors

### 2025-09-29 - Window and Shared Directories Cleanup
- **Overall Before**: 1784 total issues (1179 errors, 605 warnings)
- **Overall After**: 1749 total issues (1154 errors, 595 warnings)
- **Total Improvement**: 35 issues fixed (2.0% reduction)
- **TypeScript Errors**: 341 → 314 (-27, 7.9% reduction)

**Directory-specific fixes:**
- **window**: 10 ESLint → 0 (all fixed), 1 TypeScript → 0 (fixed)
- **shared**: 2 ESLint → 0 (all fixed), TypeScript errors resolved

**Key fixes:**
- Replaced all `any` types with proper types (`unknown`, `RemoteAgentMessage`, `ToolExecutionRequest`, etc.)
- Fixed unused import (removed `RepositorySecrets`)
- Updated `GitAPI` interface to use correct `GitStatus` type
- Moved `ToolExecutionRequest/Response` types from main to shared to fix cross-boundary imports
- Changed console.log to console.info in preload script
- Fixed type mismatches in API implementations

**Result**: Both window and shared directories are now completely clean - 0 ESLint issues, 0 TypeScript errors!

### 2025-09-29 - Repository Monitoring Server Cleanup
- **Overall Before**: 1749 total issues (1154 errors, 595 warnings)
- **Overall After**: 1749 total issues (1154 errors, 595 warnings)
- **Total Improvement**: 0 ESLint issues (already clean)
- **TypeScript Errors**: 314 → 302 (-12, 3.8% reduction)

**Directory-specific fixes:**
- **repository-monitoring-server**: 0 ESLint (already clean), 12 TypeScript → 0 (all fixed)

**Key fixes:**
- Fixed FileTree mock data in tests to match actual interface (removed invalid `type` properties, added proper FileInfo/DirectoryInfo structure)
- Added missing `manifestPath` property to PackageLayer test data
- Added missing `metadata` property to FileTree test objects
- Added missing `sourceInfo` to FileTree metadata
- Imported FileInfo and DirectoryInfo types in test file
- Fixed cross-project import in RepositoryMonitoringService.ts
- Fixed workspaceHandler invocation type issue in tests

**Result**: repository-monitoring-server directory is now completely clean - 0 ESLint issues, 0 TypeScript errors!

### [Date] - [Area Cleaned]
- Before: X ESLint issues, Y TypeScript errors
- After: X ESLint issues, Y TypeScript errors
- Fixed: [brief description]

---

**Note**: Run the tracking commands above periodically to monitor progress and update the tables accordingly.