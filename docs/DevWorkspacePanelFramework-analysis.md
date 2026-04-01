# DevWorkspacePanelFramework Analysis

## Overview

`src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` is a 4,194-line "god component" that orchestrates the entire panel system for the dev workspace. It has accumulated too many responsibilities and should be refactored.

## Current Statistics

| Metric | Count |
|--------|-------|
| Total lines | 4,194 |
| Imports | ~108 lines |
| Tab type interfaces | 15 types |
| useState hooks | 12+ |
| useCallback/useMemo/useEffect | 43+ |
| Event subscriptions | ~15 different event types |
| Panel components initialized | 25+ |

## File Structure

```
Lines 1-108      Imports (25+ packages)
Lines 109-270    Tab type interfaces (15 types)
Lines 271-350    Helper interfaces & types
Lines 350-405    FileCityWithHighlights component
Lines 406-4105   DevWorkspacePanelFrameworkInner (THE MONSTER)
Lines 4116-4194  DevWorkspacePanelFramework wrapper (providers)
```

## Problems

### 1. Single Responsibility Violation

The component handles:
- Panel collapse/expand state management
- Tab state management (create, focus, close, update)
- Event subscriptions for 15+ event types
- Panel component initialization (25+ panels)
- Tab content rendering (15 content types)
- Associated content rendering (split panes)
- Terminal integration
- Right panel history
- Modal state management
- OpenTelemetry instrumentation
- Layout coordination with parent

### 2. Massive Event Subscription Block (lines 856-2185)

~1,300 lines of `useEffect` blocks subscribing to events like:
- `doc:openInRightPanel`
- `task:selected`
- `skill:selected`
- `file:opened`
- `canvas:open` (via `custom` event)
- `multi-canvas:open`
- `dashboard:open`
- `bruno:request-selected`
- `trace:selected`
- `dependency-graph:open`
- `file-city-3d:open`
- `issue:selected`
- `agent:selected`

Each handler has 50-150 lines of inline logic with OTEL spans.

### 3. Giant `renderTabContent` (lines 2505-3055)

~550 lines of switch statement handling 15 tab content types:
- `terminal`
- `skill`
- `markdown`
- `canvas-editor`
- `canvas-detail`
- `multi-canvas`
- `file-editor`
- `media`
- `mdx-editor`
- `git-diff`
- `dependency-graph`
- `trace-details`
- `bruno-request`
- `dashboard`
- `file-city-3d`

Each case has 30-60 lines of inline JSX.

### 4. `allPanels` useMemo (lines ~3200-3900)

~700 lines instantiating 25+ panel components with their props inline.

### 5. Too Many Dependencies

The `renderTabContent` useCallback has 47 dependencies, making it nearly impossible to optimize.

---

## Proposed Refactoring

### Phase 1: Extract Tab Content Renderers

Create `src/renderer/dev-workspace/tab-content/` directory:

```
tab-content/
  index.ts                    # Registry export
  types.ts                    # Shared types
  TabContentWrapper.tsx       # Common wrapper component
  SkillTabContent.tsx
  MarkdownTabContent.tsx
  CanvasEditorTabContent.tsx
  CanvasDetailTabContent.tsx
  MultiCanvasTabContent.tsx
  FileEditorTabContent.tsx
  MediaTabContent.tsx
  MdxEditorTabContent.tsx
  GitDiffTabContent.tsx
  DependencyGraphTabContent.tsx
  TraceDetailsTabContent.tsx
  BrunoRequestTabContent.tsx
  DashboardTabContent.tsx
  FileCity3DTabContent.tsx
```

**Registry pattern:**
```tsx
// tab-content/index.ts
export const tabContentRenderers: Record<string, React.FC<TabContentProps>> = {
  'skill': SkillTabContent,
  'markdown': MarkdownTabContent,
  // ...
};

// Usage in main component:
const renderTabContent = useCallback((tab) => {
  const Renderer = tabContentRenderers[tab.contentType];
  return Renderer ? <Renderer tab={tab} {...commonProps} /> : null;
}, [commonProps]); // Much smaller dependency array
```

**Estimated savings:** ~550 lines

---

### Phase 2: Extract Event Handlers

Create `src/renderer/dev-workspace/hooks/useDevWorkspaceEvents.ts`:

```tsx
export function useDevWorkspaceEvents({
  events,
  actions,
  layout,
  onLayoutChange,
  setTabs,
  setFocusTabId,
  setDetailModal,
  setRightPanelHistory,
  isRightCollapsed,
  handleRightExpand,
}: UseDevWorkspaceEventsParams) {
  useDocOpenHandler({ events, actions, layout, onLayoutChange, ... });
  useTaskSelectedHandler({ events, setTabs, setFocusTabId });
  useSkillSelectedHandler({ events, setTabs, setFocusTabId });
  // ... etc
}
```

