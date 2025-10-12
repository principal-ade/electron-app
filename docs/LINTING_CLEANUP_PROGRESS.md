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

## Current Status (Updated - 2025-10-11)

### Overall Issues
- **ESLint**: 1479 total issues (989 errors, 490 warnings)
- **TypeScript**: 248 errors
- **Console.log warnings**: 351

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total |
|-----------|--------|------------|
| renderer | 178 | 70.4% |
| main | 75 | 29.6% |
| repository-monitoring-server | 0 | ✅ Clean |
| shared | 0 | ✅ Clean |
| titlebar | 0 | ✅ Clean |
| window | 0 | ✅ Clean |
| event-processing-server | 0 | ✅ Clean |

#### TypeScript Errors
| Directory | Errors | % of Total |
|-----------|--------|------------|
| renderer | 240 | 96.8% |
| main | 8 | 3.2% |
| shared | 0 | ✅ Clean |
| window | 0 | ✅ Clean |
| repository-monitoring-server | 0 | ✅ Clean |
| titlebar | 0 | ✅ Clean |
| event-processing-server | 0 | ✅ Clean |
| pure-core | 0 | ✅ Clean |

### Renderer Subdirectories

#### ESLint Issues
| Subdirectory | Issues |
|--------------|--------|
| components | 64 |
| services | 27 |
| main-process-api | 16 |
| repo-manager | 14 |
| pages | 13 |
| utils | 12 |
| panels | 11 |
| principal-window | 9 |
| hooks | 7 |
| adapters | 5 |
| types | ✅ Clean |
| contexts | ✅ Clean |
| palace-room-workspace | ✅ Clean |
| GlobalFeedbackProvider.tsx | ✅ Clean |
| App.tsx | ✅ Clean |
| dev-sidecar-logs | ✅ Clean |

#### TypeScript Errors
| Subdirectory | Errors |
|--------------|--------|
| components | 96 |
| panels | 35 |
| pages | 30 |
| principal-window | 22 |
| utils | 19 |
| services | 17 |
| adapters | 9 |
| repo-manager | 5 |
| hooks | 5 |
| main-process-api | 2 |
| types | ✅ Clean |
| contexts | ✅ Clean |
| providers | ✅ Clean |
| palace-room-workspace | ✅ Clean |
| GlobalFeedbackProvider.tsx | ✅ Clean |
| config | ✅ Clean |
| App.tsx | ✅ Clean |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (< 20 total issues)
1. **main directory** - 8 TypeScript errors (investigate regression)
2. **renderer/main-process-api** - 16 ESLint + 2 TypeScript = 18 total
3. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
4. **renderer/hooks** - 7 ESLint + 5 TypeScript = 12 total
5. **renderer/repo-manager** - 14 ESLint + 5 TypeScript = 19 total

### Priority 2: Focus Areas
1. **renderer/panels** - 11 ESLint + 35 TypeScript = 46 total
2. **renderer/pages** - 13 ESLint + 30 TypeScript = 43 total
3. **renderer/principal-window** - 9 ESLint + 22 TypeScript = 31 total
4. **renderer/utils** - 12 ESLint + 19 TypeScript = 31 total

### Priority 3: Non-Renderer Directories
1. **main** - 75 ESLint issues + 8 TypeScript errors

### Priority 4: Large Renderer Areas
1. **renderer/components** - 64 ESLint + 96 TypeScript = 160 total (largest)
2. **renderer/services** - 27 ESLint + 17 TypeScript = 44 total

✅ **Completed Directories** (TypeScript + ESLint clean): shared, event-processing-server, pure-core, titlebar, window, repository-monitoring-server

✅ **Completed Renderer Subdirectories**: types, contexts, palace-room-workspace, GlobalFeedbackProvider.tsx, App.tsx, dev-sidecar-logs

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
