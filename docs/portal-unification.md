# Portal Unification — Intent & Migration Tracker

> Working checklist for unifying the principal-window workspace surfaces
> (Projects / Inbox / Topics, later Trails) onto one persistent tab host fed
> by a shared intent bus. Topic: **"Unify principal-window views into one
> shell"** (`topic-1781729349467-vwfz5bjwv`).
>
> This doc is the source of truth for the **event/intent contract** and the
> per-file migration checklist. Tick boxes as each lands. Keep it green at
> every commit (we commit to `main`, no PRs; each increment must leave the app
> fully working).

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

- [ ] **`user:profile-selected` (7×) vs `owner:selected` (7×)** — both open a
  profile; `user:profile-selected` is a `feed:`-era straggler. Collapse to
  `owner:selected` with `kind` in payload. (Emitters of the straggler:
  ProjectsLeftPanel, ProjectsList, CollectionProfilePanel.)
- [ ] Decide `trail:open` payload discriminator (`source: 'shared' | 'local'`)
  vs two events. Recommendation: one event + discriminator.

## Migration checklist — Increment 1 (decouple, behavior-identical)

Goal: left panels + titlebar emit intents on the shared bus; the **existing 3
tab contexts still listen** (each bridges the new intents into its own
`open*`). No visible change. App green.

**Emitters to convert (stop calling `useInboxTabs`/`useTopicsTabs`, emit intents):**
- [ ] `panels/InboxLeftPanel.tsx` — emit `trail:open` / `topic:open`
- [ ] `panels/TopicsLeftPanel.tsx` — emit `topic:open` / `trail:open`
- [ ] `topics-view/LocalTopicTabContent.tsx` — emit `trail:open` (drop
  `useTopicsTabs().openLocalTrail`)
- [ ] `principal-window/components/IntegratedShell/TitlebarGitHubSearch.tsx` —
  emit intents instead of direct tab calls
- [ ] `principal-window/components/IntegratedShell/IntegratedShell.tsx` —
  any direct `useInboxTabs`/`useTopicsTabs` open calls → intents

**Bridges (temporary — listen for the new intents, call existing context):**
- [ ] `inbox-view/InboxPanelFramework.tsx` — subscribe `trail:open`/`topic:open`
  → `useInboxTabs().open*`
- [ ] `topics-view/TopicsPanelFramework.tsx` — subscribe `topic:open`/`trail:open`
  → `useTopicsTabs().open*`

**Shared infra:**
- [ ] Add the intent-name `const`/union + payload types (shared module)
- [ ] Stand up the portal-scoped `PanelEventBus` and thread it to the
  workspace left panels + tab content (alongside, not replacing, the per-view
  buses yet)

## Increment plan (each commit green)

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

## Out of scope / staying separate

- **Skills** — hermetic overlay (own provider + local bus + conformant
  agent-panels). Stays an overlay.
- **Drawings** — monolithic overlay by design (drives `ExcalidrawWrapper`
  directly to dodge a render-loop). Stays an overlay.
