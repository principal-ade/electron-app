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

## Current Status (Updated - 2026-02-06) 🎉

### Overall Issues

* **ESLint**: **741 total issues** (down from 812, **71 issues fixed** ✅)
* **TypeScript**: **0 errors** 🎉 **PROJECT-WIDE CLEAN STATUS**
* **Console.log warnings**: 400
* **Any types in src/main**: 59

### By Top-Level Directory

#### ESLint Issues

| Directory                    | Issues | Status | Change |
| ---------------------------- | ------ | ------ | ------ |
| renderer                     | 88     | 85.4%  | - |
| main                         | **15** | 14.6%  | **-18** ✅ |
| window                       | 0      | ✅ Clean | - |
| terminal-worker              | 0      | ✅ Clean | - |
| event-processing-server      | 0      | ✅ Clean | - |
| telemetry                    | 0      | ✅ Clean | - |
| shared                       | 0      | ✅ Clean | - |
| repository-monitoring-server | 0      | ✅ Clean | - |
| titlebar                     | 0      | ✅ Clean | - |

#### TypeScript Errors

| Directory                    | Errors | Status |
| ---------------------------- | ------ | ------ |
| main                         | 0      | ✅ Clean |
| renderer                     | 0      | ✅ Clean |
| shared                       | 0      | ✅ Clean |
| telemetry                    | 0      | ✅ Clean |
| window                       | 0      | ✅ Clean |
| repository-monitoring-server | 0      | ✅ Clean |
| titlebar                     | 0      | ✅ Clean |
| event-processing-server      | 0      | ✅ Clean |
| pure-core                    | 0      | ✅ Clean |

🎉 **All directories are TypeScript-clean!**

### Renderer Subdirectories - ESLint Issues

| Subdirectory               | Issues |
| -------------------------- | ------ |
| principal-window           | 15     |
| components                 | 12     |
| utils                      | 10     |
| pages                      | 10     |
| main-process-api           | 10     |
| services                   | 6      |
| panels                     | 6      |
| contexts                   | 6      |
| hooks                      | 4      |
| dev-workspace              | 3      |
| extension-window           | 2      |
| alexandria-workspace       | 2      |
| tipc                       | 1      |
| telemetry                  | 1      |
| adapters                   | ✅ Clean |
| types                      | ✅ Clean |
| GlobalFeedbackProvider.tsx | ✅ Clean |
| quick-open                 | ✅ Clean |

## Priority Areas for Cleanup

### Current Focus Areas

1. **renderer/principal-window** - 15 ESLint
2. **main** - **15 ESLint issues** (TypeScript ✅ Clean) - **54% reduction** 🎉
3. **renderer/components** - 12 ESLint
4. **renderer/utils** - 10 ESLint
5. **renderer/pages** - 10 ESLint
6. **renderer/main-process-api** - 10 ESLint

### Recent Cleanup (2026-02-06)

**Main Folder Cleanup - 18 issues fixed:**
- ✅ Fixed lexical declarations in case blocks (added curly braces)
- ✅ Removed unused variables and imports (20+ fixes)
- ✅ Deleted localStorage migration system (no longer needed)
- ✅ Fixed empty constructors/methods (singleton patterns)
- ✅ Replaced `any` types with `unknown` where appropriate
- ✅ Fixed regex control character warnings
- ✅ Fixed unnecessary escape characters
- ✅ Deleted `phase2-future` folder (unused future implementation)
- ✅ Deleted `S3RemoteStorageProvider` stub (unused)
- ✅ Removed unused error variables in catch blocks

## Type Safety Cleanup Patterns

### Pattern 0: Semantic Type Naming for Readability

**Problem:** Using bare `unknown` or `any` without context makes code hard to understand.

**Solution:** Create semantic type aliases that document what the data represents.

```typescript
// ❌ Before: Unclear what these are
function process(data: unknown): unknown { }
const response: any = await fetch();

// ✅ After: Self-documenting with semantic names
/** JSON payload sent in API request body */
type GitHubAPIRequestBody = unknown;

/** Response data from GitHub API (could be JSON object, array, or text) */
type GitHubAPIResponseData = unknown;

/** Raw API response object from GitHub (before type validation).
 * Use type assertions when accessing properties */
type RawGitHubAPIResponse = any;

function process(data: GitHubAPIRequestBody): GitHubAPIResponseData { }
const response: RawGitHubAPIResponse = await fetch();
```

### Pattern 1: Error Handling with Unknown

```typescript
// Before:
catch (error: any) {
  console.error('Error:', error);
  return { success: false, error: error.message };
}

// After:
catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Error:', error);
  return { success: false, error: errorMessage };
}
```

### Pattern 2: Breaking Circular Dependencies with import type

```typescript
// Use type-only imports to avoid runtime circular dependencies
import type { ElectronFileSystemAdapter } from '../file-system/fileSystemHandlers';
import type { ElectronWindowManagerAdapter } from './windowManagerHandlers';

export interface IModernApplicationWindow {
  window: BrowserWindow;
  fileSystemAdapter?: ElectronFileSystemAdapter;
  windowManagerAdapter?: ElectronWindowManagerAdapter;
}
```

### Pattern 3: Global Function Override Types

```typescript
// Before:
const originalOpen = (global as any).open;
(global as any).open = (url: string) => shell.openExternal(url);

// After:
declare global {
  var open: ((url: string) => Promise<void>) | undefined;
}

const originalOpen = global.open;
global.open = (url: string) => shell.openExternal(url);
```

### Pattern 4: Replace Dynamic Index Signatures

```typescript
// Before:
params: {
  pattern: string;
  path?: string;
  [key: string]: any;  // ❌ Allows anything
}

// After:
params: {
  pattern: string;
  path?: string;
  '-A'?: number;  // After context
  '-B'?: number;  // Before context
  '-C'?: number;  // Context
  '-i'?: boolean; // Case insensitive
}
```

## Cleanup Best Practices

### Type Safety

**Find the correct types** - Don't settle for `any` or generic `unknown`

* Look for type definitions in shared interfaces
* Check return types of API methods
* Example: Instead of `status?: unknown`, use `status?: { hasMCP: boolean; mcpCount: number }`
* **When `unknown` is appropriate**: Use it for truly dynamic data, but create type aliases for context

### Dead Code Removal

**Remove dead code, don't hide it** - Avoid using `_` prefix for unused variables

* If a parameter is unused, investigate whether it's dead code that can be removed
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
