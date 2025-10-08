# TypeScript Error Tracking Document

**Total Errors:** 299 (down from 588)
**Last Updated:** 2025-09-21

## ✅ Completed Fixes (2025-09-21)
- **main-process-api:** All 132 errors resolved
- **ValidationsTab.tsx:** All 31 errors resolved
- **RepositoryManager.tsx:** All 17 errors resolved
- **ProjectsView.tsx and related components:** 39 errors eliminated (24 from ProjectsView + 15 from related unused components)
  - Removed unused ProjectsView ecosystem
  - Moved RepositoryCard and RepositorySettingsModal to /src/renderer/unused/ for design reference
  - Excluded unused folder from TypeScript and ESLint checks
- **predefinedThemes.ts:** All 10 errors resolved
  - Fixed iconTheme type definition
  - Removed unsupported `modes` properties from theme objects
  - Fixed SessionSummary type mismatches with UIAgentSessionData
  - Unified RepositoryViewType naming (eliminated dual type system)
  - Fixed EventActivityType enum usage
  - Resolved RepositoryUIState activeView type conflicts
  - Fixed A24zNote type mismatches (removed duplicate interface, imported from API)
  - Resolved RepositoryMode conflicts (updated ModeSelector to use RepositoryViewType)
  - Fixed type issues in DevelopmentWorkspace
  - Removed extra props (cityDataCache) from the former planning view (now retired)

## 🏢 Architectural Improvements Made

### Repository View Type System Unification
**Problem:** Dual type system causing confusion and errors
- UI used: `'explore' | 'develop' | 'maintain'`
- Persistence used: `'exploration' | 'collaboration' | 'deployment'`
- Required constant mapping and type casting with potential for mismatches

**Solution:** Unified on persistence naming
- ✅ Created shared `RepositoryViewType` in `userPreferences.types.ts`
- ✅ Updated all components to use: `'exploration' | 'deployment'`
- ✅ Eliminated mapping logic and type casting
- ✅ Consistent naming throughout the entire application stack

**Impact:** 
- Reduced maintenance burden
- Eliminated source of type errors
- More descriptive and professional naming
- Easier for new developers to understand

## Priority Areas

### 1. renderer/main-process-api ✅ FIXED (0 errors)

~~Common issues:~~
- ~~**Type mismatches between API interfaces and implementations**~~
  - ~~Return types not matching interface definitions~~
  - ~~Missing or extra properties in returned objects~~
  - ~~Parameter types not aligned with API contracts~~

#### Files Fixed:
- `AgentSessionService.ts` - Fixed return type to match SessionState | null
- `ExcalidrawStorageService.ts` - Added type assertion for ExcalidrawAppState
- `LLMModelsService.ts` - Fixed type casting for provider models array
- `McpToolsService.ts` - Fixed return type to match API interface

#### ~~Most Common Error Patterns:~~
1. ~~**TS2322**: Type 'void' not assignable to expected return types~~
2. ~~**TS2551**: Property does not exist (typos in method names)~~
3. ~~**TS2741**: Missing required properties in type definitions~~
4. ~~**TS2559**: Types have no properties in common~~

### 2. renderer/components (~173 errors remaining) - HIGH PRIORITY

Common issues:
- **Property access on incorrect types**
- **Missing or renamed properties**
- **Interface mismatches with data models**

#### Key Files with Issues:
- `LandingPage/ProjectsView.tsx` - Many missing properties on Repository type
- `RepoManager/DevelopmentWorkspace.tsx` - Errors reduced but still present
- `RepoManager/LocalDevelopmentView.tsx` (removed) - No longer applicable
- `LandingPage/LandingPage.tsx` - Property name mismatches
- `RepoManager/RepositoryManagerHeader.tsx` - Type mismatches
- `renderer/components/agent-overview/*` - Multiple files with various type errors

#### Most Common Error Patterns:
1. **TS2339**: Property does not exist on type (most common)
2. **TS2322**: Type is not assignable
3. **TS2345**: Argument not assignable to parameter
4. **TS2551**: Property name typos

### 3. renderer/pages (~96 errors remaining) - MEDIUM PRIORITY

Common issues:
- **Property access on incorrect types**
- **Missing or renamed properties**
- **Interface mismatches with data models**

