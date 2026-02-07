# Panel Context Reactivity Pattern

## Problem Summary

When panels receive `context` via refs (`contextRef.current`), React cannot detect when the data inside context changes (like fileTree, git status, etc.). This breaks auto-reload functionality when files change externally.

### Root Cause

```typescript
// ❌ PROBLEM: Ref always returns same object reference
const contextRef = useRef(context);
contextRef.current = context;

<PanelComponent context={contextRef.current} />  // React sees same ref every time

// Inside panel's useMemo/useEffect:
useMemo(() => {
  const fileTree = context.getSlice('fileTree');
  // ...
}, [context]);  // Never re-runs because context ref never changes!
```

Even when the fileTree data changes, React's dependency tracking sees the same context object reference and doesn't re-run effects or memos.

## Solution: Hybrid Approach

### Pattern Overview

**Pass to panels:**
- ✅ `context` - Direct value (reactive to data changes)
- ✅ `actions` - Via ref (stable function interface)
- ✅ `events` - Via ref (stable event emitter)

### Implementation

#### In Panel Framework (DevWorkspacePanelFramework.tsx)

```typescript
// Keep refs for stable interfaces
const actionsRef = useRef(actions);
const eventsRef = useRef(events);
actionsRef.current = actions;
eventsRef.current = events;

// Pass to panels
<PanelComponent
  context={context}              // ✅ Direct - for data reactivity
  actions={actionsRef.current}   // ✅ Ref - stable API
  events={eventsRef.current}     // ✅ Ref - stable emitter
/>

// Update dependency array
useCallback(
  (tab) => {
    // ... render logic
  },
  [theme, context, ...otherDeps]  // Include context since we use it directly
);
```

#### In Panel Component (Library Code)

**Option 1: Extract Specific Data (Recommended)**
```typescript
// Extract only what you need to detect changes
const fileTreeSha = useMemo(() => {
  const slice = context.getSlice('fileTree');
  const data = slice?.data as FileTree | null;
  return data?.sha || null;
}, [context]);

// Use internal refs for accessing latest data without re-renders
const contextRef = useRef(context);
const actionsRef = useRef(actions);
const eventsRef = useRef(events);
contextRef.current = context;
actionsRef.current = actions;
eventsRef.current = events;

// Effect depends on extracted value
useEffect(() => {
  // Use contextRef.current to get fresh data
  const ctx = contextRef.current;
  const slice = ctx.getSlice('fileTree');
  // ... work with data
}, [fileTreeSha]);  // Triggers when SHA changes
```

**Option 2: Direct Context (Simpler but more re-renders)**
```typescript
// Just use context directly in effects
useEffect(() => {
  const slice = context.getSlice('fileTree');
  // ... work with data
}, [context]);  // Triggers when context changes
```

## Why This Works

1. **Direct `context` prop** - Component receives new object reference when data changes
2. **Extract change indicator** - `useMemo` extracts SHA/timestamp that React can track
3. **Internal refs** - Access latest data without triggering re-renders
4. **Effect dependencies** - Depend on extracted value, not context reference

## Panels to Review

### Current Status

