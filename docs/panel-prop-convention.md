# Panel Prop Convention (electron-app)

**Status:** Living doc — panel convention issues / known exceptions
**Tracked by topic:** "Panel Convention Tracking" (`topic-1780331634638-sag3bvaly`)
**Sibling doc:** `web-ade/docs/panel-prop-convention.md`

## The convention

Every panel is driven by **exactly three structured inputs**: `context`, `actions`, `events`. These come from `@principal-ade/panel-framework-core` and are bundled by `PanelProvider` as `PanelProviderValue` (`src/renderer/contexts/PanelContext.tsx:213`):

- **`context`** — `ExtendedPanelContextValue extends PanelContextValue` (`PanelContext.tsx:163`). State plus typed `DataSlice` accessors (`activeFile`, `fileTree`, `git`, `markdown`, `alexandriaRepositories`, `workspace`, `terminal`, …).
- **`actions`** — `ExtendedPanelActions extends PanelActions` (`PanelContext.tsx:58`). Async operations: terminal lifecycle, workspace mutation, `readFile`, `setActiveFile`, …
- **`events`** — `PanelEventEmitter` (a `PanelEventBus`). Pub/sub between panels.

**The rule:** a panel's props interface should be `{ context, actions?, events }` and nothing else. When a panel needs extra data, it should **narrow `context`** with its own `…PanelContext extends PanelContextValue` — e.g. `RecentRepositoriesPanelContext` (`src/renderer/panels/recent-repositories/RecentRepositoriesPanel.tsx:312`) — rather than adding sibling props.

## Why a 4th prop is a problem here

electron-app slots panels into **configurable** hosts (e.g. `WorkspacePanelComponent`, the left workspace slot in `AlexandriaWorkspaceLayout.tsx`). Any panel can be configured into that slot. The host passes the standard triad; it does not know about panel-specific props.

The framework does **not** validate props — TypeScript and React destructuring are the only enforcement. So:

- An **undeclared** extra prop is silently dropped: no error, the feature just doesn't work when that panel is hosted in a generic slot.
- A **declared-but-nonstandard** prop widens the panel's contract beyond the convention, so the panel only works where that specific prop is threaded — it's no longer freely configurable.

The convention-pure fix for cross-cutting data is to carry it through `context` (a slice or value), not a sibling prop.

## Known exceptions / deviations

### `activeTerminalRepoPath` — a 4th prop on the workspace slot
*(Currently in the working tree, not yet merged.)*

- `AlexandriaWorkspaceLayout.tsx:605` computes which repo's terminal tab is visible.
- It is passed as a 4th prop to the configurable left panel: `AlexandriaWorkspaceLayout.tsx:1343` → `<WorkspacePanelComponent context={…} actions={…} events={…} activeTerminalRepoPath={…} />`.
- `RecentRepositoriesPanel.tsx:318-328` declares `activeTerminalRepoPath?: string | null` to receive it, then threads it to each `RepositoryCard` (`isActiveTerminal`).

This works because the slot currently always renders `RecentRepositoriesPanel`, but it breaks the configurability contract: a different panel in that slot would silently ignore the prop. **Candidate to migrate into `context`.**

### `activeFile` slice is mandatory for `@industry-theme` panels
`context.activeFile: DataSlice<ActiveFileSlice>` (`PanelContext.tsx:190`) and the `setActiveFile` action look unused locally but **cannot be removed** — third-party panels (`@industry-theme/file-editing-panels`, `@industry-theme/xterm-terminal-panel`, …) require them as part of the context contract.

## Related existing docs

- `docs/panel-architecture.md`, `docs/panel-implementation-guide.md` — broader panel architecture.
- `docs/PANEL_EVENTS_HANDLED_BY_HOST.md` — host-side event handling.
- `docs/PANEL_FRAMEWORK_MIGRATION_ELECTRON_APP.md`, `docs/PANEL_ARRAY_MIGRATION.md` — framework migration history.

This doc is scoped specifically to the **prop contract** (context/actions/events) and its exceptions; see the above for architecture/events/migration detail.
