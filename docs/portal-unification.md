# Portal Unification — Intended Design & Migration Tracker

> The **intended design** + working checklist for unifying the principal-window
> workspace surfaces (Projects / Inbox / Topics, later Trails) onto one
> persistent tab host fed by a shared intent bus. Topic: **"Unify
> principal-window views into one shell"** (`topic-1781729349467-vwfz5bjwv`).
>
> This doc is the source of truth for the **target shape**, the **event/intent
> contract**, and the per-file migration checklist. Tick boxes as each lands.
> Keep it green at every commit (we commit to `main`, no PRs; each increment
> must leave the app fully working).
>
> **Siblings:** dated snapshots, landed-work history, and the full panel
> inventory live in [`portal-unification-history.md`](./portal-unification-history.md).
> The topic holds the brief, live status, and open questions.

## Goal & target shape

The principal window has N parallel view containers — `ProjectsView`,
`InboxView`, `TopicsView`, `TrailsView` — each a near-identical `*PanelFramework`
shell. The goal is **one shell where the left panel is a swappable slot and the
tabbed content host on the right persists** across left-panel switches, so
switching from Projects to Inbox keeps your open tabs.

Target shape:

- **One persistent tab host** — collapse the 3 `*TabsContext`s into a single
  `PortalTabsContext` that lives above the swappable left panel.
- **Left panel as a slot** — `ProjectsLeftPanel`, the inbox list, and the topics
  list become interchangeable left-panel implementations behind one shell.
- **One shared bus with intent-based events** — emitters fire view-agnostic
  intents (`repository:selected`, `trail:open`, `doc:open`); the single tab host
  is the only listener that turns intents into tabs. On a shared bus the domain
  prefix finally does real isolation work (repo-open vs trail-open).

## Naming & vocabulary (decided 2026-06-17)

- **`PrincipalPortal`** — the unified, always-mounted base layer (swappable
  left-panel slot + persistent tabbed host + header). Home and the standalone
  views render *over* it as overlays. Fits the `Principal*` house style; stays
  distinct from `IntegratedShell` (the window chrome above it).
- **`PortalTabsContext`** — the unified tab state replacing the 3 `*TabsContext`s.
- **`PortalTab`** — the unified tab union replacing `FeedTab`.

(Considered-and-rejected names are recorded in the [history doc](./portal-unification-history.md).)

## Decisions locked

- **Bus model — Option A (portal-scoped intent bus).** Introduce one
  `PanelEventBus` owned by `PrincipalPortal`. Workspace left panels + tab
  content emit *domain intents* on it; the single tab-host context is the only
  listener that turns intents into tabs. The existing global `principalEvents`
  (`PrincipalEventContext`) is **left as-is** for window-chrome / navigation
  (`panel:switch`, titlebar). Clean split: portal bus = "what content opens",
  principalEvents = "which surface is showing".
