# Proposal: Single Source of Truth for Panel Metadata

## Problem Statement

Panel metadata (icons, labels, descriptions) is currently duplicated across multiple files, leading to:

1. **Maintenance burden**: Changing a panel icon requires editing 3-4 files
2. **Inconsistencies**: Icons can differ between tabs, headers, and previews
3. **Developer confusion**: No clear "source of truth" for panel definitions
4. **Bug-prone**: Easy to miss updating one location (as demonstrated by the agent panels all showing the same icon)

### Current Architecture: 4+ Sources of Truth

```
repositoryPanelCatalog.ts      → id, label, description, surfaces
panelPreviews.tsx              → icon, preview component
RepositoryWorkspace.tsx        → icon (again!), visibility logic
Individual Panel Components    → icon (again!!), in headers
```

### Example of Duplication

For the "Agent Events" panel:

**File 1: `repositoryPanelCatalog.ts`**
```typescript
{
  id: 'agentEvents',
  label: 'Agent Events',
  description: 'Live stream of agent actions with repository file context.',
  surfaces: ['manager', 'agent'] as const,
}
```

**File 2: `panelPreviews.tsx`**
```typescript
agentEvents: {
  icon: <Activity size={16} />,
  preview: <AgentEventsPanelPreview />,
  label: 'Agent Events',  // DUPLICATE
  description: 'Live stream of agent actions...',  // DUPLICATE
}
```

**File 3: `RepositoryWorkspace.tsx`**
```typescript
{
  id: 'agentEvents',
  label: 'Agent Events',  // DUPLICATE
  icon: <Activity size={14} />,  // DUPLICATE (different size!)
  visible: true,
  content: panelContentMap.agentEvents,
}
```

**File 4: `AgentEventsPanel.tsx`**
```tsx
<Activity size={16} style={{ color: theme.colors.primary }} />  // DUPLICATE
<span>Agent Events</span>  // DUPLICATE
```

## Proposed Solution

### Phase 1: Consolidate Panel Metadata (Recommended Starting Point)

Make `repositoryPanelCatalog.ts` the single source of truth by adding all metadata there.

#### 1.1 Update the Catalog Schema

```typescript
// src/shared/panels/repositoryPanelCatalog.ts

export interface RepositoryPanelIcon {
  component: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  defaultSize?: number;
}

export interface RepositoryPanelDefinitionBase {
  id: string;
  label: string;
  description?: string;
  icon: RepositoryPanelIcon;  // NEW: Add icon to catalog
  surfaces: readonly RepositoryPanelSurface[];
  slices?: readonly RepositoryPanelSlice[];
  previewComponent?: React.ComponentType;  // NEW: Add preview component reference
}

// Example definition
import { Activity, Layers, FolderOpen } from 'lucide-react';

export const repositoryPanelCatalog = [
  {
    id: 'agentEvents',
    label: 'Agent Events',
    description: 'Live stream of agent actions with repository file context.',
    icon: { component: Activity, defaultSize: 16 },
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'agentSessions',
    label: 'Agent Sessions',
    description: 'Summaries of recent agent activity grouped by session.',
    icon: { component: Layers, defaultSize: 16 },
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'agentContext',
    label: 'Agent Context',
    description: 'View files accessed by agent sessions organized in a multi-tree view.',
    icon: { component: FolderOpen, defaultSize: 16 },
    surfaces: ['agent'] as const,
  },
  // ... other panels
] as const satisfies readonly RepositoryPanelDefinitionBase[];
```

#### 1.2 Create a Helper to Get Panel Metadata

```typescript
// src/shared/panels/repositoryPanelCatalog.ts

export function getPanelDefinition(id: RepositoryPanelId): RepositoryPanelDefinitionBase {
  const definition = repositoryPanelCatalog.find(p => p.id === id);
  if (!definition) {
    throw new Error(`Panel definition not found: ${id}`);
  }
  return definition;
}

export function getPanelIcon(
  id: RepositoryPanelId,
  size?: number,
  style?: React.CSSProperties
): React.ReactNode {
  const definition = getPanelDefinition(id);
  const IconComponent = definition.icon.component;
  return <IconComponent size={size ?? definition.icon.defaultSize} style={style} />;
}
```