| Panel | Library Package | Uses Context Data? | Status | Notes |
|-------|----------------|-------------------|--------|-------|
| **Principal View Panels** (`@industry-theme/principal-view-panels`) |
| CanvasEditorPanel | `@industry-theme/principal-view-panels` | ✅ Yes (fileTree) | ✅ Fixed | Auto-reloads on file changes |
| TraceViewerPanel | `@industry-theme/principal-view-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses traces slice |
| CanvasDetailPanel | `@industry-theme/principal-view-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Shows .otel.canvas with narratives |
| StoryboardListPanel | `@industry-theme/principal-view-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses fileTree |
| TraceListPanel | `@industry-theme/principal-view-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses traces slice |
| TraceDetailsPanel | `@industry-theme/principal-view-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses traces slice |
| **File Editing Panels** (`@industry-theme/file-editing-panels`) |
| FileEditorPanel | `@industry-theme/file-editing-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Should reload if file changes externally |
| GitDiffPanel | `@industry-theme/file-editing-panels` | ✅ Yes (git status) | ⚠️ Needs Review | Needs git status changes |
| MDXEditorPanel | `@industry-theme/file-editing-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Should reload if MDX file changes |
| **File Visualization** |
| FileCityPanel | `@industry-theme/file-city-panel` | ✅ Yes (fileTree) | ⚠️ Needs Review | Visualizes file tree |
| **Markdown Panels** (`@industry-theme/markdown-panels`) |
| MarkdownPanel | `@industry-theme/markdown-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Should reload if markdown file changes |
| **Repository Composition** (`@industry-theme/repository-composition-panels`) |
| GitChangesPanel | `@industry-theme/repository-composition-panels` | ✅ Yes (git status) | ⚠️ Needs Review | Shows working directory changes |
| PackageCompositionPanel | `@industry-theme/repository-composition-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Shows package structure |
| **Code Quality** (`@principal-ade/code-quality-panels`) |
| CodeQualityPanel | `@principal-ade/code-quality-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses quality data slice |
| **Backlog/Kanban** (`@industry-theme/backlogmd-kanban-panel`) |
| KanbanPanel | `@industry-theme/backlogmd-kanban-panel` | ✅ Yes (fileTree) | ⚠️ Needs Review | Loads BACKLOG.md file |
| TaskDetailPanel | `@industry-theme/backlogmd-kanban-panel` | ✅ Yes (fileTree) | ⚠️ Needs Review | Shows task from BACKLOG.md |
| MilestonePanel | `@industry-theme/backlogmd-kanban-panel` | ✅ Yes (fileTree) | ⚠️ Needs Review | Shows milestones from BACKLOG.md |
| **Agent Panels** (`@industry-theme/agent-panels`) |
| SkillsListPanel | `@industry-theme/agent-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Lists skills from filesystem |
| SkillDetailPanel | `@industry-theme/agent-panels` | ✅ Yes (fileTree) | ⚠️ Needs Review | Shows skill file details |
| AgentsListPanel | `@industry-theme/agent-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses agent data |
| AgentDetailPanel | `@industry-theme/agent-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses agent data |
| AgenticResourcesPanel | `@industry-theme/agent-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses resource data |
| **Alexandria/Documentation** |
| DocsPanel | `@industry-theme/alexandria-docs-panel` | ✅ Yes (fileTree) | ⚠️ Needs Review | Shows documentation files |
| LocalProjectsPanel | `@industry-theme/alexandria-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses project data |
| **GitHub Panels** (`@industry-theme/github-panels`) |
| GitHubIssuesPanel | `@industry-theme/github-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses github data slice |
| GitHubIssueDetailPanel | `@industry-theme/github-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses github data slice |
| **Localhost/Browser** (`@industry-theme/localhost-panels`) |
| LocalhostBrowserPanel | `@industry-theme/localhost-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses localhost data |
| **Agent-Driven UI** (`@industry-theme/agent-driven-ui-panels`) |
| EventBusPanel | `@industry-theme/agent-driven-ui-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses event data |
| AgentToolsPanel | `@industry-theme/agent-driven-ui-panels` | ⚠️ TBD | ⚠️ Needs Review | Check if uses tool data |
| **Type Information** (Built-in) |
| TypeInformationPanel | Built-in (`src/renderer/panels/`) | ⚠️ TBD | ⚠️ Needs Review | Check if uses type data |

### Priority for Review

**🔴 High Priority (File-based panels - likely affected):**
1. FileEditorPanel - Users edit files
2. MarkdownPanel - Views markdown files
3. MDXEditorPanel - Edits MDX files
4. GitDiffPanel - Shows file diffs
5. FileCityPanel - Visualizes file tree
6. CanvasDetailPanel - Shows canvas files
7. DocsPanel - Shows documentation files

**🟡 Medium Priority (Data-based panels):**
1. GitChangesPanel - Git working directory
2. KanbanPanel - BACKLOG.md based
3. SkillDetailPanel - Skill files
4. PackageCompositionPanel - Package structure
5. CodeQualityPanel - Quality metrics

**🟢 Lower Priority (External/static data):**
1. TraceViewerPanel - OTEL traces
2. GitHubIssuesPanel - GitHub API
3. LocalhostBrowserPanel - Browser preview
4. EventBusPanel - Event monitoring
5. TypeInformationPanel - Type info

### Summary by Library

**Total Panels: 30+**

| Library Package | Panel Count | Status |
|----------------|-------------|--------|
| `@industry-theme/principal-view-panels` | 6 | 1/6 Fixed |
| `@industry-theme/file-editing-panels` | 3 | 0/3 Fixed |
| `@industry-theme/file-city-panel` | 1 | 0/1 Fixed |
| `@industry-theme/markdown-panels` | 1 | 0/1 Fixed |
| `@industry-theme/repository-composition-panels` | 2 | 0/2 Fixed |
| `@principal-ade/code-quality-panels` | 1 | 0/1 Fixed |
| `@industry-theme/backlogmd-kanban-panel` | 3 | 0/3 Fixed |
| `@industry-theme/agent-panels` | 5 | 0/5 Fixed |
| `@industry-theme/alexandria-docs-panel` | 1 | 0/1 Fixed |
| `@industry-theme/alexandria-panels` | 1 | 0/1 Fixed |
| `@industry-theme/github-panels` | 2 | 0/2 Fixed |
| `@industry-theme/localhost-panels` | 1 | 0/1 Fixed |
| `@industry-theme/agent-driven-ui-panels` | 2 | 0/2 Fixed |
| Built-in panels | 1 | 0/1 Fixed |
| **TOTAL** | **30** | **1/30 Fixed** |

### Review Checklist for Each Panel

For each panel, answer these questions:

#### 1. Does the panel use dynamic context data?
- [ ] FileTree slice (`context.getSlice('fileTree')`)
- [ ] Git status slice (`context.getSlice('gitStatus')`)
- [ ] Traces slice (`context.getSlice('traces')`)
- [ ] Other slices?

#### 2. Should the panel react to data changes?
- [ ] Should auto-reload when files change?
- [ ] Should update when git status changes?
- [ ] Should refresh when external data changes?

#### 3. How is context currently received?
- [ ] Via `contextRef.current` (needs fix)
- [ ] Via direct `context` prop (already correct)

#### 4. Implementation approach
- [ ] **Option A**: Extract specific indicator (SHA, timestamp) - Best for performance
- [ ] **Option B**: Use context directly - Simpler but more re-renders

## Testing Protocol

After updating each panel:

### 1. In Panel Library
```bash
cd /path/to/panel-library
# Make changes to panel component
bun run build
npm version patch
npm publish
```

### 2. In Desktop App
```bash
cd /Users/griever/Developer/desktop-app/electron-app
# Update package.json version
npm install
```

### 3. Update DevWorkspacePanelFramework
```typescript
// Change from:
<PanelComponent
  context={contextRef.current}
  actions={actionsRef.current}
  events={eventsRef.current}
