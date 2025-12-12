# Panel Framework Type Compatibility Feedback

**Date:** 2025-11-14
**Context:** Integration of `@a24z/alexandria-workspace-panel` and `@principal-ade/industry-themed-terminal-panel` in electron-app
**Status:** Functional with workarounds, type standardization needed

---

## Summary

While integrating multiple panel packages into the Alexandria Workspace view, we discovered that different panel packages define incompatible `PanelContextValue` interfaces, preventing seamless type-safe integration.

## The Problem

### Three Different Type Definitions

**1. `@principal-ade/panel-framework-core` (v0.1.2)**
```typescript
// Uses data slices pattern
export interface PanelContextValue {
  currentScope: {
    type: 'workspace' | 'repository';
    workspace?: WorkspaceMetadata;
    repository?: RepositoryMetadata;
  };
  slices: ReadonlyMap<string, DataSlice>;
  getSlice<T>(name: string): DataSlice<T> | undefined;
  getWorkspaceSlice<T>(name: string): DataSlice<T> | undefined;
  getRepositorySlice<T>(name: string): DataSlice<T> | undefined;
  hasSlice(name: string, scope?: 'workspace' | 'repository'): boolean;
  isSliceLoading(name: string, scope?: 'workspace' | 'repository'): boolean;
  refresh(scope?: 'workspace' | 'repository', slice?: string): Promise<void>;
}
```

**2. `@principal-ade/industry-themed-terminal-panel` (v0.1.0)**
```typescript
// Redefines PanelContextValue with direct properties
export interface PanelContextValue {
  repositoryPath: string | null;
  repository: RepositoryMetadata | null;
  gitStatus: GitStatus;
  gitStatusLoading: boolean;
  markdownFiles: MarkdownFile[];
  fileTree: FileTree | null;
  packages: PackageLayer[] | null;
  quality: QualityMetrics | null;
  terminalSessions?: TerminalSessionInfo[];
  loading: boolean;
  refresh: () => Promise<void>;
  hasSlice: (slice: PanelDataSlice) => boolean;
  isSliceLoading: (slice: PanelDataSlice) => boolean;
}
```

**3. `@a24z/alexandria-workspace-panel` (v1.0.0)**
```typescript
// Re-exports from framework core (good!)
export type { PanelContextValue } from '@principal-ade/panel-framework-core';

// But extends with workspace-specific actions
export interface PanelActions extends FrameworkPanelActions {
  removeRepositoryFromWorkspace?(repositoryId: string, workspaceId: string): Promise<void>;
  copyToClipboard?(text: string): Promise<void>;
}
```

### Impact

When a host application tries to use multiple panels together:

```typescript
// TypeScript error:
// Type 'FrameworkPanelContextValue' is not assignable to type 'TerminalPanelContextValue'
<TerminalPanel context={context} actions={actions} events={events} />
<WorkspacePanel context={context} actions={actions} events={events} />
```

Host applications must either:
- Use type assertions (`as never`) to bypass type checking
- Create separate context instances for each panel type
- Implement adapters to bridge the differences

## Recommendations

### Option A: Framework Core as Single Source of Truth (Preferred)

**Action Items:**

1. **@principal-ade/panel-framework-core**
   - Becomes the canonical definition for all panel types
   - Consider supporting both patterns during migration:
     ```typescript
     export interface PanelContextValue {
       // Data slices pattern (new)
       currentScope: { ... };
       slices: ReadonlyMap<string, DataSlice>;
       getSlice<T>(name: string): DataSlice<T> | undefined;
       // ... other slice methods

       // Direct access pattern (backward compatibility)
       repositoryPath: string | null;
       repository: RepositoryMetadata | null;
       gitStatus: GitStatus;
       // ... other direct properties
     }
     ```

2. **@principal-ade/industry-themed-terminal-panel**
   - Remove custom `PanelContextValue` definition from `dist/types/index.d.ts`
   - Import from framework core:
     ```typescript
     import type { PanelContextValue } from '@principal-ade/panel-framework-core';
     ```
   - Update panel implementation to use data slices:
     ```typescript
     // Before
     const { gitStatus } = context;

     // After
     const gitStatus = context.getSlice<GitStatus>('git')?.data;
     ```

