# RepositoryProfilePanel — Surface Wiring (electron-app)

> How the **repository profile** tab is opened and hosted in the desktop app:
> portal intent → `project-info` tab → `RepositoryProfileTabContent` →
> `RepositoryProfilePanel`. This doc is about *this* surface only — not
> web-ade’s `FileCityGuidePanel` or `RepoAboutCard` (see those repos’ surface
> docs). For the older actions/context migration notes, see
> [repository-profile-panel-architecture.md](./repository-profile-panel-architecture.md).

## What it is

`RepositoryProfilePanel` is the desktop **project hub** for a single
repository identity (purl). It combines:

- Profile chrome (heatmap banner, owner avatar, stats, description)
- Local clone lifecycle (list clones, open workspace, terminal, delete, clone/fork)
- Git status / branch sync per clone
- Star + collections
- Contributors (and optional ownership layers)
- An embedded File City built **inside the panel** (local and/or remote trees) —
  **not** a mount of `FileCityGuidePanel`
- README via `DocumentView` when remote-only (not guide “readme mode”)

It is the target of **`repository:selected`** / `openProjectInfo`, including
picks from the Home left panel.

## Open path (event → tab)

```
Emitter (home panel, activity cards, search, profile links, …)
  │  events.emit({ type: 'repository:selected', payload: RepositorySelectedPayload })
  │
  ├─ If on shell local bus:
  │     installProjectsOpenForwarder → portal bus
  │
  └─ PortalIntentBridge
        → useWorkspaceTabs().openProjectInfo(payload)
        → tab id: project-info-<purl>
        → contentType: 'project-info'
              │
              └─ renderProjectsTabContent
                    → RepositoryProfileTabContent
                          → RepositoryProfilePanel(context, actions, events)
```

**Payload** (`src/renderer/events/repositorySelected.ts`):

```ts
interface RepositorySelectedPayload {
  purl: Purl;                 // always
  github?: GithubRepository;  // display meta when known
  localEntry?: AlexandriaEntry; // when cloned / registered
}
```

Helpers: `payloadFromLocalEntry`, `payloadFromGithub`.

**Intent name:** `PORTAL_INTENTS.repositorySelected` === `'repository:selected'`.

## Tab host

| Piece | Path / detail |
| --- | --- |
| Tab type | `ProjectInfoTab` in `src/renderer/events/portalTabs.ts` |
| Open helper | `PortalTabsContext.openProjectInfo` |
| Render switch | `src/renderer/projects-view/projectsTabContent.tsx` → `case 'project-info'` |
| Data loader | `RepositoryProfileTabContent` (same file) |
| Panel | `src/renderer/panels/RepositoryProfilePanel.tsx` |

Tab identity is **purl-stable**: re-selecting the same repo focuses the existing
tab rather than spawning duplicates.

## `RepositoryProfileTabContent` responsibilities

Owns fetching and assembling `RepositoryProfileData` into panel context:

- Resolve Alexandria entries matching purl (multi-clone aggregation)
- Heat map (`useCommitHeatMap` when local path)
- GitHub repo meta, contributions, contributor count
- Placeholder profile while loading
- Refresh on registry add/remove/update for this purl
- Build **actions** delegated to services (trees, line counts, star, open, …)

Context shape (simplified):

```ts
context.currentScope.repository  // RepositoryProfileData
// file trees are NOT in context — panel fetches via actions
```

## Panel contract

### Data (`RepositoryProfileData`)

Key fields: `name`, `fullName`, `owner`, `ownerAvatarUrl`, `ownerType`,
`description`, language/stats, `activityData`, `totalCommits`, `contributors`,
`defaultBranch`, dates, `htmlUrl`, `isLocal`, `localClones[]`, `github?`.

### Actions (panel → host)

| Action | Purpose |
| --- | --- |
| `getLocalFileTree(path)` | Working-tree city |
| `getRemoteFileTree(owner, name)` | Default-branch city |
| `getLineCounts(path)` | Building heights (local) |
| `getReadmeContent?(owner, name)` | Remote README |
| `openRepository(path, remoteUrl?)` | Open dev workspace / register |
| `isRepositoryStarred` / `star` / `unstar` | GitHub star |
| `registerRepository` | Alexandria after clone |
| `getContributors` | GitHub contributors |

