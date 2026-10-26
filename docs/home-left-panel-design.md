# Home Left Panel — Browse Surface for the Principal Window

> **Intended design** for the `home-panel` workspace view: a SlidePane-driven
> left panel that mirrors the web app's home left rail, giving browse-only users
> a familiar starting point. This doc is the source of truth for the target
> shape, the component inventory, and the integration contract.

## Goal & motivation

Users who primarily **browse** repositories (rather than clone/develop them)
need a landing surface that feels like the web app's home page. The Home panel is
profile-and-work oriented: the signed-in user's profile card, a search across
every repo they can reach, and the list of repositories they are currently
working in (uncommitted changes / unpushed commits).

The **Projects** surface (`ProjectsLeftPanel`) is the clone/dev-oriented
counterpart — the repo browser with the Owned / Cloned / Starred filters. Home
sits **alongside** it as a separate workspace surface.

### What we copied from the web app

The web app's home left panel (`web-ade/src/components/home/`) is a
`SlidePane` carousel driven by a `view` state:

| Web-app component | Electron-app counterpart |
| --- | --- |
| `HomeLeftPanel.tsx` | `src/renderer/panels/home-panel/HomeLeftPanel.tsx` |
| `UserAboutCard.tsx` | `src/renderer/panels/home-panel/UserAboutCard.tsx` |
| `SlidePane.tsx` | `src/renderer/components/SlidePane/SlidePane.tsx` (shared) |
| `RailPaneHeader.tsx` | `src/renderer/panels/home-panel/sub-views/FollowersFollowingSubView.tsx` (inline header) |

### What we deliberately changed

1. **Inline styles, not Tailwind.** The electron app uses `useTheme()` + inline
   `style` objects throughout. All components were converted from Tailwind
   classes to inline styles.

2. **`SlidePane` is a shared component.** Extracted to
   `src/renderer/components/SlidePane/` so other surfaces can reuse the same
   animated carousel without re-implementing it.

3. **Data fetching is self-contained.** The web app fetches all data in
   `SignedInHome.tsx` (a connected wrapper). The electron app's `HomeLeftPanel`
   fetches its own data using existing services (`GithubService`,
   `RepositoryMonitoringService`) plus the `useAuthState` hook.

4. **View ID is `home-panel`, not `home`.** The existing `home` NavigationView
   is the overlay `HomeView` dashboard (toggled from the titlebar as
   **Dashboard**). `home-panel` is the sidebar **Home** workspace surface that
   lives in the persistent `PrincipalPortal` / `WorkspaceShell` — a different
   layer.

## Architecture

### Where it sits in the panel system

```
IntegratedShell (owns activeView state)
  ├── NavigationSidebar (Home icon button at top)
  └── PrincipalPortal
       └── WorkspaceShell (activeView === 'home-panel')
            └── HomeLeftPanel
                 ├── UserAboutCard        (profile; followers/following links)
                 ├── InProgressBar        ("N in progress" + Open → In Progress tab)
                 ├── HomeSearchBar        (always)
                 ├── HomeSearchResults    (while a query is active)
                 ├── OrgSectionHeaderCard + OrgRepoItemCard
                 │                        (in-progress rows, grouped by owner; empty query)
                 ├── RepoAboutCard         (slides over when a repo is selected)
                 └── FollowersFollowingSubView (followers / following)
```

Data flow for the in-progress list: `useInProgressRepos` asks
`RepositoryMonitoringService.getGitStatusWithFiles(path)` for every local repo,
keeps those with a dirty tree or `ahead > 0`, and stays live via
`onGitStatusChanged`. The In Progress tab renders the same set as File City
cards (`InProgressRepoCard`); the Home rail renders it with the Projects-surface
presentation — grouped by owner (`OrgSectionHeaderCard`) with `OrgRepoItemCard`
rows.

### Terminal program status

Open terminal rows, both nested under a repository and in the standalone list,
show the same OSC 7501 status badges as the terminal tab bar. `WorkspaceShell`
uses `usePanelProgramStatus()` to select one record per session, then
`homeProgramStatus.ts` maps session contexts to workspace tab IDs. This keeps
terminals in the same directory independent and supports restored and foreign
tabs.

