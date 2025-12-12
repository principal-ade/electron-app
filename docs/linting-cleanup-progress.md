# Linting and TypeScript Cleanup Progress

This document tracks our progress in cleaning up linting and TypeScript issues across the codebase.

## Tracking Commands

### Overall Issue Count

```bash
# Total ESLint issues
npm run lint 2>&1 | grep "✖" | tail -1

# Total TypeScript errors
npm run typecheck 2>&1 | grep "error TS" | wc -l

# Console.log warnings
npm run lint 2>&1 | grep "Unexpected console statement" | wc -l
```

### Issues by Top-Level Directory

```bash
# ESLint issues by directory
npm run lint 2>&1 | grep -E "^/Users/griever/Developer/desktop-app/electron-app/src/" | sed 's|/Users/griever/Developer/desktop-app/electron-app/src/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr

# TypeScript errors by directory
npm run typecheck 2>&1 | grep "error TS" | sed 's|.*src/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr
```

### Renderer-Specific Breakdown

```bash
# ESLint issues in renderer
npm run lint 2>&1 | grep -E "^/Users/griever/Developer/desktop-app/electron-app/src/renderer/" | sed 's|/Users/griever/Developer/desktop-app/electron-app/src/renderer/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr

# TypeScript errors in renderer
npm run typecheck 2>&1 | grep "error TS" | grep "src/renderer/" | sed 's|.*src/renderer/||' | cut -d'/' -f1 | sort | uniq -c | sort -nr
```

## Current Status (Updated - 2025-12-12)

### Overall Issues

* **ESLint**: 916 total issues (582 errors, 334 warnings) ⬇️ **-235 total, -163 errors, -72 warnings (prev: 1151 total, 745 errors, 406 warnings)**
* **TypeScript**: 174 errors ⬇️ **-27 from previous (was 201)**
* **Console.log warnings**: 255 ⬇️ **-42 from previous (was 297)**

### Recent Changes

* Removed repo-manager window (moved to dev-workspace)
* Removed git panels (moved to @industry-theme/git-panels)
* ESLint total decreased by 235 issues: errors down -163, warnings down -72
* TypeScript errors decreased significantly (-27)
* Renderer ESLint issues reduced from 137 to 106 (-31)
* Renderer TypeScript errors reduced from 184 to 142 (-42)
* Panels dramatically improved: ESLint 14→4 (-10), TypeScript 30→6 (-24)

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | % of Total | Change       |
| ---------------------------- | ------ | ---------- | ------------ |
| renderer                     | 106    | 63.5%      | ⬇️ **-31**   |
| main                         | 57     | 34.1%      | ⬆️ **+3**    |
| window                       | 3      | 1.8%       | ⬆️ **+2**    |
| shared                       | 1      | 0.6%       | -            |
| repository-monitoring-server | 0      | ✅ Clean    | -            |
| titlebar                     | 0      | ✅ Clean    | -            |
| event-processing-server      | 0      | ✅ Clean    | -            |

#### TypeScript Errors

| Directory                    | Errors   | % of Total | Change       |
| ---------------------------- | -------- | ---------- | ------------ |
| renderer                     | 142      | 81.6%      | ⬇️ **-42**   |
| main                         | 28       | 16.1%      | ⬆️ **+15**   |
| window                       | 2        | 1.1%       | -            |
| shared                       | 2        | 1.1%       | -            |
| repository-monitoring-server | 0        | ✅ Clean    | -            |
| titlebar                     | 0        | ✅ Clean    | -            |
| event-processing-server      | 0        | ✅ Clean    | -            |
| pure-core                    | 0        | ✅ Clean    | -            |

### Renderer Subdirectories

#### ESLint Issues

| Subdirectory               | Issues  | Change       |
| -------------------------- | ------- | ------------ |
| components                 | 29      | ⬇️ **-7**    |
| main-process-api           | 14      | ⬇️ **-1**    |
| services                   | 13      | ⬇️ **-4**    |
| pages                      | 10      | -            |
| utils                      | 10      | -            |
| hooks                      | 6       | -            |
| adapters                   | 5       | -            |
| contexts                   | 5       | ⬆️ **+3**    |
| panels                     | 4       | ⬇️ **-10**   |
| quick-open                 | 2       | -            |
| extension-window           | 2       | -            |
| dev-workspace              | 2       | ⬇️ **-1**    |
| principal-window           | 1       | ⬇️ **-1**    |
| tipc                       | 1       | 🆕 **new**   |
| App.tsx                    | 1       | ⬆️ **+1**    |
| alexandria-workspace       | 1       | ⬆️ **+1**    |
| types                      | ✅ Clean | -            |
| GlobalFeedbackProvider.tsx | ✅ Clean | -            |
| repo-manager               | 🗑️ Removed | -          |

