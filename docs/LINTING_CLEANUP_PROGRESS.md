# Linting and TypeScript Cleanup Progress

This document tracks our progress in cleaning up linting and TypeScript issues across the codebase.

## Tracking Commands

### Overall Issue Count
```bash
# Total ESLint issues
npm run lint 2>&1 | grep "✖" | tail -1

# Total TypeScript errors
npm run typecheck 2>&1 | grep "error TS" | wc -l
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

### Console.log Issue Count
```bash
# Count console.log warnings specifically
npm run lint 2>&1 | grep "Unexpected console statement" | wc -l
```

## Current Status (Baseline - 2025-09-25)

### Overall Issues
- **ESLint**: 2120 issues (1477 errors, 643 warnings)
- **TypeScript**: 403+ errors
- **Console.log warnings**: 643

### By Top-Level Directory

#### ESLint Issues
| Directory | Issues | % of Total |
|-----------|--------|------------|
| renderer | 219 | 10.3% |
| main | 96 | 4.5% |
| window | 25 | 1.2% |
| shared | 17 | 0.8% |
| event-processing-server | 6 | 0.3% |
| repository-monitoring-server | 3 | 0.1% |

#### TypeScript Errors
| Directory | Errors | % of Total |
|-----------|--------|------------|
| renderer | 351 | 87.1% |
| main | 19 | 4.7% |
| event-processing-server | 17 | 4.2% |
| shared | 12 | 3.0% |
| window | 4 | 1.0% |

### Renderer Subdirectories (Most Problematic)

#### ESLint Issues
| Subdirectory | Issues |
|--------------|--------|
| components | 87 |
| pages | 36 |
| services | 30 |
| main-process-api | 23 |
| utils | 11 |
| principal-window | 7 |
| hooks | 7 |
| types | 5 |
| adapters | 5 |

#### TypeScript Errors
| Subdirectory | Errors |
|--------------|--------|
| components | 133 |
| pages | 78 |
| principal-window | 64 |
| services | 36 |
| utils | 17 |
| adapters | 9 |
| hooks | 7 |

## Priority Areas for Cleanup

1. **renderer/components** - Highest TypeScript error count (133) + significant ESLint issues (87)
2. **renderer/pages** - High TypeScript errors (78) + ESLint issues (36)
3. **renderer/principal-window** - High TypeScript errors (64), moderate ESLint issues (7)
4. **renderer/services** - Moderate issues in both (36 TS, 30 ESLint)

## Cleanup Strategy

### Phase 1: Quick Wins
- [ ] Fix console.log performance issues (643 warnings)
- [ ] Fix unused variable warnings (prefix with `_`)
- [ ] Remove unused imports

### Phase 2: Type Safety
- [ ] Fix `@typescript-eslint/no-explicit-any` errors
- [ ] Fix missing type exports/imports
- [ ] Fix type mismatches

### Phase 3: Component-by-Component
- [ ] renderer/components cleanup
- [ ] renderer/pages cleanup
- [ ] renderer/principal-window cleanup
- [ ] renderer/services cleanup

## Cleanup Patterns & Best Practices

### Dead Code Detection
1. **Check for actual usage** - Don't trust imports, check if components/services are actually called
   - Use `grep -r "ComponentName" src/` to find all references
   - Look for `<ComponentName` for React components
   - Look for `ClassName.` or `instanceName.` for service usage

2. **Follow the chain** - Dead code often has dependencies
   - If a component is unused, check what it imports
   - Those imports might also be dead code
   - Example: We deleted 7 files by following the chain from AgentInstallationCard

3. **Check main process handlers** - When removing renderer services
   - Check for corresponding IPC handlers in `src/main/`
   - Check for API definitions in `src/shared/main-process-api-interfaces/`
   - Check for window implementations in `src/window/main-process-api-implementations/`

### Type Safety Improvements
1. **Avoid `unknown` when possible** - Use proper types instead
   - Look for type definitions in shared interfaces
   - Check return types of API methods
   - Example: Instead of `status?: unknown`, use `status?: { hasMCP: boolean; mcpCount: number }`

2. **Fix unused parameters** - Prefix with underscore
   - `callback: (data) => void` → `_callback: (data) => void`
   - This tells TypeScript the parameter is intentionally unused

3. **Remove console.log for production** - Performance impact
   - console.log is blocking and slows down processes
   - Use console.warn/error/info for important messages
   - Remove or comment out debug console.logs

### Stub Service Patterns
Many "services" are just stubs that:
- Always return true/success
- Open URLs instead of doing real work
- Have "STUB:" comments
- These can often be simplified or removed entirely

## Progress Tracking

Update this section after each cleanup session:

### 2025-09-25 - Dead Code Cleanup Session
- **Overall Before**: 2120 total issues (1477 errors, 643 warnings)
- **Overall After**: 2060 total issues (1431 errors, 629 warnings)
- **Total Improvement**: 60 issues fixed (2.8% reduction)

**Specific improvements:**
- renderer/main-process-api: 23 → 19 (4 fixed)
- renderer/services: 56 → 30 (26 fixed! 46% reduction)
- renderer/pages: 36 → 34 (2 fixed)
- renderer/components: 87 → 85 (2 fixed)
- Fixed:
  - Deleted unused AIService.ts (stub that threw "not implemented" errors)
  - Deleted unused AgentAutoUpdateService.ts (stub with non-existent methods)
  - Deleted unused AgentInstallationService.ts (fake installation service)
  - Deleted 4 unused components (SegmentedTimelineView, OllamaModelSuggestionModal, AgentInstallationCard, OnboardingFlowV2)
  - Refactored AgentSetupWizard to remove fake installation management
  - Fixed AgentConfigurationService with proper types instead of `any`
  - Cleaned up AgentSessionSDKService:
    - Removed 7 unused methods
    - Removed corresponding main process handlers
    - Removed API interface definitions
    - Removed window implementation code
  - **Total lines removed: ~1500+ lines of dead/stub code**

### [Date] - [Area Cleaned]
- Before: X ESLint issues, Y TypeScript errors
- After: X ESLint issues, Y TypeScript errors
- Fixed: [brief description]

---

**Note**: Run the tracking commands above periodically to monitor progress and update the tables accordingly.