# Panel Framework Migration - Electron App Changes

**Date:** February 17, 2026
**Panel Framework Version:** v0.4.2 (electron-app) vs v0.3.0 (migration plan)
**Status:** ✅ **Good News - Minimal Changes Required!**

## Executive Summary

The electron app is **already compatible** with the new panel framework v0.3.0+ generic typing pattern. The app currently uses v0.4.2 of `@principal-ade/panel-framework-core`, which is ahead of the migration plan's target (v0.3.0).

**Key Finding:** The electron app already passes `context`, `actions`, and `events` separately to panel components, which is exactly what the new typed framework expects. No breaking changes required!

## Current State Analysis

### Panel Framework Version
```json
{
  "@principal-ade/panel-framework-core": "^0.4.2"  // Already on latest!
}
```

### Panel Package Versions (from npm list)

#### ✅ Already Migrated (using v0.3.0+ framework)
- `@industry-theme/alexandria-docs-panel@0.4.33` → uses framework v0.4.2 ✅
- `@industry-theme/file-city-panel@0.3.32` → uses framework v0.4.2 ✅
- `@industry-theme/markdown-panels@0.2.24` → uses framework v0.4.2 ✅
- `@industry-theme/principal-view-panels@0.10.35` → uses framework v0.4.2 ✅
- `@industry-theme/repository-composition-panels@0.6.6` → uses framework v0.4.2 ✅
- `@industry-theme/xterm-terminal-panel@0.3.18` → uses framework v0.4.2 ✅
- `@industry-theme/github-panels@0.1.60` → uses framework v0.3.0 ✅
- `@industry-theme/agent-panels@0.2.44` → uses framework v0.3.0 ✅

#### ⚠️ Still on Old Framework (v0.1.10 - needs migration)
- `@industry-theme/agent-driven-ui-panels@0.1.0`
- `@industry-theme/backlogmd-kanban-panel@1.0.40`
- `@industry-theme/file-editing-panels@0.3.18`
- `@industry-theme/ghostty-terminal-panel@0.1.18`
- `@industry-theme/git-sync-panels@0.1.4`
- `@industry-theme/localhost-panels@0.1.7`
- `@principal-ade/code-quality-panels@0.1.27`

#### 🔄 Mixed (uses v0.3.0 but could be updated)
- `@industry-theme/alexandria-panels@0.1.41` → uses framework v0.4.2 but package.json says ^0.3.0

## What the New Framework Expects

### Component Props Signature (v0.3.0+)
```typescript
interface PanelComponentProps<TActions extends PanelActions = PanelActions, TContext = {}> {
  /** Access to shared data and state */
  context: PanelContextValue<TContext>;
  /** Actions for interpanel communication */
  actions: TActions;
  /** Event system for panel-to-panel communication */
  events: PanelEventEmitter;
}
```

### Context Usage Patterns

**Old Way (still supported):**
```typescript
const Panel = ({ context }: PanelComponentProps) => {
  const gitStatus = context.getSlice<GitStatusData>('git-status');
  return <div>{gitStatus?.data}</div>;
};
```

**New Way (typed, recommended):**
```typescript
interface MyPanelContext {
  gitStatus: DataSlice<GitStatusData>;
  fileTree: DataSlice<FileTreeData>;
}

const Panel = ({ context }: PanelComponentProps<PanelActions, MyPanelContext>) => {
  const { gitStatus, fileTree } = context; // Direct typed access!
  return <div>{gitStatus?.data}</div>;
};
```

## Current Electron App Implementation

### ✅ Already Correct!

The electron app in `DevWorkspacePanelFramework.tsx` already uses the new pattern:

```typescript
// src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx:254-258
<FileCityPanelComponent
  context={fileCityPanelContext}
  actions={actions}
  events={events}
/>
```

**This is exactly what the new framework expects!** ✅

### Context Providers Already Structured Correctly

Looking at `RepositoryPanelContext.tsx`:
- ✅ Context, actions, and events are separate
- ✅ Context provides typed slices via `Map<string, DataSlice>`
- ✅ Context supports both direct access and `getSlice()` method
- ✅ Adapters are provided for file system operations

```typescript
// src/renderer/contexts/RepositoryPanelContext.tsx:78-83
interface RepositoryPanelProviderValue {
  context: RepositoryPanelContextValue;
  actions: RepositoryPanelActions;
  events: PanelEventEmitter;
}
```

## Required Changes

### 1. ✅ No Code Changes Required!

The electron app's panel integration code is **already compatible** with the new framework. No changes needed to:
- How panels are rendered
- How context is provided
- How actions are passed
- How events are handled

### 2. 🔄 Update Panel Package Versions (As They Get Migrated)

As individual panel packages are migrated to v0.3.0+, simply update them in `package.json`:

```bash
# When a panel is migrated, update it:
npm install @industry-theme/file-editing-panels@latest
npm install @industry-theme/ghostty-terminal-panel@latest
# etc...
```