#### TypeScript Errors

| Subdirectory               | Errors  | Change       |
| -------------------------- | ------- | ------------ |
| components                 | 44      | ⬇️ **-6**    |
| services                   | 24      | -            |
| utils                      | 19      | ⬆️ **+4**    |
| pages                      | 13      | -            |
| adapters                   | 9       | -            |
| principal-window           | 7       | -            |
| panels                     | 6       | ⬇️ **-24**   |
| contexts                   | 6       | -            |
| quick-open                 | 5       | -            |
| main-process-api           | 2       | -            |
| extension-window           | 2       | -            |
| alexandria-workspace       | 2       | -            |
| dev-workspace              | 1       | ⬇️ **-3**    |
| hooks                      | ✅ Clean | -            |
| types                      | ✅ Clean | -            |
| providers                  | ✅ Clean | -            |
| GlobalFeedbackProvider.tsx | ✅ Clean | -            |
| config                     | ✅ Clean | -            |
| App.tsx                    | ✅ Clean | -            |
| repo-manager               | 🗑️ Removed | -          |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (\< 20 total issues)

1. **renderer/dev-workspace** - 2 ESLint + 1 TypeScript = 3 total ⬇️ **-4**
2. **renderer/alexandria-workspace** - 1 ESLint + 2 TypeScript = 3 total
3. **renderer/extension-window** - 2 ESLint + 2 TypeScript = 4 total
4. **renderer/hooks** - 6 ESLint + 0 TypeScript = 6 total
5. **renderer/quick-open** - 2 ESLint + 5 TypeScript = 7 total
6. **renderer/principal-window** - 1 ESLint + 7 TypeScript = 8 total ⬇️ **-1**
7. **renderer/panels** - 4 ESLint + 6 TypeScript = 10 total ⬇️ **-34** 🎉
8. **renderer/contexts** - 5 ESLint + 6 TypeScript = 11 total ⬆️ **+3**
9. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
10. **renderer/main-process-api** - 14 ESLint + 2 TypeScript = 16 total ⬇️ **-1**

### Priority 2: Focus Areas

1. **renderer/pages** - 10 ESLint + 13 TypeScript = 23 total
2. **renderer/utils** - 10 ESLint + 19 TypeScript = 29 total ⬆️ **+4**
3. **renderer/services** - 13 ESLint + 24 TypeScript = 37 total ⬇️ **-4**

### Priority 3: Non-Renderer Directories

1. **window** - 3 ESLint issues + 2 TypeScript errors = 5 total ⬆️ **+2**
2. **shared** - 1 ESLint issue + 2 TypeScript errors = 3 total
3. **main** - 57 ESLint issues + 28 TypeScript errors = 85 total ⬆️ **+18**
4. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors = ✅ **Clean!**

### Priority 4: Large Renderer Areas

1. **renderer/components** - 29 ESLint + 44 TypeScript = 73 total ⬇️ **-13**

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, repository-monitoring-server

✅ **Completed Renderer Subdirectories**: types, GlobalFeedbackProvider.tsx, config, providers, hooks (TypeScript clean)

✅ **Partially Clean Directories**:

* **renderer/hooks** (TypeScript clean - 6 ESLint issues remaining)
* **renderer/App.tsx** (TypeScript clean - 1 ESLint issue remaining)

🎯 **Improved Directories** (since last update):

* **renderer/panels** - Total issues decreased -34 (from 44 to 10), TypeScript down -24, ESLint down -10 🎉
* **renderer/components** - Total issues decreased -13 (from 86 to 73), TypeScript down -6, ESLint down -7
* **renderer/services** - Total issues decreased -4 (from 41 to 37), ESLint down -4
* **renderer/dev-workspace** - Total issues decreased -4 (from 7 to 3), TypeScript down -3, ESLint down -1

🗑️ **Removed Directories** (repo-manager/git-panels cleanup):

* **renderer/repo-manager** - Moved to dev-workspace
* **git panels** - Moved to @industry-theme/git-panels package

⚠️ **Areas Needing Attention**:

* **main** - TypeScript errors increased +15 (13 → 28), ESLint up +3
* **renderer/contexts** - ESLint issues increased +3 (2 → 5)
* **renderer/utils** - TypeScript errors increased +4 (15 → 19)

## Cleanup Best Practices

### Type Safety

**Find the correct types** - Don't settle for `any` or generic `unknown`

