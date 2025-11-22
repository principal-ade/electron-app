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

## Current Status (Updated - 2025-11-22)

### Overall Issues

* **ESLint**: 1219 total issues (763 errors, 456 warnings) ⬇️ **-19 total, -13 errors, -6 warnings (prev: 1238 total, 776 errors, 462 warnings)**
* **TypeScript**: 258 errors ⬇️ **-2 from previous (was 260)**
* **Console.log warnings**: 346 ⬇️ **-6 from previous (was 352)**

### Recent Changes

* ESLint total decreased by 19 issues: errors down -13, warnings down -6
* TypeScript errors decreased slightly (-2)
* Main directory TypeScript errors increased slightly (+2, from 17 to 19)
* Console.log warnings decreased (-6)

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | % of Total | Change     |
| ---------------------------- | ------ | ---------- | ---------- |
| renderer                     | 147    | 73.5%      | ⬇️ **-1**  |
| main                         | 51     | 25.5%      | ⬇️ **-4**  |
| window                       | 1      | 0.5%       | -          |
| shared                       | 1      | 0.5%       | -          |
| repository-monitoring-server | 0      | ✅ Clean    | -          |
| titlebar                     | 0      | ✅ Clean    | -          |
| event-processing-server      | 0      | ✅ Clean    | -          |

#### TypeScript Errors

| Directory                    | Errors   | % of Total | Change      |
| ---------------------------- | -------- | ---------- | ----------- |
| renderer                     | 239      | 92.6%      | ⬇️ **-4**   |
| main                         | 19       | 7.4%       | ⬆️ **+2**   |
| window                       | 0        | ✅ Clean    | -           |
| repository-monitoring-server | 0        | ✅ Clean    | -           |
| shared                       | 0        | ✅ Clean    | -           |
| titlebar                     | 0        | ✅ Clean    | -           |
| event-processing-server      | 0        | ✅ Clean    | -           |
| pure-core                    | 0        | ✅ Clean    | -           |

### Renderer Subdirectories

#### ESLint Issues

| Subdirectory               | Issues  | Change    |
| -------------------------- | ------- | --------- |
| components                 | 36      | -         |
| services                   | 21      | ⬇️ **-1** |
| panels                     | 19      | -         |
| main-process-api           | 16      | -         |
| repo-manager               | 15      | -         |
| utils                      | 13      | -         |
| pages                      | 10      | -         |
| hooks                      | 6       | -         |
| adapters                   | 5       | -         |
| quick-open                 | 2       | -         |
| principal-window           | 2       | ⬇️ **-1** |
| contexts                   | 2       | ⬆️ **+1** |
| types                      | ✅ Clean | -         |
| GlobalFeedbackProvider.tsx | ✅ Clean | -         |
| App.tsx                    | ✅ Clean | -         |
| dev-sidecar-logs           | ✅ Clean | -         |

#### TypeScript Errors

| Subdirectory               | Errors  | Change     |
| -------------------------- | ------- | ---------- |
| panels                     | 101     | ⬇️ **-3**  |
| components                 | 45      | -          |
| services                   | 27      | -          |
| repo-manager               | 17      | ⬇️ **-1**  |
| utils                      | 15      | -          |
| pages                      | 14      | -          |
| adapters                   | 9       | -          |
| principal-window           | 5       | -          |
| quick-open                 | 5       | -          |
| main-process-api           | 2       | -          |
| hooks                      | ✅ Clean | -          |
| types                      | ✅ Clean | -          |
| contexts                   | ✅ Clean | -          |
| providers                  | ✅ Clean | -          |
| GlobalFeedbackProvider.tsx | ✅ Clean | -          |
| config                     | ✅ Clean | -          |
| App.tsx                    | ✅ Clean | -          |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (\< 20 total issues)

1. **renderer/hooks** - 6 ESLint + 0 TypeScript \= 6 total
2. **renderer/quick-open** - 2 ESLint + 5 TypeScript \= 7 total
3. **renderer/principal-window** - 2 ESLint + 5 TypeScript \= 7 total ⬇️ **-1**
4. **renderer/adapters** - 5 ESLint + 9 TypeScript \= 14 total
5. **renderer/main-process-api** - 16 ESLint + 2 TypeScript \= 18 total

### Priority 2: Focus Areas

1. **renderer/pages** - 10 ESLint + 14 TypeScript \= 24 total
2. **renderer/utils** - 13 ESLint + 15 TypeScript \= 28 total
3. **renderer/repo-manager** - 15 ESLint + 17 TypeScript \= 32 total ⬇️ **-1**
4. **renderer/services** - 21 ESLint + 27 TypeScript \= 48 total ⬇️ **-1**
5. **renderer/panels** - 19 ESLint + 101 TypeScript \= 120 total ⬇️ **-3**

### Priority 3: Non-Renderer Directories

1. **window** - 1 ESLint issue + 0 TypeScript errors \= 1 total
2. **shared** - 1 ESLint issue + 0 TypeScript errors \= 1 total
3. **main** - 51 ESLint issues + 19 TypeScript errors \= 70 total ⬇️ **-2**
4. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors \= ✅ **Clean!**

### Priority 4: Large Renderer Areas

1. **renderer/components** - 36 ESLint + 45 TypeScript \= 81 total
2. **renderer/contexts** - 2 ESLint + 0 TypeScript \= 2 total ⬆️ **+1**

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, repository-monitoring-server

✅ **Completed Renderer Subdirectories**: types, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers

✅ **Partially Clean Directories**:

* **renderer/hooks** (TypeScript clean - 6 ESLint issues remaining)

🎯 **Improved Directories** (since last update):

* **renderer/panels** - Total issues decreased -3 (from 123 to 120), TypeScript down -3
* **renderer/repo-manager** - Total issues decreased -1 (from 33 to 32), TypeScript down -1
* **renderer/services** - Total issues decreased -1 (from 49 to 48), ESLint down -1
* **renderer/principal-window** - Total issues decreased -1 (from 8 to 7), ESLint down -1
* **main** - Total issues decreased -2 (from 72 to 70), ESLint down -4, TypeScript up +2

⚠️ **Areas Needing Attention**:

* **renderer/contexts** - Now has 2 ESLint issues (was 1 last update)
* **main** - TypeScript errors increased +2 (17 → 19), though ESLint improved -4

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