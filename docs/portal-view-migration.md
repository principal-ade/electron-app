# Migrating a view into the WorkspaceShell

How to fold a principal-window workspace surface (Projects, Trails, …) into the
persistent **`WorkspaceShell`** — the one host that owns a single
tabbed-terminal panel, one terminal scope, and a left-panel slot that swaps by
`activeView`. This is the repeatable playbook behind Increment 3; the worked
example is **3a** (Inbox + Topics, commit `6cdeb57f1`).

Read this alongside [`portal-unification.md`](./portal-unification.md) (the
design + increment plan). This doc is the *how*, that one is the *why*.

## Key files

| File | Role |
| --- | --- |
| `src/renderer/workspace-shell/WorkspaceShell.tsx` | The persistent host. Owns the terminal scope, the unified `renderTabContent`/`renderTabIcon`, and the left-panel slot. |
| `src/renderer/principal-window/PortalTabsContext.tsx` | The tab state. `useWorkspaceTabs()` is the shared Inbox+Topics bucket; `useProjectsTabs()` is still separate until 3b. |
| `src/renderer/principal-window/components/PortalIntentBridge.tsx` | The always-mounted listener. Routes `trail:open` / `topic:open` / `doc:open` intents (by `surface`) into the right bucket. |
| `src/renderer/principal-window/components/PrincipalPortal/PrincipalPortal.tsx` | Mounts the shell. One `<WorkspaceShell>` instance for all the surfaces it hosts. |
| `src/renderer/events/portalTabs.ts` | The shared tab-type interfaces + (after migration) the surface's tab types. |
| `src/renderer/events/portalIntents.ts` | The open-intent contract (`emitTrailOpen`/`emitTopicOpen`/`emitDocOpen`, the `surface` field). |

## The invariants — don't break these

These are *why* the architecture is shaped the way it is. A migration that
violates one will compile but misbehave.

1. **One shell instance, mounted for all its surfaces.** Persistence comes from
   React keeping the *same* `WorkspaceShell` element mounted while `activeView`
   changes. In `PrincipalPortal`, host the surfaces with a single element:
   `{(view === 'inbox' || view === 'topics') && <WorkspaceShell activeView={view} />}`.
   A separate `{view === 'x' && <WorkspaceShell .../>}` per surface remounts on
   every switch and loses tabs + terminal.
2. **One terminal scope.** The shell wraps everything in a single
   `<TerminalProvider terminalContext="terminal:workspace">`. Don't add a
   per-surface scope back.
3. **Open-intent emitters publish on the portal bus; tab-opening side-effects
   live in the always-mounted listener.** A left panel (or tab content) that
   wants to open a tab emits a `*:open` intent on the **portal bus**
   (`usePortalEvents()`), carrying a `surface`. The *only* thing that turns
   intents into tabs is `PortalIntentBridge`. This is non-negotiable because a
   tab opened from surface A can be acted on while surface B's left panel is
   showing — a per-view listener would be unmounted and miss the event.
4. **Tab content emits intra-tab events on the host's *local* bus.** The shell
   creates one `PanelEventBus` (`events`) for terminal links + within-tab
   chatter (file opens inside a trail, etc.). That's separate from the portal
   bus, which is only for cross-surface open-intents.
5. **`renderTabContent` reads data through refs.** The shell keeps
   `eventsRef`/`repositoriesRef` updated each render so the
   `renderTabContent`/`renderTabIcon` `useCallback`s stay stable (an unstable
   callback thrashes the tab panel).

## The steps (in order)

### 1. Inventory the surface

List, from the view + its `*PanelFramework`:
- **Tab types** it renders (the `contentType`s in its `renderTabContent`).
- **Open-intent emitters** — left panel rows, tab-content actions, titlebar
  hooks — and what each opens.
- **Tab-opening side-effects** — every `events.on(...)` subscription that ends
  in "open a tab / modal" (Projects has ~13; Inbox/Topics had ~0 left, already
  done in 2c).
- **Data the tabs/left-panel need** — `repositories`, action objects, feed/
  heatmap state, etc. These become host-level concerns.

### 2. Decouple emitters onto the portal bus

Every place that opens a tab should `emit*Open(portalEvents, source, { …,
surface: '<surface>' })` from `events/portalIntents.ts` instead of calling a
tab-context method or emitting on a per-view bus. Add the surface to
`PortalSurface` if it's new.