#### Key Files with Issues:
- `LandingPage/ProjectsView.tsx` - Many missing properties on Repository type
- `RepoManager/DevelopmentWorkspace.tsx` - Errors reduced (A24zNote type fixed)
- `RepoManager/LocalDevelopmentView.tsx` (removed) - No longer applicable
- `LandingPage/AgentConfigurationView/*.tsx` - Status type mismatches
- `LandingPage/LandingPage.tsx` - Property name mismatches (running vs isRunning)

#### Most Common Error Patterns:
1. **TS2339**: Property does not exist on type
2. **TS2322**: Type is not assignable
3. **TS2345**: Argument not assignable to parameter
4. **TS2353**: Object literal may only specify known properties

### 4. renderer/services (~28 errors remaining) - MEDIUM PRIORITY

Common issues:
- **Type mismatches in service implementations**
- **Missing property definitions**
- **Incorrect return types**

#### Key Files with Issues:
- `renderer/services/MCPService.ts` - Type mismatches between McpServer/MCPServer and McpTool/MCPTool
- `renderer/services/git-sync/GitSyncClient.ts` - Property name mismatches
- `renderer/services/git-sync/GitSyncConnectionManager.ts` - Type mismatches
- `renderer/services/p2p/GitSyncManager.ts` - Type comparison issues
- `renderer/services/IconThemeService.ts` - Index signature issues

#### Most Common Error Patterns:
1. **TS2322**: Type is not assignable
2. **TS2339**: Property does not exist on type
3. **TS2345**: Argument not assignable to parameter
4. **TS7053**: Element implicitly has an 'any' type because expression can't be used to index type

### 5. renderer/utils (~19 errors remaining) - LOWER PRIORITY

Common issues:
- **Type mismatches in utility functions**
- **Missing or incorrect type definitions**
- **Parameter type issues**

#### Key Files with Issues:
- `renderer/utils/loadFileSystemTree.ts` - Property access and type mismatches
- `renderer/utils/componentDetection.ts` - Type mismatches
- `renderer/utils/devComponentHelper.ts` - Type mismatches
- `renderer/utils/ipcBridgeReal.test.ts` - Argument type mismatches

#### Most Common Error Patterns:
1. **TS2339**: Property does not exist on type
2. **TS2322**: Type is not assignable
3. **TS2345**: Argument not assignable to parameter
4. **TS2352**: Conversion of type may be a mistake

### 6. main/stores (~13 errors remaining) - LOWER PRIORITY

Common issues:
- **Type mismatches in test files**
- **Incorrect argument types**
- **Missing property definitions**

#### Key Files with Issues:
- `main/stores/RepositoryApiEventHandler.spec.ts` - Various type mismatches in mocks
- `main/stores/SecretManager.test.ts` - Type mismatches with RepositorySecrets

#### Most Common Error Patterns:
1. **TS2345**: Argument not assignable to parameter
2. **TS2322**: Type is not assignable
3. **TS18046**: Property is of type 'unknown'

### 7. main/file-system (6 errors) - LOWER PRIORITY

Common issues:
- **Type mismatches in test files**
- **Incorrect argument counts**

#### Key Files with Issues:
- `main/file-system/fileSystemHandlers.test.ts` - Type mismatches and incorrect argument counts

#### Most Common Error Patterns:
1. **TS2559**: Type has no properties in common with expected type
2. **TS2554**: Expected different number of arguments

## Error Type Breakdown

