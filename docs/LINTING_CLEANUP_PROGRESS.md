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

## Current Status (Updated - 2025-12-02)

### Overall Issues

* **ESLint**: 1151 total issues (745 errors, 406 warnings) ⬇️ **-15 total, -14 errors, -1 warnings (prev: 1166 total, 759 errors, 407 warnings)**
* **TypeScript**: 201 errors ⬇️ **-37 from previous (was 238)**
* **Console.log warnings**: 297 ⬇️ **-2 from previous (was 299)**

### Recent Changes

* Removed dev-sidecar functionality (8 files deleted, 8 files modified)
* ESLint total decreased by 15 issues: errors down -14, warnings down -1
* TypeScript errors decreased significantly (-37)
* Main directory TypeScript errors reduced from 34 to 13 (-21)
* Renderer TypeScript errors reduced from 200 to 184 (-16)

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | % of Total | Change      |
| ---------------------------- | ------ | ---------- | ----------- |
| renderer                     | 137    | 71.0%      | ⬇️ **-5**   |
| main                         | 54     | 28.0%      | ⬆️ **+1**   |
| window                       | 1      | 0.5%       | -           |
| shared                       | 1      | 0.5%       | -           |
| repository-monitoring-server | 0      | ✅ Clean    | -           |
| titlebar                     | 0      | ✅ Clean    | -           |
| event-processing-server      | 0      | ✅ Clean    | -           |

#### TypeScript Errors

| Directory                    | Errors   | % of Total | Change       |
| ---------------------------- | -------- | ---------- | ------------ |
| renderer                     | 184      | 91.5%      | ⬇️ **-16**   |
| main                         | 13       | 6.5%       | ⬇️ **-21**   |
| window                       | 2        | 1.0%       | -            |
| shared                       | 2        | 1.0%       | -            |
| repository-monitoring-server | 0        | ✅ Clean    | -            |
| titlebar                     | 0        | ✅ Clean    | -            |
| event-processing-server      | 0        | ✅ Clean    | -            |
| pure-core                    | 0        | ✅ Clean    | -            |

### Renderer Subdirectories

#### ESLint Issues

| Subdirectory               | Issues  | Change     |
| -------------------------- | ------- | ---------- |
| components                 | 36      | ⬇️ **-1**  |
| services                   | 17      | ⬇️ **-2**  |
| main-process-api           | 15      | ⬇️ **-1**  |
| panels                     | 14      | ⬇️ **-3**  |
| repo-manager               | 13      | ⬇️ **-2**  |
| pages                      | 10      | -          |
| utils                      | 10      | -          |
| hooks                      | 6       | -          |
| adapters                   | 5       | -          |
| dev-workspace              | 3       | 🆕 **new** |
| quick-open                 | 2       | -          |
| principal-window           | 2       | -          |
| extension-window           | 2       | ⬆️ **+1**  |
| contexts                   | 2       | -          |
| types                      | ✅ Clean | -          |
| GlobalFeedbackProvider.tsx | ✅ Clean | -          |
| App.tsx                    | ✅ Clean | -          |
| alexandria-workspace       | ✅ Clean | -          |

#### TypeScript Errors

| Subdirectory               | Errors  | Change      |
| -------------------------- | ------- | ----------- |
| components                 | 50      | ⬇️ **-4**   |
| panels                     | 30      | ⬇️ **-11**  |
| services                   | 24      | ⬇️ **-1**   |
| repo-manager               | 15      | ⬇️ **-3**   |
| utils                      | 15      | -           |
| pages                      | 13      | ⬇️ **-1**   |
| adapters                   | 9       | -           |
| principal-window           | 7       | ⬇️ **-2**   |
| contexts                   | 6       | ⬆️ **+4**   |
| quick-open                 | 5       | -           |
| dev-workspace              | 4       | ⬆️ **+2**   |
| main-process-api           | 2       | -           |
| extension-window           | 2       | ⬆️ **+1**   |
| alexandria-workspace       | 2       | ⬇️ **-2**   |
| hooks                      | ✅ Clean | -           |
| types                      | ✅ Clean | -           |
| providers                  | ✅ Clean | -           |
| GlobalFeedbackProvider.tsx | ✅ Clean | -           |
| config                     | ✅ Clean | -           |
| App.tsx                    | ✅ Clean | -           |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (\< 20 total issues)

1. **renderer/extension-window** - 2 ESLint + 2 TypeScript = 4 total
2. **renderer/hooks** - 6 ESLint + 0 TypeScript = 6 total
3. **renderer/dev-workspace** - 3 ESLint + 4 TypeScript = 7 total
4. **renderer/quick-open** - 2 ESLint + 5 TypeScript = 7 total
5. **renderer/contexts** - 2 ESLint + 6 TypeScript = 8 total
6. **renderer/principal-window** - 2 ESLint + 7 TypeScript = 9 total ⬇️ **-2**
7. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
8. **renderer/main-process-api** - 15 ESLint + 2 TypeScript = 17 total ⬇️ **-1**

### Priority 2: Focus Areas

1. **renderer/pages** - 10 ESLint + 13 TypeScript = 23 total ⬇️ **-1**
2. **renderer/utils** - 10 ESLint + 15 TypeScript = 25 total
3. **renderer/repo-manager** - 13 ESLint + 15 TypeScript = 28 total ⬇️ **-5**
4. **renderer/services** - 17 ESLint + 24 TypeScript = 41 total ⬇️ **-3**
5. **renderer/panels** - 14 ESLint + 30 TypeScript = 44 total ⬇️ **-14**

### Priority 3: Non-Renderer Directories

1. **window** - 1 ESLint issue + 2 TypeScript errors = 3 total
2. **shared** - 1 ESLint issue + 2 TypeScript errors = 3 total
3. **main** - 54 ESLint issues + 13 TypeScript errors = 67 total ⬇️ **-20**
4. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors = ✅ **Clean!**

### Priority 4: Large Renderer Areas

1. **renderer/components** - 36 ESLint + 50 TypeScript = 86 total ⬇️ **-5**
2. **renderer/alexandria-workspace** - 0 ESLint + 2 TypeScript = 2 total ⬇️ **-2**

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, repository-monitoring-server

✅ **Completed Renderer Subdirectories**: types, GlobalFeedbackProvider.tsx, App.tsx, config, providers, hooks (TypeScript clean), alexandria-workspace (ESLint clean)

✅ **Partially Clean Directories**:

* **renderer/hooks** (TypeScript clean - 6 ESLint issues remaining)
* **renderer/alexandria-workspace** (ESLint clean - 2 TypeScript errors remaining)

🎯 **Improved Directories** (since last update):

* **main** - Total issues decreased -20 (from 87 to 67), TypeScript down -21 🎉
* **renderer/panels** - Total issues decreased -14 (from 58 to 44), TypeScript down -11, ESLint down -3
* **renderer/components** - Total issues decreased -5 (from 91 to 86), TypeScript down -4, ESLint down -1
* **renderer/repo-manager** - Total issues decreased -5 (from 33 to 28), TypeScript down -3, ESLint down -2

🗑️ **Removed Directories** (dev-sidecar cleanup):

* **renderer/dev-sidecar** - Deleted (was clean)
* **renderer/dev-sidecar-logs** - Deleted (was clean)

⚠️ **Areas Needing Attention**:

* **renderer/contexts** - TypeScript errors increased +4 (2 → 6)
* **renderer/dev-workspace** - TypeScript errors increased +2 (2 → 4), ESLint up +3

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

## Recent Fixes (2025-11-06)

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