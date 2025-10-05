# Monaco Migration Audit

We are migrating from our bespoke Monaco integration to the industry-themed Monaco editor. This document collects the legacy components and the product surfaces that still depend on them so we can plan the remaining work.

## Components tied to the legacy Monaco implementation

- **FileViewer** (`src/renderer/components/FileViewer.tsx`)
  - Embeds `@monaco-editor/react`, configures `window.MonacoEnvironment`, Vim mode, custom theme, TypeScript defaults, and cancellation-error suppression. Remove once the new editor replaces it.
- **DiffViewer** (`src/renderer/components/DiffViewer.tsx`)
  - Wraps Monaco’s `DiffEditor` with worker configuration, theme setup, git-aware content loading, and language detection. Migrate to the new diff support or retire if superseded.
- **ThemedMonaco** (`src/renderer/components/shared/ThemedMonaco.tsx`)
  - Lightweight wrapper around `@monaco-editor/react` plus manual worker setup that becomes redundant after the migration.
- **MarkdownDocumentViewer** (`src/renderer/repo-manager/shared/MarkdownDocumentViewer.tsx`)
  - Still imports the legacy `ThemedMonaco` for edit mode, so the view must be updated to use the new editor provider.
- **MonacoEditorErrorBoundary** (`src/renderer/components/MonacoEditorErrorBoundary.tsx`)
  - Suppresses Monaco cancellation errors; remove when the new editor handles errors internally.
- **monacoErrorSuppressor** (`src/renderer/utils/monacoErrorSuppressor.ts`)
  - Global overrides that hide Monaco “Canceled” errors. These are unnecessary after the migration.
- **Renderer bootstrap hooks** (`src/renderer/index.tsx`)
  - Adds window-level listeners that filter Monaco cancellation errors; simplify or delete with the new editor integration.
- **Main-process protocol registration** (`src/main/main.ts`)
  - Registers the custom `app-asset://` scheme for Monaco worker bundles; reassess when the new package provides asset handling.

## Product surfaces that rely on the legacy components

### FileViewer stack
- Multi-file editor window tabs (currently disabled) depend on `FilePanel`, which switches between `FileViewer` and `DiffViewer`.
- Agent configuration surfaces use `WatchingFileViewer`, which delegates to `FileViewer` for editing hooks and MCP files.
- Repository Manager’s “open file” modal streams remote content into `FileViewer`, and the repository exploration view launches that modal.
- The standalone Store Viewer window renders JSON through `FileViewer` in read-only mode.
- Agent-overview timeline popouts include side-by-side `FileViewer` instances for event inspection.

### DiffViewer
- Git-aware diffs inside the multi-file editor use the Monaco `DiffEditor` wrapper, so diffs must migrate alongside the editor swap.

### Markdown editing surfaces
- `MarkdownDocumentViewer` toggles the legacy `ThemedMonaco` for edit mode.
- Markdown search results, Repository Manager’s document tab, and the standalone Markdown window all transitively depend on `ThemedMonaco`.

### Error suppression & infrastructure
- `MonacoEditorErrorBoundary` wraps every `FileViewer` render to swallow cancellation exceptions.
- `monacoErrorSuppressor` patches Promises, console methods, and timers globally for the entire renderer bundle.
- The renderer bootstrap still installs global `error`/`unhandledrejection` filters keyed to Monaco cancellation messages.
- The main process registers the `app-asset://` protocol so bundled Monaco workers can load in every window.

## Immediate mitigation

- The multi-file editor window now displays an alert explaining that it has been disabled during the Monaco migration so that no surface silently fails.
