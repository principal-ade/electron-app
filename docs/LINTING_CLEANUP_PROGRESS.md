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

## Current Status (Updated - 2025-10-29)

### Overall Issues
- **ESLint**: 1319 total issues (891 errors, 428 warnings) ⬆️ **+4 from previous (was 1315)**
- **TypeScript**: 167 errors ⬇️ **-5 from previous (was 172)**
- **Console.log warnings**: 302 ⬇️ **-11 from previous (was 313)**

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total | Change |
|-----------|--------|------------|--------|
| renderer | 155 | 70.5% | +5 |
| main | 59 | 26.8% | -3 |
| repository-monitoring-server | 2 | 0.9% | -1 |
| window | 2 | 0.9% | - |
| shared | 2 | 0.9% | ⬆️ **+2 (was clean!)** |
| titlebar | 0 | ✅ Clean | - |
| event-processing-server | 0 | ✅ Clean | - |

#### TypeScript Errors
| Directory | Errors | % of Total | Change |
|-----------|--------|------------|--------|
| renderer | 154 | 92.2% | ⬇️ **-14** |
| main | 10 | 6.0% | ⬆️ **+9 (was 1!)** |
| window | 2 | 1.2% | - |
| repository-monitoring-server | 1 | 0.6% | - |
| shared | 0 | ✅ Clean | - |
| titlebar | 0 | ✅ Clean | - |
| event-processing-server | 0 | ✅ Clean | - |
| pure-core | 0 | ✅ Clean | - |

### Renderer Subdirectories

#### ESLint Issues
| Subdirectory | Issues | Change |
|--------------|--------|--------|
| components | 40 | - |
| services | 23 | +1 |
| panels | 17 | +4 |
| main-process-api | 16 | +1 |
| repo-manager | 15 | - |
| utils | 13 | - |
| pages | 12 | - |
| principal-window | 7 | -1 |
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
| components | 51 | ⬇️ **-3** |
| panels | 32 | ⬇️ **-15** |
| pages | 17 | - |
| utils | 15 | - |
| services | 14 | - |
| repo-manager | 9 | -1 |
| adapters | 9 | - |
| principal-window | 5 | ⬆️ **+5 (was clean!)** |
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
1. **renderer/hooks** - 7 ESLint + 0 TypeScript = 7 total
2. **renderer/principal-window** - 7 ESLint + 5 TypeScript = 12 total ⬆️ **regressed (TypeScript +5)**
3. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
4. **renderer/main-process-api** - 16 ESLint + 2 TypeScript = 18 total (+1)

### Priority 2: Focus Areas
1. **renderer/repo-manager** - 15 ESLint + 9 TypeScript = 24 total ⬇️ **improved (-1)**
2. **renderer/utils** - 13 ESLint + 15 TypeScript = 28 total (no change)
3. **renderer/pages** - 12 ESLint + 17 TypeScript = 29 total (no change)
4. **renderer/services** - 23 ESLint + 14 TypeScript = 37 total (+1)
5. **renderer/panels** - 17 ESLint + 32 TypeScript = 49 total ⬇️ **improved (-11)**

### Priority 3: Non-Renderer Directories
1. **main** - 59 ESLint issues + 10 TypeScript errors = 69 total ⬆️ **+6 (TypeScript regressed +9)**
2. **shared** - 2 ESLint issues + 0 TypeScript errors = 2 total ⬆️ **+2 (was clean!)**
3. **repository-monitoring-server** - 2 ESLint issues + 1 TypeScript error = 3 total ⬇️ **-1**
4. **window** - 2 ESLint issues + 2 TypeScript errors = 4 total (no change)

### Priority 4: Large Renderer Areas
1. **renderer/components** - 40 ESLint + 51 TypeScript = 91 total ⬇️ **-3 from previous (was 94)**
2. **renderer/services** - 23 ESLint + 14 TypeScript = 37 total (+1 from previous)

✅ **Completed Directories** (TypeScript + ESLint clean): event-processing-server, pure-core, titlebar

⚠️ **Regressed Directories**:
- **shared** - was clean, now has 2 ESLint issues

✅ **Completed Renderer Subdirectories**: types, contexts, palace-room-workspace, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs, config, providers

✅ **Partially Clean Renderer Subdirectories**:
- hooks (ESLint only - 7 issues remaining)

⚠️ **Regressed Renderer Subdirectories**:
- **principal-window** - was TypeScript clean, now has 5 TypeScript errors (7 ESLint remaining)

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
