# Panel Prop Convention (electron-app)

**Status:** Living doc — panel convention issues / known exceptions
**Tracked by topic:** "Panel Convention Tracking" (`topic-1780331634638-sag3bvaly`)
**Sibling doc:** `web-ade/docs/panel-prop-convention.md`

## The convention

Every panel is driven by **exactly three structured inputs**: `context`, `actions`, `events`. These come from `@principal-ade/panel-framework-core` and are bundled by `RepositoryPanelProvider` as `RepositoryPanelProviderValue` (`src/renderer/contexts/RepositoryPanelContext.tsx`):

- **`context`** — `RepositoryPanelContextValue extends PanelContextValue`. State plus typed `DataSlice` properties (`activeFile`, `fileTree`, `gitStatusWithFiles`, `markdown`, `alexandriaRepositories`, `workspace`, …).
- **`actions`** — `RepositoryPanelActions extends PanelActions`. Async operations: `readFile`, `writeFile`, `setActiveFile`, repository registration, …
- **`events`** — `PanelEventEmitter` (a `PanelEventBus`). Pub/sub between panels.

Terminal state and lifecycle actions are supplied separately by `TerminalProvider` (`src/renderer/contexts/TerminalContext.tsx`). Dev Workspace mounts both providers in `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`. The former workspace-wide `PanelProvider` was retired with Alexandria Workspace.

**The rule:** a panel's props interface should be `{ context, actions?, events }` and nothing else. When a panel needs extra data, it should **narrow `context`** with its own `…PanelContext extends PanelContextValue` — e.g. `RecentRepositoriesPanelContext` (`src/renderer/panels/recent-repositories/RecentRepositoriesPanel.tsx:312`) — rather than adding sibling props.

## Why a 4th prop is a problem here

electron-app slots panels into **configurable** hosts such as the Dev Workspace panel framework. A panel can be configured into a host slot. The host passes the standard triad; it does not know about panel-specific props.

The framework does **not** validate props — TypeScript and React destructuring are the only enforcement. So:

- An **undeclared** extra prop is silently dropped: no error, the feature just doesn't work when that panel is hosted in a generic slot.
- A **declared-but-nonstandard** prop widens the panel's contract beyond the convention, so the panel only works where that specific prop is threaded — it's no longer freely configurable.

The convention-pure fix for cross-cutting data is to carry it through `context` (a slice or value), not a sibling prop.

## Known exceptions / deviations

### `activeFile` slice is mandatory for `@industry-theme` panels
`context.activeFile: DataSlice<ActiveFileSlice>` and the `setActiveFile` action in `RepositoryPanelContext.tsx` **must be preserved** — third-party panels (`@industry-theme/file-editing-panels`, …) require them as part of the context contract.

## Related existing docs

- `docs/panel-architecture.md`, `docs/panel-implementation-guide.md` — broader panel architecture.
- `docs/PANEL_EVENTS_HANDLED_BY_HOST.md` — host-side event handling.
- `docs/PANEL_FRAMEWORK_MIGRATION_ELECTRON_APP.md` — framework migration history.

This doc is scoped specifically to the **prop contract** (context/actions/events) and its exceptions; see the above for architecture/events/migration detail.
