# Workspace Context Architecture & Tech Debt

This document catalogs the different workspace window implementations, their context usage patterns, and identified tech debt.

## Workspace Windows Overview

| Window | Location | Context Pattern | Terminal Support |
|--------|----------|----------------|------------------|
| **Dev Workspace** | `src/renderer/dev-workspace/` | `RepositoryPanelContext` + `TerminalContext` (split) | Via TerminalContext |
| **Alexandria Workspace** | `src/renderer/alexandria-workspace/` | `PanelContext` (monolithic) | Via PanelContext |
| **Principal Window** | `src/renderer/principal-window/` | View-specific contexts | None |
| **Extension Window** | `src/renderer/extension-window/` | No custom contexts | None |

## Context Architecture by Window

### Dev Workspace (Single Repository Focus)

```
DevWorkspaceApp
  └─ RepositoryPanelProvider (2,821 lines)    ← Heavyweight panel data
       └─ TerminalProvider (555 lines)         ← Split: terminal state
            └─ AgentHighlightProvider (243 lines) ← Split: high-frequency agent events
                 └─ ConfigurablePanelLayout
```

**Key Design Decisions**:
1. **TerminalContext split**: Prevents terminal state changes (creating/destroying tabs) from re-rendering unrelated panels
2. **AgentHighlightContext split**: Prevents high-frequency agent event updates from re-rendering unrelated panels. Only Code City panel consumes this context.

The `FileCityWithHighlights` wrapper component (line 283) merges highlight layers into the Code City panel.

### Alexandria Workspace (Multi-Repository Focus)

```
AlexandriaWorkspaceApp
  └─ AlexandriaWorkspaceEventProvider
       └─ PanelProvider (1,714 lines) ← Includes terminal actions
            └─ ConfigurablePanelLayout
```

**Missing from Dev Workspace pattern**:
- Terminal is bundled into PanelContext, not split out
- No `AgentHighlightProvider` - no agent event visualization for Code City

### Principal Window (View-Based Navigation)

```
PrincipalApp
  └─ PrincipalEventProvider
       └─ IntegratedShell
            └─ [View-specific contexts per route]
                 ├─ ProjectsPanelContext (1,922 lines)
                 ├─ WorldsViewPanelContext (1,068 lines)
                 ├─ GitSyncPanelContext (611 lines)
                 └─ etc.
```

**Note**: No terminal integration in Principal Window.

---

## Tech Debt Items

### HIGH PRIORITY

#### 1. Duplicated Event Providers
- **Files**:
  - `src/renderer/principal-window/PrincipalEventContext.tsx` (~50 lines)
  - `src/renderer/alexandria-workspace/AlexandriaWorkspaceEventContext.tsx` (~48 lines)
- **Issue**: Nearly identical implementations
- **Impact**: ~100 lines duplicate code
- **Recommendation**: Extract to shared `createEventProvider()` factory

#### 2. Terminal Context Split Inconsistency
- **Issue**: Dev Workspace intentionally splits TerminalContext for performance, but Alexandria Workspace bundles terminals in PanelContext
- **Impact**:
  - Inconsistent performance characteristics
  - Alexandria may have unnecessary re-renders on terminal state changes
- **Recommendation**: Either apply the same split to Alexandria, or document why the difference is acceptable

#### 3. Missing AgentHighlightProvider in Alexandria Workspace
- **Issue**: Dev Workspace has `AgentHighlightProvider` for Code City agent event visualization, Alexandria Workspace has none
- **Impact**:
  - No agent event highlighting in Alexandria Workspace's Code City panels
  - Feature parity gap between workspaces
- **Recommendation**: Add AgentHighlightProvider to Alexandria Workspace if agent visualization is desired there

#### 4. Context Naming Inconsistency
- **Issue**: Mixed naming patterns:
  - `PanelContext`, `RepositoryPanelContext`, `ProjectsPanelContext` (Panel suffix)
  - `WorldsViewPanelContext`, `GitSyncPanelContext` (View in name)
- **Impact**: Confusing to understand which context serves what purpose
- **Recommendation**: Standardize naming convention

### MEDIUM PRIORITY

#### 5. PanelContext Size and Scope Creep
- **File**: `src/renderer/contexts/PanelContext.tsx` (1,714 lines)
- **Issue**: Massive context with 150+ properties handling:
  - File operations
  - Repository management
  - Workspace operations
  - Localhost detection
  - Terminal actions
  - And more...
- **Impact**: Hard to test, understand, and modify
- **Recommendation**: Split into domain-specific contexts

#### 6. RepositoryPanelContext vs PanelContext Overlap
- **Files**:
  - `src/renderer/contexts/RepositoryPanelContext.tsx` (2,821 lines)
  - `src/renderer/contexts/PanelContext.tsx` (1,714 lines)
- **Issue**: Both manage file trees, git status, packages, etc. but differently
- **Impact**: Duplicated logic, unclear when to use which
- **Recommendation**: Reconcile or clearly document separation of concerns

#### 7. Duplicate Command Palette Logic
- **Files**:
  - `src/renderer/dev-workspace/index.tsx` (lines ~283-375)
  - `src/renderer/alexandria-workspace/index.tsx` (lines ~142-180)
- **Issue**: Identical command palette handling (toggle, collapse, expand, switch, reset)
- **Impact**: ~100+ lines duplicate code
- **Recommendation**: Extract to shared `useCommandPaletteHandlers()` hook

### LOW PRIORITY

#### 8. Missing Context Documentation
- **Issue**: No clear guide on when to use which context
- **Impact**: Developers must reverse-engineer from code
- **Recommendation**: Add decision tree/README for context selection

#### 9. View-Specific Contexts Location
- **Issue**: Some contexts in `src/renderer/contexts/`, others in view directories
- **Impact**: Hard to discover all available contexts
- **Recommendation**: Consolidate to `contexts/` directory or document the pattern

---

## Context Size Reference

| Context | Lines | Complexity | Recommendation |
|---------|-------|------------|----------------|
| RepositoryPanelContext | 2,821 | Very High | Reconcile with PanelContext |
| ProjectsPanelContext | 1,922 | High | Keep (specialized) |
| PanelContext | 1,714 | High | Split into domains |
| WorldsViewPanelContext | 1,068 | High | Keep (specialized) |
| GitSyncPanelContext | 611 | Medium | Keep (specialized) |
| TerminalContext | 555 | Medium | Document split rationale |
| AgentHighlightContext | 243 | Low | Keep (specialized) |
| Event Providers | ~50 each | Low | Extract as reusable |

---

## Recommended Refactoring Phases

1. **Phase 1 (Quick Win)**: Extract shared EventProvider factory
2. **Phase 2 (Medium)**: Split PanelContext into domain-specific contexts
3. **Phase 3 (Reconciliation)**: Unify or clearly separate RepositoryPanelContext and PanelContext
4. **Phase 4 (Documentation)**: Create context decision guide

---

## Related Documentation

- `docs/CONTEXT_PROVIDERS_INVENTORY.md` - Inventory of all context providers
- `docs/panel-architecture.md` - Panel framework architecture
- `docs/new-window-app-guide.md` - Guide for creating new window types
