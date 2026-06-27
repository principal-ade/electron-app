# Portal Unification — History & Background

> Superseded snapshots, landed-work history, and the code-inventory analysis
> behind the principal-window unification. **This doc is not the plan.** For the
> live intended design + migration checklist see
> [`portal-unification.md`](./portal-unification.md); the topic
> ("Unify principal-window views into one shell",
> `topic-1781729349467-vwfz5bjwv`) holds the brief, status, and open questions.
>
> Kept because the analysis (especially the panel inventory) is still useful
> reference, and because the dated snapshots explain *why* the current design
> looks the way it does.

## Current state snapshot (as of 2026-06-17)

The codebase was already half-way to the target when this work started:

- **Tab renderers were already shared.** `inbox-view` and `topics-view` both
  import `SharedTrailTabContent`, `LocalTrailTabContent`, and
  `MarkdownDocTabContent` from `projects-view`. The right-side content was
  already view-agnostic. (See the bundled markdown-panel trail — one
  `MarkdownPanel` reused by all three surfaces.)

What was still siloed — the actual work:

- **3 event buses.** Each view did `const events = useMemo(() => new
  PanelEventBus(), [])`, so isolation came from the *instance*, not any
  namespace. A global `principalEvents` bus (`PrincipalEventContext`) also
  existed for cross-view/titlebar wiring.
- **3 tab-state contexts.** `ProjectsTabsContext`, `InboxTabsContext`,
  `TopicsTabsContext` each held tab state, each already lifted *above* the
  conditional `{activeView === '…' && <View/>}` mount.
- **3 frameworks.** `ProjectsPanelFramework`, `InboxPanelFramework`,
  `TopicsPanelFramework` — nearly identical `ConfigurablePanelLayout` shells
  differing mainly in their left panel.

## Already landed — prep work

Done before the unification increments, to clear the path:

- **`feed` → `projects` rename.** View id `'feed'`→`'projects'`,
  `FeedView`→`ProjectsView`, `FeedPanelFramework`→`ProjectsPanelFramework`,
  `FeedLeftPanel`→`ProjectsLeftPanel`, `FeedTabsContext`→`ProjectsTabsContext`,
  dirs `feed-view/`→`projects-view/` and `views/FeedView/`→`views/ProjectsView/`.
  Legacy pref `'feed'` migrates to `'projects'`.
- **`feed:*` event namespace → domain/intent names** (`repository:selected`,
  `owner:selected`, `collection:selected`, `activity:*`), aligning with the
  pre-existing `repository:opened`/`repository:updated` house style. Payload type
  `FeedRepositorySelectedPayload`→`RepositorySelectedPayload`, file
  `events/feedRepositorySelected.ts`→`events/repositorySelected.ts`.

- **Slice #1 — `PrincipalPortal` as the always-mounted base layer** (commit
  `5f89783c7` on `main`). `PrincipalPortal`
  (`principal-window/components/PrincipalPortal/`) became the always-mounted base
  hosting the workspace surfaces (Projects/Inbox/Topics/Trails).
  `IntegratedShell` stopped mounting views via a flat conditional ladder — it
  derives `overlayView = isWorkspaceView(activeView) ? null : activeView` and
  renders the standalone views (Home, Settings, Monitor, Auth, Processes,
  Connections, Skills, Drawings, Onboarding) as an opaque overlay
  (`position:absolute; inset:0; zIndex:2`) on top of the portal. A
  `lastWorkspaceView` state (starts `null`, tracked via effect) keeps the portal
  showing the most recent workspace surface beneath overlays, and stays unmounted
  on a cold start that lands on Home so no workspace/terminal boots eagerly.
  Result: switching to Home/Settings/etc. and back is a pure visibility flip —
  the workspace surface stays mounted underneath. Typecheck + lint clean.
- **`NavigationSidebar` button reorder** → Home, Inbox, Projects, Trails, Topics,
  Skills, Drawings.

## Naming — considered & rejected (decided 2026-06-17)

The unified base layer is named **`PrincipalPortal`** (fits the existing
`Principal*` house style — `PrincipalApp`, `PrincipalEventContext` — and stays
distinct from `IntegratedShell`, the window chrome above it). The portal
metaphor: a persistent gateway your tabs live in; Home and the standalone views
render *over* it.

Considered and **rejected**:

- `WorkspaceShell` / `shell` — collides with `IntegratedShell` and overloads
  "workspace".
- `Workbench`, `Navigator`, `Deck`, `Stage` — less aligned with house style.

The decision and the derived vocabulary (`PrincipalPortal`, `PortalTabsContext`,
`PortalTab`) now live in the [intended-design doc](./portal-unification.md).

## Superseded design stances

These were written down, then replaced by a later decision. Recorded so the
reversal is legible.

