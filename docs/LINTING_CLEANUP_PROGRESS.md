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

## Current Status (Updated - 2025-10-13)

### Overall Issues
- **ESLint**: 1429 total issues (960 errors, 469 warnings)
- **TypeScript**: 205 errors
- **Console.log warnings**: 336

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total |
|-----------|--------|------------|
| renderer | 166 | 73.1% |
| main | 60 | 26.4% |
| window | 1 | 0.4% |
| repository-monitoring-server | 0 | ✅ Clean |
| shared | 0 | ✅ Clean |
| titlebar | 0 | ✅ Clean |
| event-processing-server | 0 | ✅ Clean |

#### TypeScript Errors
| Directory | Errors | % of Total |
|-----------|--------|------------|
| renderer | 205 | 100% |
| main | 0 | ✅ Clean |
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
| main-process-api | 15 |
| repo-manager | 14 |
| pages | 13 |
| utils | 12 |
| principal-window | 9 |
| hooks | 7 |
| adapters | 5 |
| panels | ✅ Clean |
| types | ✅ Clean |
| contexts | ✅ Clean |
| palace-room-workspace | ✅ Clean |
| GlobalFeedbackProvider.tsx | ✅ Clean |
| App.tsx | ✅ Clean |
| dev-sidecar-logs | ✅ Clean |

#### TypeScript Errors
| Subdirectory | Errors |
|--------------|--------|
| components | 89 |
| panels | 55 |
| utils | 19 |
| pages | 17 |
| services | 14 |
| adapters | 9 |
| principal-window | 2 |
| repo-manager | ✅ Clean |
| hooks | ✅ Clean |
| main-process-api | ✅ Clean |
| types | ✅ Clean |
| contexts | ✅ Clean |
| providers | ✅ Clean |
| palace-room-workspace | ✅ Clean |
| GlobalFeedbackProvider.tsx | ✅ Clean |
| config | ✅ Clean |
| App.tsx | ✅ Clean |

## Priority Areas for Cleanup

### Priority 1: Quick Wins (< 20 total issues)
1. **renderer/main-process-api** - 15 ESLint + 0 TypeScript = 15 total
2. **renderer/adapters** - 5 ESLint + 9 TypeScript = 14 total
3. **renderer/repo-manager** - 14 ESLint + 0 TypeScript = 14 total
4. **renderer/principal-window** - 9 ESLint + 2 TypeScript = 11 total
5. **renderer/hooks** - 7 ESLint + 0 TypeScript = 7 total

### Priority 2: Focus Areas
1. **renderer/panels** - 0 ESLint + 55 TypeScript = 55 total
2. **renderer/services** - 27 ESLint + 14 TypeScript = 41 total
3. **renderer/utils** - 12 ESLint + 19 TypeScript = 31 total
4. **renderer/pages** - 13 ESLint + 17 TypeScript = 30 total

### Priority 3: Non-Renderer Directories
1. **main** - 60 ESLint issues + 0 TypeScript errors
2. **window** - 1 ESLint issue + 0 TypeScript errors

### Priority 4: Large Renderer Areas
1. **renderer/components** - 64 ESLint + 89 TypeScript = 153 total (largest)
2. **renderer/services** - 27 ESLint + 14 TypeScript = 41 total

✅ **Completed Directories** (TypeScript + ESLint clean): shared, event-processing-server, pure-core, titlebar, repository-monitoring-server

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
