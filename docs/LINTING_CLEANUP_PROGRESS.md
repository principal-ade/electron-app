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

## Current Status (Updated - 2025-10-23)

### Overall Issues
- **ESLint**: 1315 total issues (875 errors, 440 warnings) ⬆️ **+22 from previous**
- **TypeScript**: 172 errors ⬆️ **+11 from previous**
- **Console.log warnings**: 313 ⬆️ **+18 from previous**

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total | Change |
|-----------|--------|------------|--------|
| renderer | 150 | 69.1% | +3 |
| main | 62 | 28.6% | +2 |
| repository-monitoring-server | 3 | 1.4% | +2 |
| window | 2 | 0.9% | +1 |
| shared | 0 | ✅ Clean | - |
| titlebar | 0 | ✅ Clean | - |
| event-processing-server | 0 | ✅ Clean | - |

#### TypeScript Errors
| Directory | Errors | % of Total | Change |
|-----------|--------|------------|--------|
| renderer | 168 | 97.7% | +11 |
| window | 2 | 1.2% | - |
| repository-monitoring-server | 1 | 0.6% | - |
| main | 1 | 0.6% | - |
| shared | 0 | ✅ Clean | - |
| titlebar | 0 | ✅ Clean | - |
| event-processing-server | 0 | ✅ Clean | - |
| pure-core | 0 | ✅ Clean | - |

### Renderer Subdirectories

#### ESLint Issues
| Subdirectory | Issues | Change |
|--------------|--------|--------|
| components | 40 | ⬇️ **-3** |
| services | 22 | ⬇️ **-5** |
| repo-manager | 15 | - |
| main-process-api | 15 | - |
| utils | 13 | +1 |
| panels | 13 | ⬆️ **+9** |
| pages | 12 | ⬇️ **-1** |
| principal-window | 8 | +2 |
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
| components | 54 | ⬇️ **-1** |
| panels | 47 | ⬆️ **+14** |
| pages | 17 | - |
| utils | 15 | ⬇️ **-4** |
| services | 14 | - |
| repo-manager | 10 | ⬆️ **+8** |
| adapters | 9 | - |
| main-process-api | 2 | - |
| principal-window | 0 | ✅ **Fixed** |
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
1. **renderer/hooks** - 7 ESLint + 0 TypeScript = 7 total
2. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
3. **renderer/principal-window** - 8 ESLint + 0 TypeScript = 8 total ⬇️ **improved (TypeScript clean!)**
4. **renderer/main-process-api** - 15 ESLint + 2 TypeScript = 17 total

### Priority 2: Focus Areas
1. **renderer/panels** - 13 ESLint + 47 TypeScript = 60 total ⬆️ **regressed (+23)**
2. **renderer/services** - 22 ESLint + 14 TypeScript = 36 total ⬇️ **improved (-5)**
3. **renderer/repo-manager** - 15 ESLint + 10 TypeScript = 25 total ⬆️ **regressed (+8)**
4. **renderer/pages** - 12 ESLint + 17 TypeScript = 29 total ⬇️ **improved (-1)**
5. **renderer/utils** - 13 ESLint + 15 TypeScript = 28 total ⬇️ **improved (-3)**

### Priority 3: Non-Renderer Directories
1. **main** - 62 ESLint issues + 1 TypeScript error = 63 total (+2)
2. **repository-monitoring-server** - 3 ESLint issues + 1 TypeScript error = 4 total (+2)
3. **window** - 2 ESLint issues + 2 TypeScript errors = 4 total (+1)

### Priority 4: Large Renderer Areas
1. **renderer/components** - 40 ESLint + 54 TypeScript = 94 total ⬇️ **-4 from previous (was 98)**
2. **renderer/services** - 22 ESLint + 14 TypeScript = 36 total ⬇️ **-5 from previous (was 41)**

✅ **Completed Directories** (TypeScript + ESLint clean): shared, event-processing-server, pure-core, titlebar

✅ **Completed Renderer Subdirectories**: types, contexts, palace-room-workspace, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers

✅ **Partially Clean Renderer Subdirectories**:
- hooks (ESLint only - 7 issues remaining)
- principal-window (TypeScript clean - 8 ESLint issues remaining)

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