/>

// To:
<PanelComponent
  context={context}
  actions={actionsRef.current}
  events={eventsRef.current}
/>
```

### 4. Manual Testing
1. Open panel in desktop app
2. Edit the file/data the panel displays using external editor
3. Save changes
4. Verify panel auto-reloads without manual refresh

### 5. Validation Test
Create a test file with obvious change (add "TEST" to label/text):
```bash
# Make a change
echo "// TEST CHANGE" >> test-file

# Panel should auto-reload and show the change
```

## Common Patterns by Panel Type

### File-Based Panels (FileEditor, Markdown, Canvas)

**What to extract:**
```typescript
const fileTreeSha = useMemo(() => {
  const slice = context.getSlice('fileTree');
  return slice?.data?.sha || null;
}, [context]);
```

**What to detect:**
- File content changes
- File additions/deletions
- File timestamp updates

### Git-Based Panels (GitDiff, GitSync)

**What to extract:**
```typescript
const gitStatusSha = useMemo(() => {
  const slice = context.getSlice('gitStatus');
  return slice?.data?.sha || null;
}, [context]);
```

**What to detect:**
- Working directory changes
- Staging area changes
- Commit history updates

### Data-Based Panels (Traces, Metrics)

**What to extract:**
```typescript
const dataVersion = useMemo(() => {
  const slice = context.getSlice('traces');
  return slice?.data?.version || Date.now();
}, [context]);
```

**What to detect:**
- New data arrivals
- Data refreshes
- Real-time updates

## Performance Considerations

### Why Hybrid (Not Full Direct Props)?

**Direct context:**
- ✅ Detects data changes
- ❌ May cause unnecessary re-renders when unrelated data changes

**Ref for actions/events:**
- ✅ Never causes re-renders (stable reference)
- ✅ Always up-to-date via `.current`
- ❌ Can't trigger effects (but we don't need them to)

**Best of both:**
- Direct `context` for reactive data
- Refs for stable APIs
- Extract specific values to minimize re-renders

### Optimization Tips

1. **Extract minimal change indicators** - SHA, timestamp, count
2. **Use internal refs** - Access latest context without dependencies
3. **Memoize expensive computations** - Based on extracted values
4. **Debounce rapid changes** - If needed for performance

## Example: Canvas Editor Panel (Reference Implementation)

### Panel Component (Library)
```typescript
export const CanvasEditorPanel: React.FC<CanvasEditorPanelProps> = ({
  context,
  actions,
  events,
  canvasPath,
  // ... other props
}) => {
  // Store in refs for stable access
  const contextRef = useRef(context);
  const actionsRef = useRef(actions);
  const eventsRef = useRef(events);
  contextRef.current = context;
  actionsRef.current = actions;
  eventsRef.current = events;

  // Extract fileTree SHA to detect changes
  const fileTreeSha = useMemo(() => {
    const slice = context.getSlice('fileTree');
    const data = slice?.data as FileTree | null;
    return data?.sha || null;
  }, [context]);

  // Effect triggers when SHA changes
  useEffect(() => {
    if (!canvasPath || !fileTreeSha) return;

    // Use ref to get fresh data
    const ctx = contextRef.current;
    const slice = ctx.getSlice('fileTree');
    const data = slice?.data as FileTree | null;

    // Check if file changed and reload
    // ...
  }, [fileTreeSha, canvasPath, loadConfiguration]);
};
```

### Framework Integration
```typescript
// DevWorkspacePanelFramework.tsx
<CanvasEditorPanelComponent
  context={context}              // Direct for reactivity
  actions={actionsRef.current}   // Ref for stability
  events={eventsRef.current}     // Ref for stability
  canvasPath={canvasEditorTab.canvasPath}
  canvasName={canvasEditorTab.canvasName}