- **"Defer / re-scaffold `TrailsView` in place."** The panel-inventory pass
  (below) first concluded Trails should either be re-scaffolded into the
  framework+tabs pattern in place, or stay special-cased and deferred.
  **Superseded 2026-06-20** by the decision to build a *new* panelized,
  cross-repo Trails surface alongside the old monolith (see the intended-design
  doc, "Trails surface design"). Reason: in-place migration of the working
  monolith is high-risk surgery; a parallel rebuild lets the old view keep
  running until the replacement lands.

## Panel inventory & contract conformance (cataloged 2026-06-20)

Before unifying the shell, every panel under `principal-window/renderer` was
cataloged against the **panel contract** — the
`@principal-ade/panel-framework-core` shape: a panel is
`({ context, actions, events }) => JSX` that talks ONLY through the `events` bus
+ `actions`, and imports no view-specific React context (no `*TabsContext`, no
view hooks). `DevWorkspacePanelFramework` is the reference for clean wiring.

### The load-bearing insight

**Projects already follows the intent-emit pattern; Inbox/Topics short-circuit
it.** In Projects, panels emit view-agnostic intents on the local bus
(`repository:selected`, `owner:selected`, `collection:selected`, `trail:open`…)
and `ProjectsPanelFramework` is the sole listener that turns intents into tabs
via `useProjectsTabs()`. That is exactly the target architecture (one tab host =
one listener). But `InboxLeftPanel` / `TopicsLeftPanel` / `LocalTopicTabContent`
**bypass the bus entirely and call `useInboxTabs()` / `useTopicsTabs()`
directly**. So the pre-unification cleanup is: normalize Inbox/Topics left panels
onto the Projects intent-emit pattern, after which one `PortalTabsContext`
listener can replace all three `*TabsContext`s.

### Tier 1 — CONFORMANT, shell-ready (move as-is, no refactor)

| Panel | Path | Bus | Reuse |
|---|---|---|---|
| `MarkdownPanel` | panels/markdown-panel/ | local events | 3+ hosts (dev-workspace, Alexandria, doc tabs) — best citizen |
| `TypeInformationPanel` | panels/TypeInformationPanel/ | local events | 1 |
| `TerminalSessionsPanel` | panels/terminal-sessions/ | local events | 1 |
| `LocalhostProcessesPanel` | panels/localhost-processes/ | local events | 2+ |
| `RepositoryProfilePanel` | panels/RepositoryProfilePanel.tsx | local events | tabs |
| `UserProfilePanel` | panels/UserProfilePanel.tsx | local events (+`commitActivityActions`) | tabs |
| `OrgProfilePanel` | panels/OrgProfilePanel.tsx | local events | tabs |
| `SharedTrailTabContent` / `LocalTrailTabContent` / `MarkdownDocTabContent` | projects-view/ | local events only | shared by all 3 views |
| `TopicTabContent` | inbox-view/ | local events | inbox |

The 4 profile panels + the 4 trail/doc tab-content renderers are the proof the
right-side content is already view-agnostic.

### Tier 2 — PARTIAL (take `events` but also bespoke data props; no view-context coupling)

These work on any bus today; they only diverge from the pure contract by taking
domain data as direct props instead of via `context` slices. Low-priority tidy,
not blocking.

| Panel | Bespoke props | Note |
|---|---|---|
| `CollectionProfilePanel` | `collection` | no context/actions abstraction |
| `CommitActivityPanel` | `source`, `actions` | no context |
| `InProgressActivityPanel` | `repositories`, `actions` | data should move to context slice |
| `ActivityFeedCardPanel` | `repositories` | listens `activity:time-filter-changed`, `repository:filter-changed` |

### Tier 3 — VIEW-COUPLED (the actual cleanup targets before unification)

| Panel | Path | Coupling | Fix |
|---|---|---|---|
| `InboxLeftPanel` | panels/InboxLeftPanel.tsx | calls `useInboxTabs()` directly (no props, no bus) | emit `trail:open`/`topic:open` intents on the bus instead |
| `TopicsLeftPanel` | panels/TopicsLeftPanel.tsx | calls `useTopicsTabs()` directly | same |
| `LocalTopicTabContent` | topics-view/ | takes `events` BUT also calls `useTopicsTabs().openLocalTrail` | route trail-open through the bus |
| `ActivityCitiesPanel` | panels/ActivityCitiesPanel.tsx | `usePrincipalEvents()` global bus, emits hardwired `panel:switch` | reconcile with the bus decision |
| `ProjectsLeftPanel` | panels/ProjectsLeftPanel.tsx | bespoke props incl. `feedMode` state; emits via `events` but tab wiring sits in `useProjectsTabs()` at the framework | least-bad; already emits intents |
| `RecentRepositoriesPanel` | panels/recent-repositories/ | otherwise conformant, but calls `useTerminalProvider()` (TerminalContext) for active-terminal highlight | move `activeTerminalRepoPath` to a context slice |

### LEAF — presentational, no contract to unify (fine as-is)