#### 1.3 Update panelPreviews.tsx to Use Catalog

```typescript
// src/renderer/panels/panelPreviews.tsx

import { repositoryPanelCatalog, getPanelIcon } from '../../shared/panels/repositoryPanelCatalog';
import { AgentEventsPanelPreview } from './components/AgentEventsPanel';
// ... other imports

// Build preview registry from catalog
export const panelPreviewRegistry: Record<string, PanelPreviewMetadata> = {
  agentEvents: {
    icon: getPanelIcon('agentEvents'),
    preview: <AgentEventsPanelPreview />,
    // label and description come from catalog, no need to duplicate
  },
  agentSessions: {
    icon: getPanelIcon('agentSessions'),
    preview: <AgentSessionsPanelPreview />,
  },
  // ... etc
};

// Or even better, generate it programmatically:
const previewComponents: Record<RepositoryPanelId, React.ComponentType> = {
  agentEvents: AgentEventsPanelPreview,
  agentSessions: AgentSessionsPanelPreview,
  agentContext: AgentContextTreePanelPreview,
  // ... etc
};

export const panelPreviewRegistry = Object.fromEntries(
  repositoryPanelCatalog.map(panel => [
    panel.id,
    {
      icon: getPanelIcon(panel.id),
      preview: React.createElement(previewComponents[panel.id]),
      label: panel.label,
      description: panel.description,
    }
  ])
);
```

#### 1.4 Update RepositoryWorkspace.tsx to Use Catalog

```typescript
// src/renderer/repo-manager/RepositoryWorkspace.tsx

import { getPanelDefinition, getPanelIcon } from '../../shared/panels/repositoryPanelCatalog';

// Instead of hardcoding icon and label:
const leftPanels: PanelDefinitionWithContent[] = [
  {
    id: 'agentEvents',
    label: getPanelDefinition('agentEvents').label,  // From catalog
    icon: getPanelIcon('agentEvents', 14),           // From catalog
    visible: true,
    content: panelContentMap.agentEvents,
  },
  // ... etc
];

// Or even better, generate from catalog:
const leftPanels: PanelDefinitionWithContent[] = [
  'agentEvents',
  'agentSessions',
  'agentContext',
  // ... etc
].map(id => {
  const definition = getPanelDefinition(id);
  return {
    id,
    label: definition.label,
    icon: getPanelIcon(id, 14),
    visible: shouldPanelBeVisible(id, selectedSource, repoInfo),
    content: panelContentMap[id],
  };
});
```

#### 1.5 Update Panel Component Headers to Use Catalog

```typescript
// src/renderer/panels/components/AgentEventsPanel.tsx

import { getPanelDefinition, getPanelIcon } from '../../../shared/panels/repositoryPanelCatalog';

// Instead of hardcoding:
<Activity size={16} style={{ color: theme.colors.primary }} />
<span>Agent Events</span>

// Use catalog:
{getPanelIcon('agentEvents', 16, { color: theme.colors.primary })}
<span>{getPanelDefinition('agentEvents').label}</span>
```

### Phase 2: Advanced Improvements (Optional)

#### 2.1 Panel Component Self-Registration

Instead of maintaining separate lists, panels could register themselves:

```typescript
// src/renderer/panels/components/AgentEventsPanel.tsx

export const AgentEventsPanel = createPanel({
  id: 'agentEvents',  // References catalog entry
  component: AgentEventsPanelImpl,
});

// The createPanel helper automatically:
// - Gets metadata from catalog
// - Adds consistent header/footer
// - Handles visibility logic
```

#### 2.2 Type-Safe Panel Configuration

```typescript
// Generate types from catalog for compile-time safety
export type RepositoryPanelId = typeof repositoryPanelCatalog[number]['id'];

// TypeScript will error if you reference a non-existent panel
getPanelIcon('nonexistentPanel');  // ❌ Type error
```