3. **@a24z/alexandria-workspace-panel**
   - Already importing from framework core ✅
   - Verify no assumptions about direct property access
   - Document extended `PanelActions` clearly

### Option B: Dual-Pattern Support (Interim Solution)

If immediate breaking changes aren't feasible:

1. Framework core provides both patterns
2. Panels declare which pattern they use via metadata
3. Host applications adapt context based on panel requirements
4. Deprecation timeline for direct property access (6-12 months)

### Option C: Adapter Pattern (Not Recommended)

Each panel package could provide adapters, but this:
- Increases maintenance burden
- Fragments the ecosystem
- Defeats the purpose of a unified framework

## Current Workaround

In `electron-app`, we've implemented:

```typescript
// Extended context that provides both patterns
interface ExtendedPanelContextValue extends PanelContextValue {
  // Framework pattern
  currentScope: { ... };
  slices: Map<string, DataSlice>;
  // ... slice methods

  // Direct access pattern
  repositoryPath: string | null;
  gitStatus: GitStatus;
  // ... other properties
}

// Type assertions to bypass incompatibilities
<TerminalPanel
  context={context as never}
  actions={actions as never}
  events={events as never}
/>
```

This works functionally but loses type safety.

## Testing Requirements

Once alignment is achieved, host applications should be able to:

```typescript
import { panels as terminalPanels } from '@principal-ade/industry-themed-terminal-panel';
import { panels as workspacePanels } from '@a24z/alexandria-workspace-panel';

const { context, actions, events } = usePanelProvider();

// Should work without type assertions
<TerminalPanel context={context} actions={actions} events={events} />
<WorkspacePanel context={context} actions={actions} events={events} />
```

## Migration Path (If Option A)

### Phase 1: Framework Update
1. Update `@principal-ade/panel-framework-core` to support dual pattern
2. Publish as minor version (e.g., v0.2.0)
3. Update documentation with migration guide

### Phase 2: Panel Updates
1. Update terminal panel to use framework types
2. Update any other panels with custom definitions
3. Test integration in host applications

### Phase 3: Deprecation
1. Mark direct property access as deprecated
2. Provide migration timeline (suggest 6 months)
3. Add console warnings for deprecated usage

### Phase 4: Cleanup
1. Remove direct property support
2. Publish as major version (v1.0.0)
3. Update all panel packages

## Questions for Teams

1. **Framework Core Team:**
   - Is dual-pattern support acceptable during migration?
   - What's the preferred timeline for breaking changes?
   - Can we add runtime validation to help migrations?

2. **Terminal Panel Team:**
   - What's the impact of migrating to data slices pattern?
   - Are there performance concerns with the slice pattern?
   - Can you identify any missing functionality in framework core?

3. **Workspace Panel Team:**
   - Does your panel work with pure framework core types?
   - What additional properties/actions do you require?
   - Can these be standardized across panels?

## Additional Context

**Integration Location:** `electron-app/src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx`

**Related Files:**
- `electron-app/src/renderer/contexts/PanelContext.tsx` - Host context implementation
- `node_modules/@principal-ade/panel-framework-core/dist/src/types/panel.types.d.ts` - Framework types
- `node_modules/@principal-ade/industry-themed-terminal-panel/dist/types/index.d.ts` - Terminal types

**npm versions:**
```json
{
  "@principal-ade/panel-framework-core": "^0.1.2",
  "@principal-ade/panel-layouts": "^0.1.4",
  "@principal-ade/industry-themed-terminal-panel": "^0.1.0",
  "@a24z/alexandria-workspace-panel": "^1.0.0"
}
```

## Contact

For questions or clarifications, please reach out via the appropriate team channels.

---

**This is early feedback as requested.** We're excited about the panel framework and want to help ensure a consistent developer experience across the ecosystem!
