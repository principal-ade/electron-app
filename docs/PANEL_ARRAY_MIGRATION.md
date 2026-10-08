# Panel Array Migration Guide

## Overview

Use direct component imports when a panel package exports them. This avoids
TypeScript inferring a union of every panel context in a package's panel array,
including contexts that a particular host cannot provide.

## Problem

Panel arrays can mix components with different context requirements. Looking up a
component from the array may make TypeScript require the union of all those
contexts, even when the host only renders one panel at a time.

```typescript
import { panels } from 'panel-package';

const PanelComponent = panels.find(
  (panel) => panel.metadata?.id === 'package.panel',
)?.component;
```

When available, import the component directly instead:

```typescript
import { PanelComponent } from 'panel-package';
```

## Dev Workspace

The Dev Workspace uses direct imports for panels whose packages expose
components. When changing panel registration:

1. Prefer named component exports over looking up a component in a `panels`
   array.
2. Keep metadata-ID lookups only when a package does not expose a direct
   component export.
3. Verify the component's context and actions match the host before adding it.
4. If an export is missing, request it from the package maintainers and keep
   the existing registration until the export is available.

Some panel packages still expose only a `panels` array, so not every lookup can
be replaced locally.

## Benefits

- Avoids confusing union-context type errors.
- Makes panel dependencies explicit.
- Can reduce unnecessary package imports during bundling.

## Package Author Checklist

1. Export panel components from the package entry point.
2. Export the corresponding props types.
3. Document metadata ID to component mappings when a package has multiple
   panels.
4. Test that consumers can import the component directly.
5. Publish a package version containing the export.