### 3. 🔧 Clean Up Dependency Warnings

The `npm list` output shows version conflicts. Run after updating panels:

```bash
# Clean install to resolve peer dependency warnings
npm install
# Or force dedupe
npm dedupe
```

### 4. 💡 Optional: Add Typed Context Interfaces (Enhancement)

While not required, you could enhance type safety by defining context interfaces:

```typescript
// Example: Add to RepositoryPanelContext.tsx or a new types file
interface RepositoryPanelTypedContext {
  fileTree: DataSlice<FileTree>;
  gitStatusWithFiles: DataSlice<GitStatusWithFiles>;
  packages: DataSlice<PackagesSliceData>;
  quality: DataSlice<QualitySliceData>;
  // ... other slices
}

// Then use when rendering panels:
const FileEditorPanelComponent = fileEditingPanels.find(
  (p) => p.metadata?.id === 'industry-theme.file-editor',
)?.component as React.ComponentType<
  PanelComponentProps<FileManagementActions, RepositoryPanelTypedContext>
> | undefined;
```

But this is purely optional - the current implementation works fine!

## Migration Timeline for Electron App

According to the migration plan, panels are being migrated in groups:

### ✅ Already Done
- **GROUP 1 (File Management):** alexandria-docs ✅, markdown-panels ✅, code-quality-panels ⚠️
- **GROUP 4 (Visualization):** principal-view-panels ✅, file-city-panel ✅, repository-composition-panels ✅

### 🔄 In Progress / Not Started
- **GROUP 1:** file-editing-panels ⚠️, agent-panels ✅ (uses v0.3.0)
- **GROUP 2 (GitHub):** github-panels ✅, git-sync-panels ⚠️, alexandria-panels 🔄
- **GROUP 3 (Terminal):** xterm-terminal-panel ✅, ghostty-terminal-panel ⚠️
- **GROUP 5 (Event-Driven):** agent-driven-ui-panels ⚠️, localhost-panels ⚠️, backlogmd-kanban-panel ⚠️

### Electron App Action Items

For each panel group as it completes migration:

1. **Update package.json** with new version
2. **Run `npm install`** to pull the new panel package
3. **Run `npm dedupe`** to clean up dependency tree
4. **Test the panel** in the electron app
5. **No code changes needed** - just verify it works!

## Breaking Changes Analysis

### ❌ No Breaking Changes for Host Apps!

The panel framework maintains **100% backward compatibility**:

1. **Panels can still use `context.getSlice()`** - the old dynamic method still works
2. **Context structure unchanged** - `context`, `actions`, `events` are still separate
3. **Event system unchanged** - `PanelEventEmitter` interface is the same
4. **Actions interface extended** - new actions are added, old ones still work

### What Changed (Panel Authors Only)

These changes only affect panel developers, not host applications:

1. Panels can now define typed action interfaces
2. Panels can now define typed context interfaces
3. Panels can now use direct property access: `const { fileTree } = context;`
4. Panel metadata now includes `slices: string[]` to declare dependencies

**The electron app doesn't need to change for any of these!**

## Testing Strategy

### After Each Panel Update

1. **Visual Test:** Open the panel in the electron app
2. **Functional Test:** Verify panel features work (file opening, git status, etc.)
3. **Event Test:** Verify inter-panel communication still works
4. **Performance Test:** Check for any render performance regressions

### Regression Testing

Since the app is already on v0.4.2, there's low risk. But test:
- Panel loading and rendering
- Context slice access
- Action invocations
- Event emissions and listeners
- Panel-to-panel communication

## Reference Documents

### Migration Plan Location
The full migration plan is at:
```
/Users/griever/Developer/panels-core-packages/panel-framework/MIGRATION_PLAN_BY_GROUPS.md
```

### Context Providers Inventory
**NEW:** Detailed tracking of all context providers, slices, and actions:
```
docs/CONTEXT_PROVIDERS_INVENTORY.md
```

This inventory tracks:
- Which slices each context provider exposes
- Which actions each context provides
- Which panels use each context
- Migration status for each slice (direct property added or not)
- TODOs for completing the migration

## Summary Checklist

- ✅ Electron app is already compatible with new framework
- ✅ Context, actions, events are already passed correctly
- ✅ Panel integration code requires no changes
- 🔄 Update panel packages as they're migrated
- 💡 Optional: Add typed context interfaces for better IntelliSense
- 🔧 Run `npm dedupe` after updating panels to clean up warnings

## Questions?

If you encounter issues:

1. Check panel package version - is it using framework v0.3.0+?
2. Check npm warnings - are there peer dependency conflicts?
3. Check panel metadata - does it declare `slices` it depends on?
4. Check console errors - are there missing slices?

---

**Last Updated:** February 17, 2026
**Next Review:** After each panel package update