Or even more granular:
```
hooks/
  useDevWorkspaceEvents.ts      # Orchestrator
  events/
    useDocOpenHandler.ts
    useTaskSelectedHandler.ts
    useSkillSelectedHandler.ts
    useFileOpenedHandler.ts
    useCanvasOpenHandler.ts
    useBrunoRequestHandler.ts
    useTraceSelectedHandler.ts
    useDependencyGraphHandler.ts
```

**Estimated savings:** ~1,300 lines

---

### Phase 3: Extract Panel Registry

Create `src/renderer/dev-workspace/panels/panelRegistry.ts`:

```tsx
export function createPanelDefinitions(deps: PanelDependencies): PanelDefinition[] {
  return [
    createCanvasEditorPanel(deps),
    createStoryboardListPanel(deps),
    createFileCityPanel(deps),
    createDocsPanel(deps),
    createGitChangesPanel(deps),
    // ... etc
  ];
}
```

**Estimated savings:** ~700 lines

---

### Phase 4: Extract Tab State Management

Create `src/renderer/dev-workspace/hooks/useDevWorkspaceTabs.ts`:

```tsx
export function useDevWorkspaceTabs() {
  const [tabs, setTabs] = useState<DevWorkspaceTab[]>([]);
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const [associations, setAssociations] = useState<TabAssociations>({});

  const createTab = useCallback((tab: DevWorkspaceTab) => { ... }, []);
  const focusTab = useCallback((tabId: string) => { ... }, []);
  const closeTab = useCallback((tabId: string) => { ... }, []);

  return { tabs, focusTabId, associations, createTab, focusTab, closeTab };
}
```

**Estimated savings:** ~200 lines

---

### Phase 5: Extract Panel Collapse Logic

Create `src/renderer/dev-workspace/hooks/usePanelCollapse.ts`:

```tsx
export function usePanelCollapse({
  panelLayoutRef,
  collapsed,
  onCollapsedChange,
}: UsePanelCollapseParams) {
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  const [isRightCollapsed, setIsRightCollapsed] = useState(collapsed.right);
  // All collapse/expand handlers...
  return { isLeftCollapsed, isRightCollapsed, handleLeftCollapse, ... };
}
```

**Estimated savings:** ~150 lines

---

## Final Structure

```
src/renderer/dev-workspace/
  DevWorkspacePanelFramework.tsx    # ~500 lines (orchestration only)
  DevWorkspaceEvents.types.ts       # Existing

  hooks/
    useDevWorkspaceTabs.ts
    useDevWorkspaceEvents.ts
    usePanelCollapse.ts
    events/
      useDocOpenHandler.ts
      useTaskSelectedHandler.ts
      useSkillSelectedHandler.ts
      useFileOpenedHandler.ts
      useCanvasOpenHandler.ts
      // ... etc

  tab-content/
    index.ts
    types.ts
    TabContentWrapper.tsx
    SkillTabContent.tsx
    MarkdownTabContent.tsx
    // ... etc (15 files)

  panels/
    panelRegistry.ts
    definitions/
      canvasEditorPanel.ts
      storyboardListPanel.ts
      // ... etc
```

---

## Estimated Impact

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| Main component | 4,194 | ~500 | ~3,700 |
| Tab content renderers | inline | 15 files @ ~40 lines | Split out |
| Event handlers | inline | ~15 files @ ~80 lines | Split out |
| Panel registry | inline | ~25 files @ ~30 lines | Split out |

---

## Benefits

1. **Testability** - Each piece can be unit tested in isolation
2. **Maintainability** - Clear ownership per feature/tab type
3. **Performance** - Smaller dependency arrays = fewer re-renders
4. **Onboarding** - Easier for new devs to understand
5. **Extensibility** - Adding new tab types doesn't bloat the main file
6. **Code review** - Changes are isolated to relevant files

---

## Risks & Considerations

1. **Context threading** - Need to ensure context/actions/events are passed correctly
2. **Ref usage** - Current code uses refs to avoid stale closures; need to preserve this
3. **OTEL instrumentation** - Need to maintain tracing in extracted handlers
4. **Type safety** - Tab type discrimination needs careful handling in registry pattern

---

## Quick Wins (No Major Refactor)

If full refactor isn't feasible now:

1. **Remove console.info statements** - ~100 lines of debug logging
2. **Extract tab type interfaces** to `DevWorkspaceTab.types.ts` - ~160 lines
3. **Extract FileCityWithHighlights** to its own file - ~55 lines
4. **Remove duplicate OTEL boilerplate** - Create helper functions for span creation

---

## Recommended Approach

1. Start with Phase 1 (tab content) - lowest risk, highest visual impact
2. Add tests for extracted components before proceeding
3. Phase 2 (events) next - most complex but biggest win
4. Phase 3-5 can be done incrementally
