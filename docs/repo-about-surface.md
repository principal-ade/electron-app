# RepoAboutCard — Left-Rail Repo About Surface (electron-app)

> How a **selected-repo About card** appears in the desktop Home left panel
> when the user picks a repository from any sub-view. This is the electron-app
> counterpart of web-ade's `RepoAboutCard` / `RepoOverview` left-rail extract.
> For the full profile hub that opens as a tab, see
> [repository-profile-panel-surface.md](./repository-profile-panel-surface.md).

## What it is

The Home left panel (`HomeLeftPanel`) has two layers in its default `"home"`
view:

1. **`UserAboutCard`** — the signed-in user's GitHub profile (avatar, login,
   bio, stats). Always visible at the top.
2. **`HomeNavCards`** — clickable nav cards (Projects, Other Clones, Starred,
   Collections, Recent).

When the user selects a repo from any sub-view, the `RepoAboutCard` slides in
from the right over the sub-view (which stays mounted with `pointerEvents:
none`). The card dismisses with a matching slide-out animation.

## Card content

| Section | Source | Notes |
| --- | --- | --- |
| Owner avatar + display name | `GithubService.getUser(owner)` | Fallback to owner initial |
| Repo name + star count | `RepositorySelectedPayload.github` | Name links to GitHub |
| Description | `github.description` | Falls back to "No description" with GitHub link |
| Project age | `github.createdAt` | Computed via `getRepositoryAge` (days/months/years) |
| Last updated | `github.lastUpdated` | Relative time ("2h ago") |
| Clone rows (per clone) | `RepositorySelectedPayload.localClones` | Green "cloned" badge, branch name, sync status |
| Open / Terminal buttons | Per-clone, via `WindowService` / `emitTerminalOpen` | Opens workspace or terminal at clone path |
| Clone / Fork buttons | `GitCloneModal` / `ForkModal` | Shown when no local clones exist |
| Fork status | `GithubService.getCurrentUser` + `getRepository` | Shows "forked: {owner}" if user already forked |
| Full profile button | — | Slides to `RepositoryProfilePanel` tab |

## Clone row details

Each local clone renders a row with:

- **Cloned badge** — green pill, shows "cloned" or "clone N" for multiple
- **Branch + status** — branch name via `GitService.getBranchStatus`, with
  sync indicator: "in sync" (green), "no remote" (yellow), or ahead/behind
  counts (blue/red)
- **Open button** — opens the clone in a dev workspace via
  `WindowService.openDevWorkspace`
- **Terminal button** — emits `terminal:open` intent via `emitTerminalOpen`

When no clones exist, **Clone** and **Fork** buttons appear instead:

- **Clone** — opens `GitCloneModal` with the repo URL pre-filled; shows
  spinner during cloning
- **Fork** — opens `ForkModal`; if already forked, shows "forked: {owner}"
  and navigates to the fork on click

## Dismissal

- **X button** or **Full profile** — triggers `dismissRepoCard`, which runs
  the `repoAboutSlideOut` animation (320ms) before clearing state
- **Sidebar Home button** — instant clear (no animation)
- **Sign-out** — falls back to `UserAboutCard`

## Data flow

```
User picks repo in sub-view (Projects, Starred, …)
  │  emitRepoSelected(repo) / emitLocalEntrySelected(entry)
  │
  ├─ events.emit({ type: 'repository:selected', … })
  │     → PortalIntentBridge → opens RepositoryProfilePanel tab (existing)
  │
  └─ HomeLeftPanel also:
        → stores selectedRepo payload in state
        → slides to 'home' view
        → renders RepoAboutCard (overlays sub-view with pointer-events none)
```

The existing `repository:selected` → tab flow is preserved. The RepoAboutCard
is an **addition** to the left rail, not a replacement for the tab.

### Payload

`RepoAboutCard` reads from `RepositorySelectedPayload`:

```ts
interface RepositorySelectedPayload {
  purl: Purl;
  github?: GithubRepository;      // display meta, createdAt
  localEntry?: AlexandriaEntry;   // first matching local entry
  localClones?: Array<{           // all clones deduped by path
    path: string;
    addedAt: number;
  }>;
}
```

`localClones` is aggregated across all entries matching the repo's purl via
`collectLocalClones`. Each clone's branch status is fetched independently via
`GitService.getBranchStatus`.

## Integration with HomeLeftPanel

### State

```ts
const [selectedRepo, setSelectedRepo] = useState<RepositorySelectedPayload | null>(null);
const [repoCardExiting, setRepoCardExiting] = useState(false);
```

### View routing

The card renders as an absolute overlay when `selectedRepo` or
`repoCardExiting` is true:

```tsx
{(selectedRepo || repoCardExiting) && (
  <div style={{ animation: repoCardExiting ? 'repoAboutSlideOut …' : 'repoAboutSlideIn …' }}>
    {selectedRepo && (
      <RepoAboutCard
        repo={selectedRepo}
        onDismiss={dismissRepoCard}
        onOpenProfile={dismissRepoCard}
        events={events}
      />
    )}
  </div>
)}
```

The sub-view stays mounted with `pointerEvents: 'none'` while the card is
visible or exiting.

## Key source paths

| Path | Role |
| --- | --- |
| `src/renderer/panels/home-panel/RepoAboutCard.tsx` | Card component |
| `src/renderer/panels/home-panel/HomeLeftPanel.tsx` | Left rail orchestrator |
| `src/renderer/panels/home-panel/UserAboutCard.tsx` | User profile card |
| `src/renderer/events/repositorySelected.ts` | Payload type + builders + `collectLocalClones` |
| `src/renderer/components/GitCloneModal.tsx` | Clone modal |
| `src/renderer/panels/components/ForkModal.tsx` | Fork modal |
| `src/renderer/panels/RepositoryProfilePanel.tsx` | Full profile tab (click-through target) |

## Explicit non-goals

- **Not a replacement for `RepositoryProfilePanel`.** The card is a preview;
  the full hub with heatmap, city, contributors, and README stays in the tab.
- **Not a host of `FileCityGuidePanel`.** No guide modes (tour/commit/readme)
  in the left rail.
- **Not the `UserAboutCard`.** These are two distinct cards — user profile vs.
  repo profile. The `UserAboutCard` always returns when no repo is selected.

## Related docs

| Doc | Scope |
| --- | --- |
| [repository-profile-panel-surface.md](./repository-profile-panel-surface.md) | Full profile hub tab |
| [home-left-panel-design.md](./home-left-panel-design.md) | Home left rail architecture |
| [repository-profile-panel-architecture.md](./repository-profile-panel-architecture.md) | Profile panel internals |
