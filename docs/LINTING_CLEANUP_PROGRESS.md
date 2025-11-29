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

## Current Status (Updated - 2025-11-28)

### Overall Issues

* **ESLint**: 1166 total issues (759 errors, 407 warnings) ⬇️ **-53 total, -4 errors, -49 warnings (prev: 1219 total, 763 errors, 456 warnings)**
* **TypeScript**: 238 errors ⬇️ **-20 from previous (was 258)**
* **Console.log warnings**: 299 ⬇️ **-47 from previous (was 346)**

### Recent Changes

* ESLint total decreased by 53 issues: errors down -4, warnings down -49
* TypeScript errors decreased significantly (-20)
* Console.log warnings decreased substantially (-47)
* Renderer directory shows biggest TypeScript improvement (-39 errors)

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | % of Total | Change      |
| ---------------------------- | ------ | ---------- | ----------- |
| renderer                     | 142    | 72.1%      | ⬇️ **-5**   |
| main                         | 53     | 26.9%      | ⬆️ **+2**   |
| window                       | 1      | 0.5%       | -           |
| shared                       | 1      | 0.5%       | -           |
| repository-monitoring-server | 0      | ✅ Clean    | -           |
| titlebar                     | 0      | ✅ Clean    | -           |
| event-processing-server      | 0      | ✅ Clean    | -           |

#### TypeScript Errors

| Directory                    | Errors   | % of Total | Change       |
| ---------------------------- | -------- | ---------- | ------------ |
| renderer                     | 200      | 84.0%      | ⬇️ **-39**   |
| main                         | 34       | 14.3%      | ⬆️ **+15**   |
| window                       | 2        | 0.8%       | ⬆️ **+2**    |
| shared                       | 2        | 0.8%       | ⬆️ **+2**    |
| repository-monitoring-server | 0        | ✅ Clean    | -            |
| titlebar                     | 0        | ✅ Clean    | -            |
| event-processing-server      | 0        | ✅ Clean    | -            |
| pure-core                    | 0        | ✅ Clean    | -            |

### Renderer Subdirectories

#### ESLint Issues

| Subdirectory               | Issues  | Change     |
| -------------------------- | ------- | ---------- |
| components                 | 37      | ⬆️ **+1**  |
| services                   | 19      | ⬇️ **-2**  |
| panels                     | 17      | ⬇️ **-2**  |
| main-process-api           | 16      | -          |
| repo-manager               | 15      | -          |
| pages                      | 10      | -          |
| utils                      | 10      | ⬇️ **-3**  |
| hooks                      | 6       | -          |
| adapters                   | 5       | -          |
| quick-open                 | 2       | -          |
| principal-window           | 2       | -          |
| contexts                   | 2       | -          |
| extension-window           | 1       | 🆕 **new** |
| types                      | ✅ Clean | -          |
| GlobalFeedbackProvider.tsx | ✅ Clean | -          |
| App.tsx                    | ✅ Clean | -          |
| dev-sidecar-logs           | ✅ Clean | -          |

#### TypeScript Errors

| Subdirectory               | Errors  | Change      |
| -------------------------- | ------- | ----------- |
| components                 | 54      | ⬆️ **+9**   |
| panels                     | 41      | ⬇️ **-60**  |
| services                   | 25      | ⬇️ **-2**   |
| repo-manager               | 18      | ⬆️ **+1**   |
| utils                      | 15      | -           |
| pages                      | 14      | -           |
| principal-window           | 9       | ⬆️ **+4**   |
| adapters                   | 9       | -           |
| quick-open                 | 5       | -           |
| alexandria-workspace       | 4       | 🆕 **new**  |
| main-process-api           | 2       | -           |
| dev-workspace              | 2       | 🆕 **new**  |
| contexts                   | 2       | ⬆️ **+2**   |
| extension-window           | 1       | 🆕 **new**  |
| hooks                      | ✅ Clean | -           |
| types                      | ✅ Clean | -           |
| providers                  | ✅ Clean | -           |
| GlobalFeedbackProvider.tsx | ✅ Clean | -           |
| config                     | ✅ Clean | -           |
| App.tsx                    | ✅ Clean | -           |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (\< 20 total issues)

1. **renderer/hooks** - 6 ESLint + 0 TypeScript = 6 total
2. **renderer/quick-open** - 2 ESLint + 5 TypeScript = 7 total
3. **renderer/extension-window** - 1 ESLint + 1 TypeScript = 2 total 🆕
4. **renderer/contexts** - 2 ESLint + 2 TypeScript = 4 total
5. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
6. **renderer/principal-window** - 2 ESLint + 9 TypeScript = 11 total ⬆️ **+4**
7. **renderer/main-process-api** - 16 ESLint + 2 TypeScript = 18 total

### Priority 2: Focus Areas

1. **renderer/pages** - 10 ESLint + 14 TypeScript = 24 total
2. **renderer/utils** - 10 ESLint + 15 TypeScript = 25 total ⬇️ **-3**
3. **renderer/repo-manager** - 15 ESLint + 18 TypeScript = 33 total ⬆️ **+1**
4. **renderer/services** - 19 ESLint + 25 TypeScript = 44 total ⬇️ **-4**
5. **renderer/panels** - 17 ESLint + 41 TypeScript = 58 total ⬇️ **-62**

### Priority 3: Non-Renderer Directories

1. **window** - 1 ESLint issue + 2 TypeScript errors = 3 total ⬆️ **+2**
2. **shared** - 1 ESLint issue + 2 TypeScript errors = 3 total ⬆️ **+2**
3. **main** - 53 ESLint issues + 34 TypeScript errors = 87 total ⬆️ **+17**
4. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors = ✅ **Clean!**

### Priority 4: Large Renderer Areas

1. **renderer/components** - 37 ESLint + 54 TypeScript = 91 total ⬆️ **+10**
2. **renderer/alexandria-workspace** - 0 ESLint + 4 TypeScript = 4 total 🆕
3. **renderer/dev-workspace** - 0 ESLint + 2 TypeScript = 2 total 🆕

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, repository-monitoring-server

✅ **Completed Renderer Subdirectories**: types, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers, hooks (TypeScript clean)

✅ **Partially Clean Directories**:

* **renderer/hooks** (TypeScript clean - 6 ESLint issues remaining)

🎯 **Improved Directories** (since last update):

* **renderer/panels** - Total issues decreased -62 (from 120 to 58), TypeScript down -60 🎉
* **renderer/services** - Total issues decreased -4 (from 48 to 44), ESLint down -2, TypeScript down -2
* **renderer/utils** - Total issues decreased -3 (from 28 to 25), ESLint down -3

⚠️ **Areas Needing Attention**:

* **main** - TypeScript errors increased +15 (19 → 34), ESLint up +2
* **renderer/components** - TypeScript errors increased +9 (45 → 54)
* **renderer/principal-window** - TypeScript errors increased +4 (5 → 9)
* **renderer/contexts** - TypeScript errors increased +2 (0 → 2)
* **window** - TypeScript errors increased +2 (0 → 2)
* **shared** - TypeScript errors increased +2 (0 → 2)

🆕 **New Directories** (added since last update):

* **renderer/extension-window** - 1 ESLint + 1 TypeScript = 2 total
* **renderer/alexandria-workspace** - 0 ESLint + 4 TypeScript = 4 total
* **renderer/dev-workspace** - 0 ESLint + 2 TypeScript = 2 total

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