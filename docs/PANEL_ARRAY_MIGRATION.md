# Panel Array Migration Guide

## Overview

This document tracks the migration from panel array access to direct component imports across the codebase. This migration avoids TypeScript type inference issues that occur when mixing desktop and web-only panels in the same array.

## Problem Statement

When using panel arrays with TypeScript, the type system infers a union type that requires ALL panel contexts to be present, even for panels that are mutually exclusive (e.g., web-only vs desktop-only). This causes type errors when desktop code tries to access panels that include web-only components.

**Example of the problem:**
```typescript
import { panels as workspacePanels } from '@industry-theme/alexandria-panels';

// TypeScript infers union type requiring ALL panel contexts
const LocalProjectsPanel = workspacePanels.find(
  (p) => p.metadata?.id === 'industry-theme.local-projects',
)?.component; // Type error: requires WorkspaceCollectionPanel context (web-only)
```

**Solution:**
```typescript
import { LocalProjectsPanel } from '@industry-theme/alexandria-panels';

// Direct import - no type inference issues
const LocalProjectsPanelComponent = LocalProjectsPanel;
```

## Migration Status

### ✅ Completed Migrations

#### AlexandriaWorkspaceLayout.tsx
- **File**: `src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx`
- **Converted**:
  - ✅ `FeedCodeCityPanel` (from `fileCityPanels`)
  - ✅ `EventBusPanel` (from `agentDrivenPanels`)
  - ✅ `AgentToolsPanel` (from `agentDrivenPanels`)
  - ✅ `MarkdownPanel` (from `markdownPanels`)
  - ✅ `CanvasEditorPanel` (from `principalViewPanels`)
  - ✅ `StoryboardListPanel` (from `principalViewPanels`)
  - ✅ `GitHubIssuesPanel` (from `githubPanels`)
  - ✅ `GitHubIssueDetailPanel` (from `githubPanels`)
  - ✅ `GitChangesPanel` (from `repositoryCompositionPanels`)
  - ✅ `PackageCompositionPanel` (from `repositoryCompositionPanels`)

#### DevWorkspacePanelFramework.tsx
- **File**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- **Converted**:
  - ✅ `CanvasEditorPanel` (from `principalViewPanels`)
  - ✅ `StoryboardListPanel` (from `principalViewPanels`)
  - ✅ `TraceListPanel` (from `principalViewPanels`)
  - ✅ `FeedCodeCityPanel` (from `fileCityPanels`)
  - ✅ `EventBusPanel` (from `agentDrivenPanels`)
  - ✅ `AgentToolsPanel` (from `agentDrivenPanels`)
  - ✅ `GitChangesPanel` (from `repositoryCompositionPanels`)
  - ✅ `PackageCompositionPanel` (from `repositoryCompositionPanels`)
  - ✅ `MarkdownPanel` (from `markdownPanels`)
  - ✅ `FileEditorPanel` (from `fileEditingPanels`)
  - ✅ `GitDiffPanel` (from `fileEditingPanels`)
  - ✅ `MDXEditorPanel` (from `fileEditingPanels`)
  - ✅ `GitHubIssuesPanel` (from `githubPanels`)
  - ✅ `GitHubIssueDetailPanel` (from `githubPanels`)

### ❌ Cannot Convert (Missing Exports)

The following packages need to export their panel components before migration can proceed:

#### @industry-theme/backlogmd-kanban-panel
**Status**: ❌ No component exports
**Current exports**: Only `panels` array
**Usage**:
- `AlexandriaWorkspaceLayout.tsx`: KanbanPanel, TaskDetailPanel, MilestonePanel
- `DevWorkspacePanelFramework.tsx`: KanbanPanel, TaskDetailPanel, MilestonePanel

**Action needed**: Add component exports to package
```typescript
// Needs to be added to package exports
export { KanbanPanel, TaskDetailPanel, MilestonePanel }
```

#### @industry-theme/localhost-panels
**Status**: ❌ No component exports
**Current exports**: Only `panels` array
**Usage**:
- `DevWorkspacePanelFramework.tsx`: LocalhostBrowserPanel

**Action needed**: Add component export to package
```typescript
// Needs to be added to package exports
export { LocalhostBrowserPanel }
```

#### @industry-theme/alexandria-docs-panel
**Status**: ❌ No component exports
**Current exports**: Only `panels` array
**Usage**:
- `AlexandriaWorkspaceLayout.tsx`: DocsPanel
- `DevWorkspacePanelFramework.tsx`: DocsPanel

**Action needed**: Add component export to package
```typescript
// Needs to be added to package exports
export { AlexandriaDocsPanel }
```

