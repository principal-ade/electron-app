# Repository Panel System Migration Guide

This document summarizes the configurable panel architecture that now powers the Repository Explorer and Repository Manager surfaces. Use it as the reference when migrating existing panels or building new ones.

## Goals

- **Single source of truth for repository data.** Panels consume repository slices from a shared provider backed by `RepositoryDataCache`, eliminating duplicate polling and cache implementations.
- **Shared panel catalog.** Definitions for every configurable panel live in a single registry so the same panel can be reused across windows without copy/pasting IDs or JSX.
- **Composability across views.** Any surface can opt into the panel system by wrapping its layout with the provider and selecting the panels it wants from the registry.

## Directory Layout

```
src/shared/panels/
└── repositoryPanelCatalog.ts     # Canonical metadata for every panel (no React)

src/renderer/panels/
├── RepositoryPanelProvider.tsx   # Context + hooks that expose repository slices
├── components/
│   └── GitChangesPanel.tsx       # Example of a shared panel implementation
└── registry.tsx                  # Attaches React renderers to the shared catalog
```

Shared types re-export the catalog definitions from
`src/shared/types/repositoryPanel.types.ts` so every environment consumes the
same literal metadata.

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

The shared catalog (`repositoryPanelCatalog`) centralizes panel metadata and is
extended in the renderer's `repositoryPanelDefinitions` with optional React
renderers.

Each `RepositoryPanelDefinition` includes:

- `id`: Stable identifier used for persistence and analytics.
- `label` / `description`: Display text for configuration menus.
- `surfaces`: Tags describing which host surfaces should surface the panel (e.g.,
  `explorer`, `manager`, `agent`). Configuration UIs can filter definitions by
  these tags instead of maintaining bespoke allow-lists.
- `slices`: The cache slices required by the panel (`'git'`, `'markdown'`, `'fileTree'`, `'packages'`, `'quality'`). The provider uses this to know what data must be loaded before a panel renders.
- `render`: Optional React renderer when the panel ships a default UI (e.g., `GitChangesPanel`). Renderers are attached in `src/renderer/panels/registry.tsx` so the shared catalog stays framework-agnostic. Layouts can omit `render` and embed their own bespoke component while still benefiting from centralized metadata.

Because the catalog is declared `as const`, TypeScript derives
`RepositoryPanelId` automatically from the metadata. Adding a panel only
requires touching the shared catalog entry (and optionally its renderer); the
shared type re-exports always stay in sync.

Utility exports include:

- `getRepositoryPanelDefinition(id)` for lookup.
- `getRepositoryPanelsForSurface(surface)` to filter definitions by tagged surface.
- `createDefaultPanelVisibility({ surfaces })` to seed preference stores without
  duplicating per-surface defaults.

### Adding a Panel

1. **Create the component** (if it has its own UI) under `src/renderer/panels/components/`. Use `useRepositoryPanelContext()` to read slices instead of wiring props from each host view.
2. **Register the panel** by appending to `repositoryPanelDefinitions` with the appropriate metadata, `surfaces`, and `slices` list. This keeps IDs consistent across all surfaces.
3. **Supply actions if needed.** When a panel needs callbacks (e.g., opening a file), access them via `context.actions` to stay decoupled from specific views.

## Using Panels Inside a View

1. **Wrap the layout** with `RepositoryPanelProvider`, passing `repositoryPath` and any shared `actions`.
2. **Choose panels** from `repositoryPanelDefinitions`. For example, the repository manager now includes the `gitChanges` panel in its tab list by referencing the registry entry instead of hardcoding JSX.
3. **Persist visibility/layout** using the shared preference helpers (`RepositoryPanelVisibility`, `createDefaultPanelVisibility({ surfaces })`) rather than view-specific lists.

## Migration Checklist

When converting an existing panel to the shared system:

- [ ] Move panel UI into `src/renderer/panels/components/` and switch data access to `useRepositoryPanelContext()`.
- [ ] Ensure any required repository slices are listed in the registry entry.
- [ ] Remove duplicated fetch/caching logic in the original view. The provider already streams updates from `RepositoryDataCache`.
- [ ] Update configuration menus or layout initializers to reference the registry rather than maintaining local arrays of panel IDs.
- [ ] Verify that shared `actions` (e.g., open file, focus diff view) are exposed through the provider so panels stay reusable.

## Tab vs Panel Variants

Many panels need to render differently depending on their context. A panel shown in a standalone card needs borders, headers, and padding. The same panel shown as tab content should skip those decorations and let the tab system control the chrome.

### Implementing Variant Support

Use a `variant` prop to support both contexts:

```typescript
interface PanelProps {
  variant?: 'panel' | 'tab';  // defaults to 'panel'
  // ... other props
}
```