`HomeLeftPanel.programStatusByTab` forwards live records to
`HomeTabRow.programStatus`, which renders the shared `ProgramStatusBadge`.
Working, blocked, done, and error are visible even when their tab is inactive.
Idle, clear, and missing records render no indicator. Status is never written
into the persisted pin descriptors.

`useTerminalProgramStatusState` subscribes to broadcasts before fetching the
current records through `getAllProgramStatus`. Updates received during that
fetch take precedence over the snapshot, including explicit clears. No status
is inferred from terminal output or silence.

### The SlidePane carousel

`SlidePane` (`src/renderer/components/SlidePane/SlidePane.tsx`) is a
**shared, reusable** horizontal carousel:

- Accepts a `viewKey: string` (current view) and a
  `resolveDirection: (from, to) => 1 | -1` function.
- Animates via CSS `translateX` keyframes at 320ms ease.
- The outgoing pane is snapshotted into a leaving layer; the incoming pane
  slides in from the right (forward) or left (back).
- Direction is determined by a positional ordering array — "forward" in the
  list slides from the right, "back" slides from the left.

`makeSlideDirection(order)` builds a resolver from an ordered array of view
keys. The Home panel's ordering:

```ts
const HOME_SLIDE_ORDER = [
  'home', 'followers', 'following',
];
```

Other surfaces can import `SlidePane` + `makeSlideDirection` and provide their
own ordering + content. The component is framework-agnostic — it knows nothing
about the Home panel's specific views.

### The default "home" view

Stacked top to bottom:

1. **`UserAboutCard`** — the signed-in user's GitHub profile (avatar, name,
   @login, bio, public repo count, join date, company, location,
   followers/following). Includes a skeleton loading state. Fetches via
   `GithubService.getCurrentUser()` + `useAuthState()`, falling back to the
   global git identity when GitHub isn't available. The followers / following
   links slide to their sub-views.

