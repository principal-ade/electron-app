# Repository Panel System Migration Guide

This document summarizes the configurable panel architecture that now powers the Repository Explorer and Repository Manager surfaces. Use it as the reference when migrating existing panels or building new ones.

## Goals

- **Single source of truth for repository data.** Panels consume repository slices from a shared provider backed by `RepositoryDataCache`, eliminating duplicate polling and cache implementations.
- **Shared panel catalog.** Definitions for every configurable panel live in a single registry so the same panel can be reused across windows without copy/pasting IDs or JSX.
- **Composability across views.** Any surface can opt into the panel system by wrapping its layout with the provider and selecting the panels it wants from the registry.

## Directory Layout

```
src/renderer/panels/
├── RepositoryPanelProvider.tsx   # Context + hooks that expose repository slices
├── components/
│   └── GitChangesPanel.tsx       # Example of a shared panel implementation
└── registry.tsx                  # Canonical list of panel definitions
```

Related shared types live in `src/shared/types/repositoryPanel.types.ts`.

## RepositoryPanelProvider

`RepositoryPanelProvider` is the glue between views and cached repository data.

- Wrap any layout that needs configurable panels with the provider.
- Pass the active repository path and (optionally) an `initialData` payload from SSR or prefetches.
- Optionally provide `actions` like `openFile` so panels can trigger view-specific behaviors without bespoke props.
- Panels read slices through `useRepositoryPanelContext()`. Available properties include `repository`, `gitStatus`, `markdownFiles`, `fileTree`, `packages`, `quality`, and helper utilities like `hasSlice(slice)` and `refresh()`.

The provider is responsible for:

1. Subscribing to `useRepositoryData(repositoryPath)` so all panels share the same cache instance and updates.
2. Normalizing git status into the lightweight structure consumed by UI components.
3. Reporting loading state per slice, so panels can decide whether to show spinners or empty states.

## Panel Registry

The registry centralizes panel metadata in `repositoryPanelDefinitions`.

Each `RepositoryPanelDefinition` includes:

- `id`: Stable identifier used for persistence and analytics.
- `label` / `description`: Display text for configuration menus.
- `defaultLocation`: Suggested column (`left` or `right`).
- `slices`: The cache slices required by the panel (`'git'`, `'markdown'`, `'fileTree'`, `'packages'`, `'quality'`). The provider uses this to know what data must be loaded before a panel renders.
- `render`: Optional React renderer when the panel ships a default UI (e.g., `GitChangesPanel`). Layouts can omit `render` and embed their own bespoke component while still benefiting from centralized metadata.

Utility exports include:

- `getRepositoryPanelDefinition(id)` for lookup.
- `createDefaultPanelVisibility()` to seed preference stores.

### Adding a Panel

1. **Create the component** (if it has its own UI) under `src/renderer/panels/components/`. Use `useRepositoryPanelContext()` to read slices instead of wiring props from each host view.
2. **Register the panel** by appending to `repositoryPanelDefinitions` with the appropriate metadata and `slices` list. This keeps IDs consistent across all surfaces.
3. **Supply actions if needed.** When a panel needs callbacks (e.g., opening a file), access them via `context.actions` to stay decoupled from specific views.

## Using Panels Inside a View

1. **Wrap the layout** with `RepositoryPanelProvider`, passing `repositoryPath` and any shared `actions`.
2. **Choose panels** from `repositoryPanelDefinitions`. For example, the repository manager now includes the `gitChanges` panel in its tab list by referencing the registry entry instead of hardcoding JSX.
3. **Persist visibility/layout** using the shared preference helpers (`RepositoryPanelVisibility`, `createDefaultPanelVisibility()`) rather than view-specific lists.

## Migration Checklist

When converting an existing panel to the shared system:

- [ ] Move panel UI into `src/renderer/panels/components/` and switch data access to `useRepositoryPanelContext()`.
- [ ] Ensure any required repository slices are listed in the registry entry.
- [ ] Remove duplicated fetch/caching logic in the original view. The provider already streams updates from `RepositoryDataCache`.
- [ ] Update configuration menus or layout initializers to reference the registry rather than maintaining local arrays of panel IDs.
- [ ] Verify that shared `actions` (e.g., open file, focus diff view) are exposed through the provider so panels stay reusable.

## Frequently Asked Questions

**How do I show a panel in multiple windows?**
Select the same `RepositoryPanelDefinition` in each window’s layout configuration. Because both are wrapped in `RepositoryPanelProvider`, the panel component receives equivalent data.

**Can a panel lazy-load heavy data?**
Yes. Use `context.hasSlice('packages')` or `context.isSliceLoading('packages')` to decide when to fetch or display placeholders. If a panel needs additional data beyond the built-in slices, fetch it inside the panel component while keeping repository basics centralized.

**What about panels without a shared renderer?**
Define them in the registry without a `render` function. Host views can map the definition to their own UI component but still benefit from synchronized metadata, persistence, and slice declarations.