### Events (panel → host)

| Event | Purpose |
| --- | --- |
| `repository-profile:delete-clone-requested` | Delete modal (`useProjectsHost`) |
| `repository-profile:delete-requested` | Delete entry |
| `star:repo-toggled` | Refresh star-dependent UI |
| `owner:selected` / nested `repository:selected` | Drill to owner / related repo |
| `terminal:open` (via helper) | Terminal tab at clone path |

Delete confirmation is **always mounted** in `useProjectsHost` so it works even
when another workspace surface is active.

## Home left panel integration

**File:** `src/renderer/panels/home-panel/HomeLeftPanel.tsx`

- Lists (Projects, Other Clones, Starred, …) call `emitRepoSelected` /
  `emitLocalEntrySelected`
- Source: `'home-panel'`
- Does **not** keep a `selectedRepoFullName` highlight for an About card
- Does **not** host File City or About in the left rail; selection only opens
  this profile tab

Home shell placement: `WorkspaceShell` when `activeView === 'home-panel'`
renders `HomeLeftPanel` with the shell’s local `events` bus (forwarded to
portal for opens). Design inventory:
[home-left-panel-design.md](./home-left-panel-design.md).

## Feature surface (what users get here)

| Area | Behavior |
| --- | --- |
| Banner | GitHub-style activity heatmap; owner avatar overlap |
| Stats / meta | Stars, forks, language, age, description |
| Clones | Paths, branch ahead/behind, dirty status, copy path |
| Open | Open workspace; open terminal tab |
| Clone / fork | Modals + inline clone progress |
| City | Built from local and/or remote trees; git-status layers when local |
| README | Fetched for remote-only; `DocumentView` |
| Contributors | List + optional ownership hover coloring on city |
| Star / collect | GitHub star; add/remove Principal collections |
| Playback | Commit highlight playback over city (today/week/year) |

## Explicit non-goals (this surface)

- Not a host of **`FileCityGuidePanel`** (web guide modes: tour/commit/readme/issue/PR).
  City here is bespoke panel code using `file-city-react` builders.
- Not the web **RepoAboutCard** / **RepoOverview** left-rail extract. Desktop
  About-like chrome is embedded in this profile layout.
- Not the Alexandria **dev workspace** city (trail/sequence explorers under
  `@industry-theme/file-city-panel` elsewhere in the app).

Package pin today: `@industry-theme/file-city-panel` **^0.7.0** in electron-app
(used for trails/etc.; profile does not depend on guide modes).

## Related docs

| Doc | Scope |
| --- | --- |
| [repo-about-surface.md](./repo-about-surface.md) | Planned left-rail repo about card (electron-app) |
| [repository-profile-panel-architecture.md](./repository-profile-panel-architecture.md) | Actions/context migration history |
| [home-left-panel-design.md](./home-left-panel-design.md) | Home left rail inventory |
| [portal-unification.md](./portal-unification.md) | Portal bus / single tab bucket |
| web-ade `docs/file-city-guide-panel-surface.md` | Web File City guide host |
| web-ade `docs/repo-about-surface.md` | Web About card / overview |

## Key source paths

| Path | Role |
| --- | --- |
| `src/renderer/panels/RepositoryProfilePanel.tsx` | Panel UI + city |
| `src/renderer/panels/RepositoryProfilePanel.stories.tsx` | Storybook |
| `src/renderer/projects-view/projectsTabContent.tsx` | Tab content + actions |
| `src/renderer/events/repositorySelected.ts` | Payload builders |
| `src/renderer/events/portalIntents.ts` | Intent names + forwarder |
| `src/renderer/principal-window/components/PortalIntentBridge.tsx` | Intent → tab |
| `src/renderer/principal-window/PortalTabsContext.tsx` | `openProjectInfo` |
| `src/renderer/projects-view/useProjectsHost.tsx` | Delete modal, forwarder install |
| `src/renderer/panels/home-panel/HomeLeftPanel.tsx` | Home → `repository:selected` |
| `src/renderer/main-process-api/GithubService.ts` | Remote tree, meta, star |
| `src/renderer/main-process-api/GitService.ts` | Local git / contributors |