* Look for type definitions in shared interfaces
* Check return types of API methods
* Example: Instead of `status?: unknown`, use `status?: { hasMCP: boolean; mcpCount: number }`
* **When `unknown` is appropriate**: Use it for truly dynamic data, but create type aliases for context
  * Good: `type JsonData = unknown` (clearly indicates JSON payload)
  * Bad: Just using `unknown` everywhere without explanation

### Dead Code Removal

**Remove dead code, don't hide it** - Avoid using `_` prefix for unused variables

* If a parameter is unused, investigate whether it's dead code that can be removed
* If the parameter is required by an interface but intentionally unused, consider if the interface needs refactoring
* Check for actual usage with: `grep -r "ComponentName" src/`
* Follow the dependency chain - unused code often imports other unused code
* When removing renderer services, check for:
  * IPC handlers in `src/main/`
  * API definitions in `src/shared/main-process-api-interfaces/`
  * Window implementations in `src/window/main-process-api-implementations/`

### Console.log

* Remove debug `console.log` statements (performance impact - blocking and slows down processes)
* Use `console.warn`/`console.error`/`console.info` for important messages only

### Stub Detection

Many "services" are just stubs that should be removed:

* Always return true/success
* Open URLs instead of doing real work
* Have "STUB:" comments
* These can often be simplified or removed entirely

## Recent Changes (2025-12-12)

### Major Refactoring

The codebase underwent significant refactoring:

#### 1. Repo-Manager Removal
- **Change**: `renderer/repo-manager` directory removed
- **Migration**: Functionality moved to dev-workspace
- **Impact**: -13 ESLint issues, -15 TypeScript errors removed from tracking

#### 2. Git Panels Extraction
- **Change**: Git panels moved to external package `@industry-theme/git-panels`
- **Impact**: Significant reduction in renderer/panels issues (ESLint 14→4, TypeScript 30→6)

#### 3. Overall Progress
- **ESLint**: 1151 → 916 (-235 issues, -20% reduction)
- **TypeScript**: 201 → 174 (-27 errors, -13% reduction)
- **Console.log**: 297 → 255 (-42 warnings, -14% reduction)

#### Notes on Main Directory
- TypeScript errors in main increased from 13 to 28
- This appears to be new code added since the previous cleanup
- Priority area for next cleanup cycle

---

## Historical Fixes (2025-11-06)

### Main Directory TypeScript Cleanup ✨

Fixed all 20 TypeScript errors in `src/main/` directory by finding and applying appropriate types:

#### 1. Storage Domain Issues (9 errors fixed)
- **Files**: `UnifiedSecureStorage.ts`, `SecretsDomain.ts`, `TokenDomain.ts`
- **Problem**: `DecryptedData` interface incorrectly typed tokens/secrets as `Record<string, string>`
- **Solution**: Updated to proper types: `Record<string, TokenData>` and `Record<string, StoredSecret>`
- **Impact**: Fixed type safety in secure storage layer

#### 2. GitSync WebSocket Issues (7 errors fixed)
- **File**: `GitSyncWebSocketManager.ts`
- **Problems**: Unknown types from fetch responses, missing type narrowing, possibly undefined properties
- **Solutions**:
  - Created `RoomTokenResponse` and `ErrorResponse` interfaces for typed fetch responses
  - Added `isGitSyncMessage()` type guard for payload validation
  - Added non-null assertion for peer access after null check
- **Impact**: Improved type safety in WebSocket message handling

#### 3. GitSyncIPC Message Type (1 error fixed)
- **File**: `GitSyncIPC.ts`
- **Problem**: Type mismatch between API and internal message types
- **Solution**: Added type assertion to bridge different message type definitions
- **Impact**: Fixed IPC message routing

#### 4. Undefined Safety Issues (2 errors fixed)
- **File**: `SecureTokenIPC.ts`
- **Problem**: Accessing optional metadata properties without checks
- **Solution**: Added optional chaining (`metadata?.user`)
- **Impact**: Prevented potential runtime errors

#### 5. String Type Safety Issues (1 error + cascading fixes)
- **Files**: `OAuthServerClient.ts`, `AuthService.ts`
- **Problem**: Token can be undefined during refresh but typed as required
- **Solutions**:
  - Updated `AuthResult.token` to `string | undefined`
  - Added validation in initial auth to ensure token exists
  - Added proper undefined handling in token refresh with fallback logic
- **Impact**: Accurately reflects OAuth refresh behavior where GitHub token may not be returned

**Result**: Main directory now has **0 TypeScript errors** (was 20) 🎉