| Error Code | Count | Description |
|------------|-------|-------------|
| TS2339 | 115 | Property does not exist on type |
| TS2322 | 48 | Type is not assignable |
| TS2345 | 35 | Argument not assignable to parameter |
| TS2551 | 25 | Property does not exist (did you mean...?) |
| TS2353 | 23 | Object literal may only specify known properties |
| TS7006 | 23 | Parameter implicitly has 'any' type |
| TS2304 | 14 | Cannot find name |
| TS18046 | 14 | Property is of type 'unknown' |
| TS2307 | 11 | Cannot find module |
| TS18048 | 9 | Property is possibly 'undefined' |
| TS2554 | 6 | Expected different number of arguments |
| TS2559 | 6 | Types have no properties in common |
| TS2352 | 6 | Conversion of type may be a mistake |
| TS2367 | 5 | Comparison appears to be unintentional |
| TS2532 | 3 | Object is possibly 'undefined' |
| TS7053 | 2 | Element implicitly has an 'any' type |
| TS7016 | 2 | Could not find declaration file |
| TS2769 | 2 | No overload matches this call |
| TS2741 | 2 | Missing required properties |
| TS2739 | 2 | Type is missing properties |
| TS2393 | 2 | Duplicate function implementation |
| TS2365 | 2 | Operator cannot be applied to types |
| TS2323 | 2 | Cannot redeclare exported variable |
| TS1117 | 2 | Object literal cannot have multiple properties with same name |
| TS7022 | 1 | Implicitly has type 'any' |
| TS7015 | 1 | Element implicitly has an 'any' type |
| TS2484 | 1 | Export declaration conflicts |

## Recommended Fix Strategy

### Phase 1: renderer/components (Week 1)
1. **Fix property access errors** - Address TS2339 errors which are the most common
2. **Resolve type mismatches** - Fix TS2322 and TS2345 errors
3. **Correct property name typos** - Fix TS2551 errors
4. **Update object literals** - Fix TS2353 errors by removing unknown properties

### Phase 2: renderer/pages (Week 2)
1. **Update Repository type usage** - Add missing properties or fix property access
2. **Fix status interfaces** - Align component expectations with actual API responses
3. **Handle undefined cases** - Add proper null/undefined checks
4. **Update deprecated property names** - Rename to current property names

### Phase 3: renderer/services (Week 3)
1. **Fix service implementation mismatches** - Ensure all services match their interface definitions
2. **Correct type definitions** - Fix missing or incorrect property definitions
3. **Resolve return types** - Ensure methods return the expected types

### Phase 4: renderer/utils (Week 4)
1. **Fix utility function types** - Address parameter and return type issues
2. **Add missing type definitions** - Provide proper types for untyped variables
3. **Resolve conversion issues** - Fix type conversion problems

### Phase 5: main/stores and main/file-system (Week 5)
1. **Fix test file type errors** - Address mock and test-related type mismatches
2. **Correct argument type issues** - Fix parameter type mismatches
3. **Resolve property access errors** - Fix issues with accessing unknown properties

## Quick Wins
- ✅ ~~Fix property name typos (running → isRunning, etc.)~~
- ✅ ~~Unified repository view type naming~~
- Add missing exports to core-lib
- Complete incomplete type definitions
- Add null/undefined checks where needed
- Fix A24zNote interface mismatches
- Resolve RepositoryMode vs RepositoryViewType conflicts

## Commands for Validation
```bash
# Check all TypeScript errors
npm run typecheck

# Check specific folder
npx tsc --noEmit src/renderer/components/**/*.tsx
npx tsc --noEmit src/renderer/pages/**/*.tsx
npx tsc --noEmit src/renderer/services/**/*.ts
npx tsc --noEmit src/renderer/utils/**/*.ts
npx tsc --noEmit src/main/stores/**/*.ts
npx tsc --noEmit src/main/file-system/**/*.ts

# Count errors by folder
npm run typecheck 2>&1 | grep "error TS" | cut -d'(' -f1 | sed 's|^src/||' | cut -d'/' -f1-2 | sort | uniq -c | sort -rn

# Count errors by type
npm run typecheck 2>&1 | grep "error TS" | grep -oE "TS[0-9]+" | sort | uniq -c | sort -rn
```

## Progress Tracking
- [x] main-process-api: 132 → 0 errors ✅ COMPLETED
- [x] ValidationsTab.tsx: 31 → 0 errors ✅ COMPLETED
- [x] RepositoryManager.tsx: 17 → 0 errors ✅ COMPLETED
- [x] SecretManager.test.ts: 1 → 0 errors ✅ COMPLETED
- [ ] renderer/components: ~173 errors
- [ ] renderer/pages: ~96 errors
- [ ] renderer/services: ~28 errors
- [ ] renderer/utils: ~19 errors
- [ ] main/stores: ~7 errors (decreased from ~13)
- [ ] main/file-system: ~6 errors