### 3. Rehome tab-opening side-effects to `PortalIntentBridge`

Move the subscriptions from step 1 (the `events.on(...)` → open-tab handlers)
into `PortalIntentBridge` (or a sibling always-mounted listener it composes).
They must fire regardless of which left panel is currently mounted. Modals are
the awkward case — a delete-confirm modal that today lives in the framework
needs an always-mounted home too (a small modal host under `PortalTabsProvider`).

### 4. Merge the tab bucket

In `PortalTabsContext.tsx`:
- Move the surface's tab-type interfaces into `events/portalTabs.ts` and add
  them to the `WorkspaceTab` union.
- Add the surface's `open*` methods to `useWorkspaceTabsValue` (idempotent —
  dedup by tab id, then focus).
- If the surface had its own bucket/hook, repoint its compat hook at the shared
  bucket (as `useInboxTabs`/`useTopicsTabs` do), or delete it if nothing else
  consumes it.

### 5. Render the tabs in the shell

Extend `WorkspaceShell`'s `renderTabContent` + `renderTabIcon` with the new
`contentType`s. Supply any data they need (`repositories` is already loaded in
the shell; new deps — action objects, etc. — get created at the host level and
read via refs). Keep each case a thin delegation to the existing
`*TabContent`/`*Panel` component.

### 6. Add the left panel to the swappable slot

Add the surface to the `activeView` type and the left-panel branch in the
shell's `allPanels` memo. Feed the left panel **`portalEvents`** for its
open-intents, plus whatever host-owned data it needs (compute it in the shell).

### 7. Wire `PrincipalPortal`

Add the surface to the single `<WorkspaceShell>` mount condition (invariant 1).
Remove its standalone `{view === 'x' && <XView/>}` line.

### 8. Delete the dead view + framework

Once nothing renders them, delete `XView.tsx` + `XView/index.ts` +
`XPanelFramework.tsx`. Relocate any types they exported (step 4 already moved the
tab types). Grep for stale references — most are comments; fix the ones that
name the deleted files.

### 9. Verify

- `npx tsc --build` and `npx eslint <changed files>` green (the pre-commit hook
  runs both; the repo has 14 pre-existing warnings — add none).
- Commit to `main` with the `Co-Authored-By` trailer.
- **Dev-build checklist:** switch into/out of the surface keeps tabs + terminal;
  every open path (left panel, tab-content actions, titlebar, MCP bridge) lands
  a tab in the shared host; the terminal is workspace-wide. The `:3044` app is
  production — don't restart it; the human runs the dev build.

## Worked example — 3a (Inbox + Topics)

`6cdeb57f1`. Inbox + Topics were already portal-bus-clean after Increment 2c
(steps 2–3 were no-ops), so the migration was steps 4–8: merge the two buckets
into `useWorkspaceTabs`, build `WorkspaceShell` with a 7-case `renderTabContent`,
swap the left panel by `activeView`, host one instance for both in
`PrincipalPortal`, and delete the four dead files (their 4 tab types moved to
`portalTabs.ts`).

## Per-surface notes

- **Projects (3b) — the hard migration.** It's the reason Increment 3 was split.
  It carries an Alexandria + GitHub `repositories` load, ~13 bus subscriptions
  that open tabs/modals, and activity-feed / heatmap / delete-modal state — none
  on the portal bus yet. So steps 2–3 are real work (not no-ops like 3a): decouple
  ~13 emitters, rehome their handlers + the delete modal to always-mounted homes,
  then steps 4–8 to host its ~13 tab types + the Projects left panel (which needs
  `feedMode`/`commits`/`selectedBlock`/`activityCommits` computed at host level).
- **Trails (Increment 4) — build-new, not migrate.** Per the design, Trails is a
  *new* cross-repo panelized surface (All-Maps default tab + `trail:open` /
  `map:open`), not a reskin of today's `TrailsView`. Author it against these
  invariants from the start — emit intents on the portal bus, add a `MapTab`
  variant to `WorkspaceTab`, render in the shell — rather than migrating the
  monolith in place.
- **Skills & Drawings — overlay→surface variant (fast-follow).** These are
  standalone *overlays* today, not `*PanelFramework` views, so there's less to
  decouple but they must first become workspace surfaces (a left panel + tab
  types) before steps 4–8 apply.
