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

## Current Status (Updated - 2025-11-06)

### Overall Issues

* **ESLint**: 1238 total issues (792 errors, 446 warnings) ⬇️ **-37 from previous (was 1275)**
* **TypeScript**: 225 errors ⬆️ **+28 from previous (was 197)**
* **Console.log warnings**: 333 ⬆️ **+29 from previous (was 304)**

### Recent Changes

* ESLint issues continue to improve significantly (-37)
* TypeScript errors increased (+28), primarily in renderer/panels (+66)
* **✨ Main directory TypeScript errors FIXED: 20 errors → 0 errors** 🎉
* Console.log warnings increased (+29)

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | % of Total | Change     |
| ---------------------------- | ------ | ---------- | ---------- |
| renderer                     | 142    | 71.7%      | ⬇️ **-10** |
| main                         | 56     | 28.3%      | ⬇️ **-2**  |
| repository-monitoring-server | 0      | ✅ Clean    | -          |
| window                       | 0      | ✅ Clean    | -          |
| shared                       | 0      | ✅ Clean    | -          |
| titlebar                     | 0      | ✅ Clean    | -          |
| event-processing-server      | 0      | ✅ Clean    | -          |

#### TypeScript Errors

| Directory                    | Errors   | % of Total | Change      |
| ---------------------------- | -------- | ---------- | ----------- |
| renderer                     | 225      | 100%       | ⬆️ **+55**  |
| main                         | 0        | ✅ Clean    | ⬇️ **-20** ✨ |
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
| components                 | 38      | ⬇️ **-1** |
| services                   | 22      | -         |
| panels                     | 16      | ⬇️ **-1** |
| main-process-api           | 16      | -         |
| repo-manager               | 14      | ⬇️ **-1** |
| utils                      | 13      | -         |
| pages                      | 10      | ⬇️ **-1** |
| hooks                      | 7       | -         |
| adapters                   | 5       | -         |
| principal-window           | 1       | ⬇️ **-6** |
| types                      | ✅ Clean | -         |
| contexts                   | ✅ Clean | -         |
| palace-room-workspace      | ✅ Clean | -         |
| GlobalFeedbackProvider.tsx | ✅ Clean | -         |
| App.tsx                    | ✅ Clean | -         |
| dev-sidecar-logs           | ✅ Clean | -         |

#### TypeScript Errors

| Subdirectory               | Errors  | Change     |
| -------------------------- | ------- | ---------- |
| panels                     | 94      | ⬆️ **+66** |
| components                 | 51      | ⬇️ **-2**  |
| services                   | 27      | -          |
| utils                      | 15      | -          |
| pages                      | 13      | ⬇️ **-4**  |
| repo-manager               | 9       | ⬇️ **-1**  |
| adapters                   | 9       | -          |
| principal-window           | 5       | -          |
| main-process-api           | 2       | -          |
| hooks                      | ✅ Clean | -          |
| types                      | ✅ Clean | -          |
| contexts                   | ✅ Clean | -          |
| providers                  | ✅ Clean | -          |
| palace-room-workspace      | ✅ Clean | -          |
| GlobalFeedbackProvider.tsx | ✅ Clean | -          |
| config                     | ✅ Clean | -          |
| App.tsx                    | ✅ Clean | -          |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (\< 20 total issues)

1. **renderer/principal-window** - 1 ESLint + 5 TypeScript \= 6 total ⬇️ **-6**
2. **renderer/hooks** - 7 ESLint + 0 TypeScript \= 7 total
3. **renderer/adapters** - 5 ESLint + 9 TypeScript \= 14 total
4. **renderer/main-process-api** - 16 ESLint + 2 TypeScript \= 18 total

### Priority 2: Focus Areas

1. **renderer/repo-manager** - 14 ESLint + 9 TypeScript \= 23 total ⬇️ **-2**
2. **renderer/pages** - 10 ESLint + 13 TypeScript \= 23 total ⬇️ **-5**
3. **renderer/utils** - 13 ESLint + 15 TypeScript \= 28 total
4. **renderer/services** - 22 ESLint + 27 TypeScript \= 49 total
5. **renderer/panels** - 16 ESLint + 94 TypeScript \= 110 total ⬆️ **+65** ⚠️

### Priority 3: Non-Renderer Directories

1. **main** - 56 ESLint issues + 0 TypeScript errors \= 56 total ⬇️ **-20** ✨
2. **shared** - 0 ESLint issues + 0 TypeScript errors \= ✅ **Clean!**
3. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors \= ✅ **Clean!**
4. **window** - 0 ESLint issues + 0 TypeScript errors \= ✅ **Clean!**

### Priority 4: Large Renderer Areas

1. **renderer/components** - 38 ESLint + 51 TypeScript \= 89 total ⬇️ **-3**
2. **renderer/services** - 22 ESLint + 27 TypeScript \= 49 total

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, shared, window, repository-monitoring-server

⚠️ **Regressed Directories**:

* **renderer/panels** - Total issues at 110 (up from 45), TypeScript errors increased +66 to 94 🚨

✅ **Completed Renderer Subdirectories**: types, contexts, palace-room-workspace, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers

✅ **Partially Clean Directories**:

* **main** (TypeScript clean - 56 ESLint issues remaining) ✨
* **renderer/hooks** (TypeScript clean - 7 ESLint issues remaining)

🎯 **Improved Directories**:

* **main** - **TypeScript CLEAN!** Total issues decreased -29 (from 85 to 56), ESLint down -2, TypeScript down -20 to 0 🎉
* **renderer/principal-window** - Total issues decreased -6 (from 12 to 6), ESLint down -6
* **renderer/pages** - Total issues decreased -5 (from 28 to 23), ESLint down -1, TypeScript down -4
* **renderer/components** - Total issues decreased -3 (from 92 to 89), ESLint down -1, TypeScript down -2
* **renderer/repo-manager** - Total issues decreased -2 (from 25 to 23), ESLint down -1, TypeScript down -1

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