2. **`InProgressBar`** — a full-width status row: "N in progress" (or "Nothing
   in progress") with an **Open** button that opens the singleton
   `in-progress-activity` workspace tab. `N` is `useInProgressRepos().length`.

3. **`HomeSearchBar`** — always rendered. Searches across three sources ("Your
   Projects" GitHub repos, local clones, and starred repos), merging by
   `full_name` / path so a repo that is both owned and cloned shows once with
   both tags. Starred repos are fetched lazily on first search.

4. **In-progress rows** — while the search is empty, the list of repos with
   uncommitted changes or unpushed commits, grouped by owner with the Projects
   surface's `OrgSectionHeaderCard` (avatar + owner + repo count) and rendered
   with its `OrgRepoItemCard` rows (repo icon + "In Progress" dirty dot, name,
   a right-aligned `↑ahead` / `↓behind` remote indicator, and hover-revealed
   open-terminal / drag-to-terminal affordances). The
   signed-in login's owner sorts first; "Untracked" last. Clicking a row opens
   the repo profile tab. When a query is active, `HomeSearchResults` replaces the
   list.

### Sub-views

Followers / Following slide in from the profile card via the shared `SlidePane`;
only the active view is mounted.

| Sub-view | Data source | Notes |
| --- | --- | --- |
| Followers | `GithubService.getUserFollowers(login)` | Flat list; clicking a user opens their profile tab |
| Following | `GithubService.getUserFollowing(login)` | Flat list; clicking a user opens their profile tab |

## Integration contract

### View registration

`home-panel` is a **workspace view** (not an overlay). It's registered in
every place that enumerates workspace surfaces:

| File | Change |
| --- | --- |
| `src/shared/types/userPreferences.types.ts` | Added `'home-panel'` to `InteractiveShellNavigationView` |
| `src/renderer/principal-window/components/PrincipalPortal/PrincipalPortal.tsx` | Added `'home-panel'` to `WorkspaceView` union + `WORKSPACE_VIEWS` array + routing guard |
| `src/renderer/workspace-shell/WorkspaceShell.tsx` | Added `'home-panel'` to `WorkspaceView` type; renders `HomeLeftPanel` when `activeView === 'home-panel'`; label maps to `'Home'` |
| `src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx` | Added `{ id: 'home-panel', icon: <Home />, label: 'Home' }` as the first top nav item |
| `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx` | Added `'home-panel'` to `viewCollapsedStates` defaults + reset handlers |

### Event contract

The Home panel emits open intents on the shell's **local** `events` bus (the
`PanelEventEmitter` passed as a prop from `WorkspaceShell`). Payloads must be the
typed payloads (not plain objects) — built via the existing
`payloadFromGithub` / `payloadFromLocalEntry` helpers from
`src/renderer/events/repositorySelected.ts`. `installProjectsOpenForwarder`
lifts the open-intent subset onto the portal bus.

- `repository:selected` — an in-progress row is clicked → repo profile tab.
- `repository:guide-open` — a search result is clicked → File City guide tab.
- `owner:selected` — an in-progress row's avatar, or a followers/following user
  → user/org profile tab.

**This is the contract that was broken in the initial implementation** (sending
`{ repositoryId: full_name }` instead of the proper payload), causing a crash
in `RepositoryProfilePanel` at `getInitials(repositoryData.name)` because
`repositoryData` was `undefined`. The fix: split `full_name` into owner/name,
match against local clones (`repositories` prop), and build the payload with
the shared helpers — the same pattern used by `ProjectsList`.

## Decisions locked

- **Separate button.** The Home panel has its own icon in the
  `NavigationSidebar` alongside (before) Projects. Projects is clone/dev-oriented;
  Home is profile-and-work oriented.

- **Search + in-progress, not nav cards.** The Home panel does not duplicate
  project/clone/starred *browsing* with nav cards; the search bar covers finding
  a repo, and the panel below it is the in-progress list. The **Projects**
  surface remains the clone/dev browser for users who enable it.

- **Animated slide transitions.** Followers / Following slide in/out via the
  shared `SlidePane` component with a 320ms CSS `translateX` animation.

- **`home-panel` as the view ID.** Avoids collision with the existing `home`
  overlay view (the `HomeView` dashboard toggled from the titlebar as
  **Dashboard**).

- **Inline styles, not Tailwind.** Matches the electron app's conventions.

## Known gaps & follow-ups

| Gap | Status | Notes |
| --- | --- | --- |
| Repo click → right pane | Not wired | `repository:selected` is emitted but the right pane in `WorkspaceShell` is a placeholder; the profile panel renders as a tab via the forwarder |

## File inventory

| File | Purpose |
| --- | --- |
| `src/renderer/components/SlidePane/SlidePane.tsx` | Shared animated carousel (reusable) |
| `src/renderer/components/SlidePane/makeSlideDirection.ts` | Direction resolver helper |
| `src/renderer/components/SlidePane/index.ts` | Barrel export |
| `src/renderer/panels/home-panel/HomeLeftPanel.tsx` | Main orchestrator + data fetching |
| `src/renderer/panels/home-panel/UserAboutCard.tsx` | GitHub / git profile card |
| `src/renderer/panels/home-panel/InProgressBar.tsx` | In-progress status row + Open button |
| `src/renderer/panels/home-panel/useInProgressRepos.ts` | In-progress list (git-status backed) |
| `src/renderer/panels/cards/OrgRepoItemCard.tsx` | In-progress repo row (shared with the Projects surface) |
| `src/renderer/panels/cards/OrgSectionHeaderCard.tsx` | Owner section header for the grouped rows (shared) |
| `src/renderer/panels/home-panel/HomeSearch.tsx` | Search bar + merged result list |
| `src/renderer/panels/home-panel/RepoAboutCard.tsx` | Selected-repo About card (slides over) |
| `src/renderer/panels/home-panel/sub-views/FollowersFollowingSubView.tsx` | Followers / following list |
| `src/renderer/panels/home-panel/index.ts` | Barrel export |