/>
```

## Migration Checklist

### @industry-theme/principal-view-panels (6 panels)
- [x] CanvasEditorPanel - Fixed and tested (v0.10.10)
- [ ] TraceViewerPanel - Needs review
- [ ] CanvasDetailPanel - Needs review
- [ ] StoryboardListPanel - Needs review
- [ ] TraceListPanel - Needs review
- [ ] TraceDetailsPanel - Needs review

### @industry-theme/file-editing-panels (3 panels)
- [ ] FileEditorPanel - Needs review
- [ ] GitDiffPanel - Needs review
- [ ] MDXEditorPanel - Needs review

### @industry-theme/file-city-panel (1 panel)
- [ ] FileCityPanel - Needs review

### @industry-theme/markdown-panels (1 panel)
- [ ] MarkdownPanel - Needs review

### @industry-theme/repository-composition-panels (2 panels)
- [ ] GitChangesPanel - Needs review
- [ ] PackageCompositionPanel - Needs review

### @principal-ade/code-quality-panels (1 panel)
- [ ] CodeQualityPanel - Needs review

### @industry-theme/backlogmd-kanban-panel (3 panels)
- [ ] KanbanPanel - Needs review
- [ ] TaskDetailPanel - Needs review
- [ ] MilestonePanel - Needs review

### @industry-theme/agent-panels (5 panels)
- [ ] SkillsListPanel - Needs review
- [ ] SkillDetailPanel - Needs review
- [ ] AgentsListPanel - Needs review
- [ ] AgentDetailPanel - Needs review
- [ ] AgenticResourcesPanel - Needs review

### @industry-theme/alexandria-docs-panel (1 panel)
- [ ] DocsPanel - Needs review

### @industry-theme/alexandria-panels (1 panel)
- [ ] LocalProjectsPanel - Needs review

### @industry-theme/github-panels (2 panels)
- [ ] GitHubIssuesPanel - Needs review
- [ ] GitHubIssueDetailPanel - Needs review

### @industry-theme/localhost-panels (1 panel)
- [ ] LocalhostBrowserPanel - Needs review

### @industry-theme/agent-driven-ui-panels (2 panels)
- [ ] EventBusPanel - Needs review
- [ ] AgentToolsPanel - Needs review

### Built-in panels (1 panel)
- [ ] TypeInformationPanel - Needs review

**Progress: 1/30 panels reviewed and fixed (3%)**

## Questions to Consider

1. Should all panels auto-reload, or just file-based panels?
2. Should we add a `autoReload` prop to disable this behavior?
3. Should we debounce file change events for panels?
4. Do we need a loading indicator during auto-reload?

## Related Files

- Panel implementations: `/Users/griever/Developer/visual-validation/industry-themed-principal-view-panels/src/panels/`
- Framework integration: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- Context provider: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx`

## References

- Original fix commit: `9526b6c` - "Fix fileTree reactivity with surgical SHA extraction"
- Published version: `@industry-theme/principal-view-panels@0.10.10`