## Benefits

### Developer Experience
- ✅ **One place to update**: Change icon/label/description in one file
- ✅ **Self-documenting**: Catalog serves as panel registry
- ✅ **Type-safe**: TypeScript ensures you don't reference invalid panels
- ✅ **Consistent**: Impossible to have mismatched icons/labels

### Code Quality
- ✅ **DRY compliance**: No duplication of panel metadata
- ✅ **Easier testing**: Single source makes mocking simpler
- ✅ **Better maintainability**: Less code, fewer bugs
- ✅ **Clearer architecture**: Obvious where to look for panel config

### Performance
- ✅ **Minimal impact**: Helper functions are simple lookups
- ✅ **Tree-shakeable**: Unused icons won't be bundled
- ✅ **No runtime overhead**: Metadata is static

## Migration Strategy

### Step 1: Extend the Catalog (Low Risk)
1. Add `icon` field to `RepositoryPanelDefinitionBase`
2. Populate icons in `repositoryPanelCatalog`
3. Create `getPanelIcon()` helper
4. **No breaking changes yet** - existing code still works

### Step 2: Migrate Consumers (Incremental)
1. Update `panelPreviews.tsx` to use catalog
2. Update `RepositoryWorkspace.tsx` to use catalog
3. Update individual panel components to use catalog
4. **Each file can be migrated independently**

### Step 3: Cleanup (Low Risk)
1. Remove duplicate metadata from old locations
2. Add ESLint rule to prevent future hardcoding
3. Document the pattern in CONTRIBUTING.md

### Estimated Effort
- **Phase 1**: ~4-6 hours (1 developer)
  - Update catalog schema: 30 min
  - Create helper functions: 30 min
  - Migrate panelPreviews.tsx: 1 hour
  - Migrate RepositoryWorkspace.tsx: 1 hour
  - Migrate panel components: 2-3 hours (20+ panels)
  - Testing: 1 hour

- **Phase 2** (optional): ~2-3 hours
  - Panel self-registration system
  - Documentation updates

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes during migration | Medium | Migrate incrementally, add both old/new for transition period |
| Performance regression | Low | Helper functions are simple lookups, negligible overhead |
| Icon sizing inconsistencies | Low | Catalog includes `defaultSize`, contexts can override |
| React Server Components compatibility | Low | Icons are client-side only, already handled |

## Alternative Approaches Considered

### Alternative 1: Keep Current System
**Pros**: No migration effort
**Cons**: Problem persists, will get worse as panels are added

### Alternative 2: Code Generation
Generate panel definitions from a JSON/YAML file at build time.
**Pros**: Extremely DRY, could generate TypeScript types too
**Cons**: More complex, harder to debug, adds build step

### Alternative 3: Runtime Registry Pattern
Panels register themselves on module load.
**Pros**: Very flexible, plugin-like architecture
**Cons**: Harder to tree-shake, runtime overhead, more complex

## Recommendation

**Implement Phase 1** of the proposed solution:

1. **Low risk**: Incremental migration, no breaking changes required
2. **High value**: Solves the immediate maintenance problem
3. **Good foundation**: Sets up architecture for future improvements
4. **Reasonable effort**: Can be done in a single sprint

Phase 2 can be evaluated later based on team needs and priorities.

## References

- Current bug: Agent panels all showing `Activity` icon (fixed manually in 3+ files)
- Related files:
  - `/src/shared/panels/repositoryPanelCatalog.ts`
  - `/src/renderer/panels/panelPreviews.tsx`
  - `/src/renderer/repo-manager/RepositoryWorkspace.tsx`
  - `/src/renderer/panels/components/Agent*.tsx`

## Open Questions

1. Should panel components continue to show their own headers, or should the layout system handle that?
2. Do we want to support panel-specific theming in the catalog?
3. Should visibility logic live in the catalog or stay in RepositoryWorkspace.tsx?
4. Do we need to support dynamic panel registration for plugins/extensions?

---

**Author**: Claude Code
**Date**: 2025-10-25
**Status**: Proposal (Pending Review)
