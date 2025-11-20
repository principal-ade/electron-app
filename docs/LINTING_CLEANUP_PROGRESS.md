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

## Current Status (Updated - 2025-11-19)

### Overall Issues

* **ESLint**: 1238 total issues (776 errors, 462 warnings) ⬇️ **-16 errors, +16 warnings (errors were 792, warnings were 446)**
* **TypeScript**: 260 errors ⬆️ **+35 from previous (was 225)**
* **Console.log warnings**: 352 ⬆️ **+19 from previous (was 333)**

### Recent Changes

* ESLint total unchanged (1238), but composition shifted: errors decreased (-16), warnings increased (+16)
* TypeScript errors increased significantly (+35), spread across multiple areas
* **⚠️ Main directory TypeScript errors REGRESSED: 0 errors → 17 errors**
* **⚠️ Window and Shared directories now have ESLint issues (previously clean)**
* Console.log warnings increased (+19)

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | % of Total | Change     |
| ---------------------------- | ------ | ---------- | ---------- |
| renderer                     | 148    | 72.2%      | ⬆️ **+6**  |
| main                         | 55     | 26.8%      | ⬇️ **-1**  |
| window                       | 1      | 0.5%       | ⬆️ **+1** ⚠️ |
| shared                       | 1      | 0.5%       | ⬆️ **+1** ⚠️ |
| repository-monitoring-server | 0      | ✅ Clean    | -          |
| titlebar                     | 0      | ✅ Clean    | -          |
| event-processing-server      | 0      | ✅ Clean    | -          |

#### TypeScript Errors

| Directory                    | Errors   | % of Total | Change      |
| ---------------------------- | -------- | ---------- | ----------- |
| renderer                     | 243      | 93.5%      | ⬆️ **+18**  |
| main                         | 17       | 6.5%       | ⬆️ **+17** ⚠️ |
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
| components                 | 36      | ⬇️ **-2** |
| services                   | 22      | -         |
| panels                     | 19      | ⬆️ **+3** |
| main-process-api           | 16      | -         |
| repo-manager               | 15      | ⬆️ **+1** |
| utils                      | 13      | -         |
| pages                      | 10      | -         |
| hooks                      | 6       | ⬇️ **-1** |
| adapters                   | 5       | -         |
| principal-window           | 3       | ⬆️ **+2** |
| quick-open                 | 2       | ⬆️ **+2** |
| contexts                   | 1       | ⬆️ **+1** |
| types                      | ✅ Clean | -         |
| GlobalFeedbackProvider.tsx | ✅ Clean | -         |
| App.tsx                    | ✅ Clean | -         |
| dev-sidecar-logs           | ✅ Clean | -         |

#### TypeScript Errors

| Subdirectory               | Errors  | Change     |
| -------------------------- | ------- | ---------- |
| panels                     | 104     | ⬆️ **+10** |
| components                 | 45      | ⬇️ **-6**  |
| services                   | 27      | -          |
| repo-manager               | 18      | ⬆️ **+9**  |
| utils                      | 15      | -          |
| pages                      | 14      | ⬆️ **+1**  |
| adapters                   | 9       | -          |
| principal-window           | 5       | -          |
| quick-open                 | 5       | ⬆️ **+5**  |
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

1. **renderer/hooks** - 6 ESLint + 0 TypeScript \= 6 total ⬇️ **-1**
2. **renderer/quick-open** - 2 ESLint + 5 TypeScript \= 7 total ⬆️ **+7** (NEW)
3. **renderer/principal-window** - 3 ESLint + 5 TypeScript \= 8 total ⬆️ **+2**
4. **renderer/adapters** - 5 ESLint + 9 TypeScript \= 14 total
5. **renderer/main-process-api** - 16 ESLint + 2 TypeScript \= 18 total

### Priority 2: Focus Areas

1. **renderer/pages** - 10 ESLint + 14 TypeScript \= 24 total ⬆️ **+1**
2. **renderer/utils** - 13 ESLint + 15 TypeScript \= 28 total
3. **renderer/repo-manager** - 15 ESLint + 18 TypeScript \= 33 total ⬆️ **+10**
4. **renderer/services** - 22 ESLint + 27 TypeScript \= 49 total
5. **renderer/panels** - 19 ESLint + 104 TypeScript \= 123 total ⬆️ **+13** ⚠️

### Priority 3: Non-Renderer Directories

1. **window** - 1 ESLint issue + 0 TypeScript errors \= 1 total ⬆️ **+1** (NEW) ⚠️
2. **shared** - 1 ESLint issue + 0 TypeScript errors \= 1 total ⬆️ **+1** (NEW) ⚠️
3. **main** - 55 ESLint issues + 17 TypeScript errors \= 72 total ⬆️ **+16** ⚠️
4. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors \= ✅ **Clean!**

### Priority 4: Large Renderer Areas

1. **renderer/components** - 36 ESLint + 45 TypeScript \= 81 total ⬇️ **-8**
2. **renderer/services** - 22 ESLint + 27 TypeScript \= 49 total

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, repository-monitoring-server

⚠️ **Regressed Directories**:

* **main** - Total issues at 72 (up from 56), TypeScript errors increased +17 (0 → 17), ESLint down -1 🚨
* **window** - Now has 1 ESLint issue (was clean) ⚠️
* **shared** - Now has 1 ESLint issue (was clean) ⚠️
* **renderer/panels** - Total issues at 123 (up from 110), TypeScript errors increased +10 to 104, ESLint up +3 🚨
* **renderer/repo-manager** - Total issues at 33 (up from 23), TypeScript errors increased +9 to 18, ESLint up +1 ⚠️
* **renderer/principal-window** - Total issues at 8 (up from 6), ESLint increased +2 to 3 ⚠️
* **renderer/pages** - Total issues at 24 (up from 23), TypeScript errors increased +1 to 14 ⚠️
* **renderer/contexts** - Now has 1 ESLint issue (was clean) ⚠️

✅ **New Directories Analyzed**:

* **renderer/quick-open** - 2 ESLint + 5 TypeScript = 7 total

✅ **Completed Renderer Subdirectories**: types, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers

✅ **Partially Clean Directories**:

* **renderer/hooks** (TypeScript clean - 6 ESLint issues remaining, down -1)

🎯 **Improved Directories**:

* **renderer/components** - Total issues decreased -8 (from 89 to 81), ESLint down -2, TypeScript down -6 🎉
* **renderer/hooks** - Total issues decreased -1 (from 7 to 6), ESLint down -1

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