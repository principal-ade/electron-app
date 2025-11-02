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

## Current Status (Updated - 2025-11-02)

### Overall Issues
- **ESLint**: 1292 total issues (859 errors, 433 warnings) ⬇️ **-18 from previous (was 1310)**
- **TypeScript**: 188 errors ⬇️ **-3 from previous (was 191)**
- **Console.log warnings**: 305 ⬇️ **-9 from previous (was 314)**

### Recent Cleanup (2025-11-02)
✨ **Cleaned up shared, window, and repository-monitoring-server directories** - All three directories are now completely clean!
- Fixed `any` types with proper interfaces
- Removed debug console.log statements
- Fixed unused variables in catch blocks
- Added missing enum values
- Fixed type incompatibilities

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total | Change |
|-----------|--------|------------|--------|
| renderer | 156 | 72.6% | - |
| main | 59 | 27.4% | - |
| repository-monitoring-server | 0 | ✅ Clean | ⬇️ **-2** |
| window | 0 | ✅ Clean | ⬇️ **-2** |
| shared | 0 | ✅ Clean | ⬇️ **-2** |
| titlebar | 0 | ✅ Clean | - |
| event-processing-server | 0 | ✅ Clean | - |

#### TypeScript Errors
| Directory | Errors | % of Total | Change |
|-----------|--------|------------|--------|
| renderer | 168 | 89.4% | - |
| main | 20 | 10.6% | - |
| window | 0 | ✅ Clean | ⬇️ **-2** |
| repository-monitoring-server | 0 | ✅ Clean | ⬇️ **-1** |
| shared | 0 | ✅ Clean | - |
| titlebar | 0 | ✅ Clean | - |
| event-processing-server | 0 | ✅ Clean | - |
| pure-core | 0 | ✅ Clean | - |

### Renderer Subdirectories

#### ESLint Issues
| Subdirectory | Issues | Change |
|--------------|--------|--------|
| components | 40 | - |
| services | 22 | ⬇️ **-1** |
| panels | 19 | ⬆️ **+2** |
| main-process-api | 16 | - |
| repo-manager | 15 | - |
| utils | 13 | - |
| pages | 12 | - |
| principal-window | 7 | - |
| hooks | 7 | - |
| adapters | 5 | - |
| types | ✅ Clean | - |
| contexts | ✅ Clean | - |
| palace-room-workspace | ✅ Clean | - |
| GlobalFeedbackProvider.tsx | ✅ Clean | - |
| App.tsx | ✅ Clean | - |
| dev-sidecar-logs | ✅ Clean | - |

#### TypeScript Errors
| Subdirectory | Errors | Change |
|--------------|--------|--------|
| components | 51 | - |
| panels | 32 | - |
| services | 27 | ⬆️ **+13** |
| pages | 17 | - |
| utils | 15 | - |
| repo-manager | 10 | ⬆️ **+1** |
| adapters | 9 | - |
| principal-window | 5 | - |
| main-process-api | 2 | - |
| hooks | ✅ Clean | - |
| types | ✅ Clean | - |
| contexts | ✅ Clean | - |
| providers | ✅ Clean | - |
| palace-room-workspace | ✅ Clean | - |
| GlobalFeedbackProvider.tsx | ✅ Clean | - |
| config | ✅ Clean | - |
| App.tsx | ✅ Clean | - |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (< 20 total issues)
1. **renderer/hooks** - 7 ESLint + 0 TypeScript = 7 total (no change)
2. **renderer/principal-window** - 7 ESLint + 5 TypeScript = 12 total (no change)
3. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total (no change)
4. **renderer/main-process-api** - 16 ESLint + 2 TypeScript = 18 total (no change)

### Priority 2: Focus Areas
1. **renderer/repo-manager** - 15 ESLint + 10 TypeScript = 25 total ⬆️ **+1**
2. **renderer/utils** - 13 ESLint + 15 TypeScript = 28 total (no change)
3. **renderer/pages** - 12 ESLint + 17 TypeScript = 29 total (no change)
4. **renderer/services** - 22 ESLint + 27 TypeScript = 49 total ⬆️ **+12 (TypeScript regressed +13)**
5. **renderer/panels** - 19 ESLint + 32 TypeScript = 51 total ⬆️ **+2**

### Priority 3: Non-Renderer Directories
1. **main** - 59 ESLint issues + 20 TypeScript errors = 79 total (no change)
2. **shared** - 0 ESLint issues + 0 TypeScript errors = ✅ **Clean!** ⬇️ **-2**
3. **repository-monitoring-server** - 0 ESLint issues + 0 TypeScript errors = ✅ **Clean!** ⬇️ **-3**
4. **window** - 0 ESLint issues + 0 TypeScript errors = ✅ **Clean!** ⬇️ **-4**

### Priority 4: Large Renderer Areas
1. **renderer/components** - 40 ESLint + 51 TypeScript = 91 total (no change)
2. **renderer/services** - 22 ESLint + 27 TypeScript = 49 total ⬆️ **+12 (TypeScript regressed +13)**

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar, **shared**, **window**, **repository-monitoring-server**

⚠️ **Regressed Directories**:
- **main** - TypeScript errors at 20 (increased from 10 in previous report)

✅ **Completed Renderer Subdirectories**: types, contexts, palace-room-workspace, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers

✅ **Partially Clean Renderer Subdirectories**:
- hooks (ESLint only - 7 issues remaining)

⚠️ **Regressed Renderer Subdirectories**:
- **services** - TypeScript errors increased +13 (from 14 to 27)
- **panels** - ESLint issues increased +2 (from 17 to 19)
- **repo-manager** - TypeScript errors increased +1 (from 9 to 10)

## Cleanup Best Practices

### Type Safety
**Find the correct types** - Don't settle for `any` or generic `unknown`
- Look for type definitions in shared interfaces
- Check return types of API methods
- Example: Instead of `status?: unknown`, use `status?: { hasMCP: boolean; mcpCount: number }`
- **When `unknown` is appropriate**: Use it for truly dynamic data, but create type aliases for context
  - Good: `type JsonData = unknown` (clearly indicates JSON payload)
  - Bad: Just using `unknown` everywhere without explanation

### Dead Code Removal
**Remove dead code, don't hide it** - Avoid using `_` prefix for unused variables
- If a parameter is unused, investigate whether it's dead code that can be removed
- If the parameter is required by an interface but intentionally unused, consider if the interface needs refactoring
- Check for actual usage with: `grep -r "ComponentName" src/`
- Follow the dependency chain - unused code often imports other unused code
- When removing renderer services, check for:
  - IPC handlers in `src/main/`
  - API definitions in `src/shared/main-process-api-interfaces/`
  - Window implementations in `src/window/main-process-api-implementations/`

### Console.log
- Remove debug `console.log` statements (performance impact - blocking and slows down processes)
- Use `console.warn`/`console.error`/`console.info` for important messages only

### Stub Detection
Many "services" are just stubs that should be removed:
- Always return true/success
- Open URLs instead of doing real work
- Have "STUB:" comments
- These can often be simplified or removed entirely