- **Type safety.** Introduce a shared `const`/union of intent names so a
  mistyped `trail:opened` vs `trail:open` fails to **compile** (replaces
  today's loose `event.type: string` matching).
- **Left-panel slot — DEFERRED (intentionally).** We do NOT collapse the 3
  left panels into one swappable slot yet. We get them *decoupled* first
  (Increment 1) and revisit the single-host / slot question from evidence.

## The gap this work closes

Today, isolation between views is **accidental** — each view does
`const events = useMemo(() => new PanelEventBus(), [])`, so it's the separate
*instance* that isolates, not any namespace. And critically: **opening a
trail / topic / doc is not an event at all** — the Inbox/Topics left panels
call `useInboxTabs().openSharedTrail()` / `useTopicsTabs().openTopic()`
directly. (Confirmed: `trail:open` / `topic:open` / `doc:open` appear nowhere
in emitted event types.) The Projects view already does the right thing —
panels emit intents, the framework listens. Increment 1 brings Inbox/Topics up
to that pattern.

## Canonical intent set (the union)

Names follow the existing `repository:*` / `owner:*` house style (the `feed:*`
namespace was already renamed away). `[NEW]` = does not exist yet, added in
this work. Discriminate trail kind via payload, not separate event names.

### Tab-open intents (the single tab host listens to these)

| Intent | Payload (sketch) | Emitters today | Opens |
|---|---|---|---|
| `repository:selected` | `{ repositoryPath?, owner, repo }` | ProjectsLeftPanel, ProjectsList, profile panels | repo profile tab |
| `owner:selected` | `{ owner, kind: 'user' \| 'org' }` | FollowingList, OrganizationsList, profile panels | user/org profile tab |
| `collection:selected` | `{ collectionId }` | CollectionsList, CollectionProfilePanel | collection profile tab |
| `commit:review-selected` | `{ repoPath, commit }` | activity cards | commit review tab |
| `live-activity:open` | `{ owner? }` | CoworkersList, OrganizationsList | live activity tab |
| `owner:activity-requested` | `{ owner }` | CoworkersList | owner activity tab |
| `repository:activity-requested` | `{ repo }` | activity cards | repo activity tab |
| `trail:open` **[NEW]** | `{ trailId, source: 'shared' \| 'local', owner?, repo? }` | **InboxLeftPanel, TopicsLeftPanel, LocalTopicTabContent (today: direct `useTabs()` calls)** | trail tab (`FileCityTrailPanel`) |
| `topic:open` **[NEW]** | `{ topicId, title? }` | **InboxLeftPanel, TopicsLeftPanel (today: direct calls)** | topic tab |
| `doc:open` **[NEW]** | `{ filePath, repositoryPath? }` | **(today: `openMarkdownDoc` direct calls)** | markdown doc tab |
| `map:open` **[NEW, Trails slice]** | `{ repositoryPath }` | (future) All-Maps overview | full repo map/city tab |

### Side-channel events (stay on their local/scoped buses — NOT tab-open)

These are data-sync / panel-internal and are **out of scope** for the tab-host
listener; do not fold them into the intent union:

- Profile/link: `user-profile:open-link`, `org-profile:open-link`,
  `repository-profile:delete-requested`, `…:delete-clone-requested`,
  `…:clone-completed`, `repository:opened/updated/deleted`
- Data toggles/sync: `star:repo-toggled`, `follow:user-toggled`,
  `collections:updated`, `activity:refresh-requested`,
  `activity:time-filter-changed`, `repository:filter-changed`
- Layout/chrome (principalEvents): `panel:switch`, `panel:toggle`,
  `panel:reset-layout`, `panel:expand-all/collapse-all`
- Hermetic namespaces (leave alone): `skill:*` (SkillBrowserView local bus),
  `principal-ade.localhost-processes:*`, `principal-ade.terminal-sessions:*`,
  `markdown-panel:*`, `terminal:activity-changed`, `type-info:*`

## Naming issues to resolve in the union

- [~] **`user:profile-selected` (7×) vs `owner:selected` (7×)** — both open a
  profile; `user:profile-selected` is a `feed:`-era straggler. **Collapsed on the
  portal bus:** `PORTAL_INTENTS.ownerSelected` carries `kind`, and
  `installProjectsOpenForwarder` normalizes both legacy events into it (3b). The
  remaining emit-site cleanup — making the panels emit `owner:selected{kind}`
  directly instead of the two legacy events — is a follow-up. (Straggler emitters:
  ProjectsLeftPanel, ProjectsList, CollectionProfilePanel, RepoActivityCard,
  OrgProfilePanel, RepositoryProfilePanel.)
- [ ] Decide `trail:open` payload discriminator (`source: 'shared' | 'local'`)
  vs two events. Recommendation: one event + discriminator.

## Migration checklist — Increment 1 (decouple, behavior-identical)

Goal: left panels + titlebar emit intents on the shared bus; the **existing 3
tab contexts still listen** (each bridges the new intents into its own
`open*`). No visible change. App green.

**Emitters to convert (stop calling `useInboxTabs`/`useTopicsTabs`, emit intents):**
- [x] `panels/InboxLeftPanel.tsx` — emit `trail:open` / `topic:open` (takes an
  `events` prop; no longer imports `useInboxTabs`)
- [x] `panels/TopicsLeftPanel.tsx` — emit `topic:open` (keeps reading
  `activeTabId` from the context for row highlight; only the open call moved)
- [x] `topics-view/LocalTopicTabContent.tsx` — emit `trail:open` (source
  `local`); dropped `useTopicsTabs().openLocalTrail`, kept `activeTabId`
- [x] `principal-window/components/IntegratedShell/TitlebarGitHubSearch.tsx` —
  pasted trail / topic now emit `trail:open` / `topic:open` on the **portal
  bus**; `PortalIntentBridge` (always-mounted) opens the tab. *Still direct:
  the repo / user-profile opens (`openProjectInfo` / `openUserProfile`) — a
  separate view-local domain (`repository:selected` / `user:profile-selected`),
  not the trail/topic/doc family this work targets.*
- [ ] `principal-window/components/IntegratedShell/IntegratedShell.tsx` —
  the `onShowInPrincipal` / `onTopicActivate` bridge handoffs still call the tab
  contexts directly. *Left as-is on purpose: these are always-mounted handlers
  doing genuine per-`activeView` routing; routing them through an intent buys
  nothing until the single `PortalTabsContext` listener exists (Increment 2).*

**Bridges (temporary — listen for the new intents, call existing context):**
- [x] `inbox-view/InboxPanelFramework.tsx` — subscribes `trail:open`/`topic:open`
  → `useInboxTabs().open*`
- [x] `topics-view/TopicsPanelFramework.tsx` — subscribes `topic:open`/`trail:open`
  → `useTopicsTabs().open*` (ignores `shared` trails — Topics hosts local only)

**Shared infra:**
- [x] Add the intent-name `const`/union + payload types (shared module) —
  `renderer/events/portalIntents.ts` (`PORTAL_INTENTS` + `emitTrailOpen` /
  `emitTopicOpen` / `emitDocOpen` helpers)
- [x] Stand up the portal-scoped `PanelEventBus` — `PortalEventContext`
  (`PortalEventProvider` / `usePortalEvents`), provided at the `PrincipalApp`
  level (above `IntegratedShell`) so always-mounted emitters/listeners can reach
  it. Its always-mounted listener is `PortalIntentBridge`, the seed of the
  Increment-2 single `PortalTabsContext` listener. *Note:* the Increment-1
  left-panel/tab-content emitters still run on their per-view buses; only the
  titlebar emits on the portal bus so far. Folding the per-view emitters onto
  the portal bus happens with the `PortalTabsContext` merge in Increment 2.

## Increment plan (each commit green)

> **Folding a view into the shell?** Follow the step-by-step playbook in
> [`portal-view-migration.md`](./portal-view-migration.md) — the repeatable
> path (decouple → rehome side-effects → merge bucket → render → swap left panel
> → wire → delete), with the invariants and per-surface notes.


1. **Decouple** (this doc's checklist) — intents flow on the shared bus; 3
   contexts still listen via bridges. *Visible change: none.*
2. **Unify the host** — introduce `PortalTabsContext` (single listener +
   `PortalTab` union merging `FeedTab` ∪ `InboxTab` ∪ `TopicsTab`, dedup by
   content id); retire the 3 contexts + their bridges. *Decide left-panel slot
   here, with evidence.*
3. **One left slot** — collapse the 3 frameworks; left panels become
   interchangeable slot implementations over the one persistent host.
4. **Trails (separate)** — build the new cross-repo panelized Trails (All-Maps
   default tab + `trail:open`/`map:open`); fold into `PortalTabsContext`.

### Increment 2 — staging (decided 2026-06-27)

Census finding: each view renders its **own** `TabbedTerminalPanel` with its own
terminal scope (`terminal:feed` / `terminal:inbox` / `terminal:topics`). Tabs
survive view switches only because the *state* lives in the always-mounted
contexts; the host remounts per view, and tabs are not persisted. So the "one
persistent host — keep your tabs when you swap the left panel" UX **requires
collapsing the three hosts into one host with one terminal scope** — the only
behavior-changing, high-risk part, and effectively the old Increment 2 + 3 done
as a single host merge.

**Approved staging — risky host-merge last; every prior step behavior-identical,
each green on `main`:**

- **2a — Dedup tab types.** Extract `SharedTrailTab` / `LocalTrailTab` /
  `MarkdownDocTab` (defined 2–3× across the frameworks) into one module
  (`events/portalTabs.ts`); frameworks import + re-export instead of
  redeclaring. Pure types, no runtime change.
- **2b — One `PortalTabsContext`, per-surface buckets.** Replace the 3 providers
  with one context holding per-surface tab buckets; each framework reads its own
  slice via thin compat hooks (`useProjectsTabs` / `useInboxTabs` /
  `useTopicsTabs` keep working). Retires 3 providers → 1. Per-surface isolation
  preserved; behavior-identical.
- **2c — One always-mounted listener.** Fold the 2 framework bridges + the
  `PortalIntentBridge` into one portal-bus listener that writes to the right
  bucket; left panels emit on the portal bus instead of per-view buses.
  Behavior-identical.
- **3 — One host + one terminal scope + swappable left slot.** Collapse the
  frameworks into one shell with a single persistent `TabbedTerminalPanel`.
  **Terminal decision (locked): one shared workspace-wide scope** — the per-surface
  scopes collapse into one. This is where shared-tabs UX lands — the only intended
  behavior change. **Split, by risk (decided 2026-06-27):** the blueprint showed
  Projects carries far more per-view machinery (repositories + GitHub loads, ~13
  bus subscriptions that open tabs/modals, the activity-feed/heatmap/delete-modal
  state) — none of it on the portal bus yet. Inbox + Topics were already
  portal-bus-clean after 2c, so they merge first; Projects folds in as its own
  focused step afterward.
  - **3a — Inbox + Topics → `WorkspaceShell`** (first cut). One persistent host
    (`src/renderer/workspace-shell/WorkspaceShell.tsx`): single `terminal:workspace`
    scope, one `useWorkspaceTabs()` bucket (the inbox + topics buckets merged in
    `PortalTabsContext`), left panel swaps by `activeView`. `PrincipalPortal` mounts
    one instance for both `inbox` and `topics`, so switching keeps tabs + terminal.
    The dead per-view frameworks + view wrappers are deleted; their 4 tab types move
    to `events/portalTabs.ts`. The `useInboxTabs`/`useTopicsTabs` compat hooks now
    read the shared bucket.
  - **3b — Projects → `WorkspaceShell`** (done). Projects now renders in the one
    persistent shell for `projects`/`inbox`/`topics`. Its ~10 tab types + open
    methods merged into the single `useWorkspaceTabs()` bucket; its tab bodies
    render via `projects-view/projectsTabContent.ts` (`renderProjectsTabContent`);
    its host concerns (activity feed, git-status refresh, delete modal, profile-link
    side-effects) live in `projects-view/useProjectsHost.tsx`. The dead
    `ProjectsView`/`FeedPanelProvider`/`ProjectsPanelFramework` are deleted. See the
    bus-topology note below.

### Bus topology for Projects opens (decided 2026-06-27)

The doc's canonical-intent table already lists `repository:selected` /
`owner:selected` / `collection:selected` / `live-activity:open` /
`owner:activity-requested` / `repository:activity-requested` as portal tab-open
intents, so those are now **typed members of `PORTAL_INTENTS`**, materialized by
the lone always-mounted `PortalIntentBridge` into the shared bucket. The legacy
`user:profile-selected` straggler is collapsed into `owner:selected{ kind }`.

Reconciling that with the panel convention (panels take one `events` prop;
`commit:review-selected` is an in-panel overlay; profile-link / delete / repo-CRUD
are local data-sync) is done with a **typed local→portal forwarder**
(`installProjectsOpenForwarder`): the Projects left panel + tab content keep
emitting everything on the shell's local bus, and the shell lifts just the
open-intent subset onto the portal bus. Inbox/Topics still emit straight on the
portal bus (no chatter to keep local). The emit-site collapse of
`user:profile-selected` → `owner:selected{kind}` in the panels themselves remains
a follow-up (normalization currently happens at the forwarder boundary).

**Landed:** 2a `652fe652a`, 2b `9da7ef06b`, 2c `7dc4d0efd`, 3a `6cdeb57f1`, 3b
(prep + host merge) — all green on `main`. 2a–2c behavior-identical; **3a + 3b
change tab/terminal isolation** (Projects/Inbox/Topics now share one host + one
`terminal:workspace` scope) and want a dev-build check. **Remaining: Increment 4
(Trails).**

## Trails surface design (decided 2026-06-20)

**Do NOT migrate the monolithic `TrailsView` in place.** Build a **new
panelized Trails surface** on the panel framework, mirroring the Topics
structure (a `TrailsPanelFramework` + tabs-context analog, left list + preview
fed through `{context, actions, events}`). The old view keeps running until the
replacement lands; the new one becomes a first-class workspace surface that
folds into `PortalTabsContext`. (This supersedes the earlier "defer /
re-scaffold in place" stance — see the [history doc](./portal-unification-history.md).)

The new surface is **cross-repo**, not a 1:1 reskin of today's per-repo view:

- **Left panel (swappable slot): a cross-repo trail browser.** Search/filter
  trails across *all repos that have trails*. Reuses `TrailCard` / list
  rendering. Emits intents on the bus (Projects pattern, not Topics' direct
  tab-context calls).
- **Default / home tab: an "All Maps" overview.** Renders the File City map for
  every repo in the *currently filtered* trail set — the empty-state IS an
  interactive gallery of maps, driven by the left-panel filter. Evolves the
  existing `ExploredProjectsGrid`.
- **Two ways to open a tab:** click a **trail** → `trail:open` → single-trail
  tab (`FileCityTrailPanel`); select a **map** → `map:open` **[NEW]** → that
  repo's full map/city as its own tab.

**New concepts:** a **Map tab** type (full repo city) distinct from the **Trail
tab** (one trail's path) — `PortalTab` gains a map-tab variant; and the new
`map:open` intent alongside `trail:open`.

**Reuse anchors:** `TrailLibraryService.list()` with no `repositoryPath` already
returns a cross-repo listing; `ExploredProjectsGrid` renders per-repo city
minimaps; `FileCityTrailPanel` is the Trail tab unchanged.

**Open design questions (resolve before building):**

1. What is a "Map" tab concretely — the repo's full File City (all trails
   selectable within), and does a full-city non-trail panel exist to reuse or is
   it net-new?
2. Filter semantics — when trails are filtered to a subset, do maps with no
   matching trail drop out, and are only matching trails highlighted?
3. Map-to-trail drill-in — does clicking a trail marker *on* a map open the
   Trail tab, or is trail-open only from the left list?
4. Scope of "all repos" — every repo the local trail library knows, or only
   workspace repos with ≥1 trail?

## Fast-follow: Skills & Drawings

The reframing that unblocked these (decided 2026-06-27): folding a surface in is
about **tab-ability** — opening its content as a persistent tab in the one shared
host, with the left panel as a per-surface launcher — *not* about needing the
terminal. The tab host (`TabbedTerminalPanel`) renders each tab in an
opacity-hidden + `inert` div and **lazily mounts on first activation, then keeps
it mounted**, so stateful tab content (an Excalidraw canvas, a skill detail)
survives tab switches. That's what makes both viable as tabs.

- **Drawings — done.** Moved from `overlayView` to a `WORKSPACE_VIEWS` surface.
  The list is the left-panel launcher (`drawings-view/DrawingsLeftPanel`); the
  Excalidraw canvas is a `drawing` tab (`DrawingTabContent`, self-loads by path,
  owns save). List↔canvas↔host sync runs on the shell's local bus
  (`drawing:open`/`saved`/`delete-requested`/`deleted`) via `useDrawingsHost`;
  `openDrawing` dedups by `drawingId`. The "render-loop" caveat was narrower than
  feared — it's only the package's `ExcalidrawPanel`; `DrawingTabContent`
  replicates the old overlay's loop-free `ExcalidrawWrapper` wiring verbatim. The
  `DrawingsView` overlay is deleted.
- **Skills** — still a standalone overlay. Same overlay→surface variant
  (left-panel launcher + a skill tab type), but heavier: `SkillBrowserView` is a
  ~1325-line hermetic sub-app (own provider, `ConfigurablePanelLayout`, view
  modes, 4 modals). Next fast-follow.

(Current-shape analysis is in the [history doc](./portal-unification-history.md).)