`RepoCard`, `RepoActivityCard`, `InProgressRepoCard`; the sidebar lists
(`ProjectsList`, `CollectionsList`, `CoworkersList`, `FollowingList`,
`OrganizationsList`, `StarredReposList` — these take `events` only to emit
selection intents); everything in `panels/cards/` and `panels/components/`
(modals + `HeadlessFileEditorPanel`); `ReviewCommitPanel` (takes
`repoPath`/`commit`); `MediaViewerPanel` (`filePath`/`fileName`);
`RepoExplainOverlay` (overlay shell).

### Implication for the next slice

The `PortalTabsContext` merge is unblocked on the right-hand content (tab
renderers are already shared + conformant). The work concentrates on the **left
panels**: bring `InboxLeftPanel`/`TopicsLeftPanel`/`LocalTopicTabContent` up to
the Projects intent-emit pattern (Tier 3 → emit on bus), then a single tab-host
listener subsumes the 3 `*TabsContext`s. `RecentRepositoriesPanel`'s
`useTerminalProvider()` and `ActivityCitiesPanel`'s global-bus `panel:switch` are
the two stragglers to reconcile when the bus question is decided.

## Other surfaces: Trails / Skills / Drawings (cataloged 2026-06-20)

Round-two extension of the inventory to the surfaces the first pass skipped.
Headline: **none of the three follow the Projects/Inbox/Topics `*PanelFramework`
+ `*TabsContext` shape** — so the "merge 3 tab contexts" work is genuinely only
the original three; these are each a different kind of outlier.

### Trails — a *workspace* view, but a structural OUTLIER (no tabs context, no framework)

`TrailsView` lives in the portal next to Projects/Inbox/Topics, but it has **no
`TrailsTabsContext` and no `TrailsPanelFramework`**. It is a monolithic two-pane
view (recent-trails list on the left, `FileCityTrailPanel` preview on the right)
with **no persistent trail tabs** — the only tabs are local terminal sessions. It
creates its own `const events = useMemo(() => new PanelEventBus(), [])`
(TrailsView.tsx:605), shared by `useTerminalLinkHandler`, `TabbedTerminalPanel`,
and the preview pane. No `principalEvents`.

| Component | Contract | Note |
|---|---|---|
| `FileCityTrailPanel` (dev-workspace/file-city-trail-panel) | CONFORMANT (+layout props) | the trail preview; reused by the trail tab-content renderers too |
| `TabbedTerminalPanel` (@industry-theme/xterm-terminal-panel) | CONFORMANT | the same terminal host Inbox/Topics use |
| `RecentTrailPreviewPane` | PARTIAL | passes `events` through but bespoke prop shape + topology overlay orchestration |
| `TrailsRecentList`, `TrailCard`, `TrailsRecentHeaders`, `TrailsRecentFiles`, `TrailFileTrailsOverlay`, `ExploredProjectsGrid`, `SpikeConvertToolbar`, `TrailPromptIdeas`, `ShareTrailModal` | LEAF | presentational; `useTheme` only |

This analysis is what drove the **"build a new panelized Trails surface"**
decision (now in the [intended-design doc](./portal-unification.md)). It also answered the brief's open
question "whether `TrailsView` folds into the same shell or stays separate":
it's the expensive one.

### Skills — standalone overlay, hermetic & already well-factored

`SkillBrowserView` is an overlay (not a workspace surface), and it's the
*cleanest* example of the target pattern applied locally: a
`SkillBrowserPanelProvider` builds `context`/`actions`/data-slices and feeds a
`ConfigurablePanelLayout` of **conformant external agent-panels**
(`SkillsBrowsePanel`, `GlobalSkillsPanel`, `SkillDetailPanel` from
`@industry-theme/agent-panels`, all `{context, actions, events}`). Own local bus
(SkillBrowserView.tsx:1318; events `skill:selected/installed/uninstalled/edit`,
`skills:refresh`, `file:openInMdxEditor`), no `principalEvents`, no
`*TabsContext`. All the view-specific bits — `SkillBrowserViewHeader`,
`RecentSkillsPanel`, `SkillsRepoOnboarding`, `InstallSkillToolbar`,
`SkillInstallationModal`, `SkillEditorModal` — are intentional LEAF
modals/toolbars. It's a reference for how a provider should wrap conformant
panels.

### Drawings — standalone overlay, intentionally monolithic

`DrawingsView` is a single self-contained component (zero props, no bus, no
context) that drives Excalidraw's low-level `ExcalidrawWrapper` (LEAF) directly.
Per its own header comment it bypasses the package's higher-level
`ExcalidrawPanel`/`DrawingsListPanel` **on purpose** to avoid an infinite-render
loop. Adopting the panel contract would reintroduce the render-loop bug unless
the upstream wrapper is fixed first.

> **Note (revised):** Skills and Drawings are **not permanently out of scope** —
> they are a planned **fast-follow** after the core Projects/Inbox/Topics/Trails
> merge. The catalog above describes their *current* standalone-overlay shape and
> why each resists a naive merge; the fast-follow will revisit them once the
> portal tab host is in place. See the [intended-design doc](./portal-unification.md) for the fast-follow
> framing.