#### @principal-ade/code-quality-panels
**Status**: ❌ Package may not be installed / no exports verified
**Usage**:
- `AlexandriaWorkspaceLayout.tsx`: CodeQualityPanel
- `DevWorkspacePanelFramework.tsx`: CodeQualityPanel

**Action needed**: Verify package installation and add component export
```typescript
// Needs to be added to package exports
export { QualityHexagonPanel }
```

#### src/renderer/panels/TypeInformationPanel
**Status**: ❌ Local panel - component not exported
**Current exports**: Only `panels` array and `TypeInformationPanel` component, but no separate export
**Usage**:
- `DevWorkspacePanelFramework.tsx`: TypeInformationPanel

**Action needed**: Verify export in local index file
```typescript
// Should already be exported in index.tsx
export { TypeInformationPanel }
```

### ⚠️ Special Case: Metadata ID Lookups

Some packages export panel components but require metadata ID lookups to determine which specific panel to use. These are harder to convert without knowing the metadata mapping.

#### @industry-theme/agent-panels
**Status**: ⚠️ Exports components but uses metadata ID lookups
**Available exports**: `SkillsBrowsePanel`, `GlobalSkillsPanel`, `AgenticResourcesPanel`
**Usage patterns**:
- `industry-theme.skills-list` → Unknown mapping
- `industry-theme.skill-detail` → Unknown mapping
- `industry-theme.agents-list` → Unknown mapping
- `industry-theme.agent-detail` → Unknown mapping
- `industry-theme.agentic-resources` → Likely `AgenticResourcesPanel`

**Action needed**: Document metadata ID → component mapping or refactor to use direct imports

#### @industry-theme/principal-view-panels
**Status**: ⚠️ Partially converted - some panels still use metadata lookups
**Remaining lookups**:
- `principal-ai.trace-viewer` → Unknown component export
- `principal-ai.workflow-scenarios` → Unknown component export

**Action needed**: Verify if these panels have direct exports or need to be added

## Migration Checklist for Package Authors

If you maintain one of the packages that needs component exports added:

1. **Export panel components** in your main `index.ts` or `index.tsx`:
   ```typescript
   export { YourPanelComponent } from './panels/YourPanel';
   ```

2. **Update type exports** to include component props types:
   ```typescript
   export type { YourPanelProps } from './panels/YourPanel';
   ```

3. **Document metadata ID mappings** if your package has multiple panels:
   ```typescript
   /**
    * Panel metadata IDs:
    * - 'your-package.panel-one' → PanelOneComponent
    * - 'your-package.panel-two' → PanelTwoComponent
    */
   ```

4. **Test direct imports** work correctly:
   ```typescript
   import { YourPanelComponent } from 'your-package';
   ```

5. **Bump package version** and publish

## Files to Update After Package Migrations

Once the above packages add their component exports, update these files:

### AlexandriaWorkspaceLayout.tsx
```typescript
// Current - array access
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { panels as backlogPanels } from '@industry-theme/backlogmd-kanban-panel';
import { panels as codeQualityPanels } from '@principal-ade/code-quality-panels';

const DocsPanelComponent = docsPanels[0]?.component;
const KanbanPanelComponent = backlogPanels[0]?.component;
const CodeQualityPanelComponent = codeQualityPanels.find(...)?.component;

// After migration - direct imports
import { AlexandriaDocsPanel } from '@industry-theme/alexandria-docs-panel';
import { KanbanPanel, TaskDetailPanel, MilestonePanel } from '@industry-theme/backlogmd-kanban-panel';
import { QualityHexagonPanel } from '@principal-ade/code-quality-panels';

const DocsPanelComponent = AlexandriaDocsPanel;
const KanbanPanelComponent = KanbanPanel;
const CodeQualityPanelComponent = QualityHexagonPanel;
```

### DevWorkspacePanelFramework.tsx
```typescript
// Same pattern - convert from array access to direct imports
```

## Benefits of Migration

1. **Type Safety**: No more union type inference issues
2. **Performance**: Faster TypeScript compilation (no complex type inference)
3. **Clarity**: Explicit imports make dependencies clear
4. **Maintainability**: Easier to track which panels are used where
5. **Tree Shaking**: Better dead code elimination by bundlers

## Related Issues

- Original TypeScript error: "Property 'alexandriaRepositories' is missing in type"
- Root cause: WorkspaceCollectionPanel (web-only) in workspacePanels array
- Solution: Direct imports avoid mixed desktop/web panel type inference

## Last Updated

2026-02-20