**Panel variant** includes:
- Container with background color, border, and border radius
- Header with title and metadata (e.g., file count)
- Internal padding around content
- Self-contained card styling

**Tab variant** includes:
- No container wrapper or border
- No header (tab provides the label)
- Content only, with minimal or no padding
- Transparent background (parent controls styling)

### Example: GitChangesPanel

```typescript
// Panel variant - full card styling
<GitChangesPanel variant="panel" />

// Tab variant - content only
<GitChangesPanel variant="tab" />
```

The tab variant returns just the tree component without wrapper elements, allowing the tab container to control the overall appearance and background.

### Styling Considerations

For tab variants:
- Let the parent/tab system control background colors
- Remove internal padding or keep it minimal
- Omit headers and borders
- Consider using transparent backgrounds on nested components (pending dependency support for `transparentBackground` prop)

For panel variants:
- Include full card styling with borders and backgrounds
- Add headers with titles and metadata
- Use standard padding (typically 16px)
- Display as standalone, self-contained components

## Repository Manager Implementation

The Repository Manager now uses the `@a24z/panels` library's `ConfigurablePanelLayout` and `PanelConfigurator` components for a fully user-configurable layout system.

### Available Panels

The registry includes Repository Manager-specific panels:

- **`fileTree`** - File browser for navigating the repository structure
- **`search`** - Search files by name and content with advanced filtering
- **`gitChanges`** - Git changes panel (shared with Repository Explorer, uses `RepositoryPanelProvider`)
- **`dependencies`** - Package architecture and dependency relationships
- **`tools`** - Development tools and utilities
- **`docs`** - Documentation viewer for markdown and diagram files
- **`cityVisualization`** - Interactive code-city visualization (shared with Repository Explorer)
- **`terminal`** - Integrated terminal for repository commands

### Default Layout

```typescript
{
  left: {
    type: 'tabs',
    panels: ['fileTree', 'docs'],
    config: { defaultActiveTab: 0 }
  },
  middle: 'cityVisualization',
  right: {
    type: 'tabs',
    panels: ['search', 'gitChanges', 'dependencies', 'tools'],
    config: { defaultActiveTab: 0 }
  }
}
```

### User Configuration

Users can reconfigure the layout via the "Configure Panels" button in the titlebar, which opens a `PanelConfiguratorModal`. The configurator allows:

- **Assigning panels to slots** - Any panel can go in left, middle, or right slot
- **Creating tab groups** - Multiple panels can be grouped as tabs in a single slot
- **Creating tile layouts** - Panels can be split side-by-side (not yet implemented but supported by `@a24z/panels`)
- **Swapping slot contents** - Click two slots to swap their entire configuration

Layout preferences persist per repository.

### Panel Content Mapping

The `DevelopmentWorkspace` maintains a `panelContentMap` that maps panel IDs from the registry to their actual React components. This approach:

1. Keeps panel content definitions centralized
2. Allows the `ConfigurablePanelLayout` to render any combination of panels
3. Supports dependency injection for panel props
4. Maintains type safety through the registry

Example:
```typescript
const panelContentMap: Record<string, React.ReactNode> = {
  fileTree: <FileTreeTab fileTree={fileTree} onFileSelect={handleFileSelect} />,
  search: <RepositorySearchTab fileTrees={fileTrees} onFileSelect={handleFileSelect} />,
  gitChanges: (
    <RepositoryPanelProvider repositoryPath={repoPath} actions={{ openFile }}>
      <GitChangesPanel variant="tab" />
    </RepositoryPanelProvider>
  ),
  // ... other panels
};
```

## Frequently Asked Questions

**How do I show a panel in multiple windows?**
Select the same `RepositoryPanelDefinition` in each window's layout configuration. Because both are wrapped in `RepositoryPanelProvider`, the panel component receives equivalent data.

**Can a panel lazy-load heavy data?**
Yes. Use `context.hasSlice('packages')` or `context.isSliceLoading('packages')` to decide when to fetch or display placeholders. If a panel needs additional data beyond the built-in slices, fetch it inside the panel component while keeping repository basics centralized.

**What about panels without a shared renderer?**
Define them in the registry without a `render` function. Host views can map the definition to their own UI component but still benefit from synchronized metadata, persistence, and slice declarations. This is the current approach for Repository Manager panels, where the registry defines metadata but `DevelopmentWorkspace` provides the actual component implementations.

**How does the PanelConfigurator work with tabs?**
The `@a24z/panels@1.0.14` library supports creating `PanelGroup` objects with `type: 'tabs'`. Users can assign multiple panels to a single slot as a tab group. The configurator UI allows dragging panels between slots and automatically creates/updates tab groups. Layout state persists using the `PanelLayout` type from `@a24z/panels`.

