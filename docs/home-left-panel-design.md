# Home Left Panel — Web-App-Style Browse Surface for the Principal Window

> **Intended design** for the new `home-panel` workspace view: a SlidePane-driven
> left panel that mirrors the web app's home left rail, giving browse-only users
> a familiar starting point. This doc is the source of truth for the target
> shape, the component inventory, and the integration contract.

## Goal & motivation

Users who primarily **browse** repositories (rather than clone/develop them)
need a landing surface that feels like the web app's home page — a profile card
and a set of nav cards that drill into their projects, starred repos,
collections, bookmarks, trails, and recent items. The existing Projects left
panel is clone/dev-oriented (auth settings, feed modes, terminal forwarders);
this new panel is browse-oriented and sits **alongside** Projects as a separate
workspace surface.

### What we copied from the web app

The web app's home left panel (`web-ade/src/components/home/`) is a
`SlidePane` carousel driven by a `view` state:

| Web-app component | Electron-app counterpart |
| --- | --- |
| `HomeLeftPanel.tsx` | `src/renderer/panels/home-panel/HomeLeftPanel.tsx` |
| `UserAboutCard.tsx` | `src/renderer/panels/home-panel/UserAboutCard.tsx` |
| `HomeNavCards.tsx` | `src/renderer/panels/home-panel/HomeNavCards.tsx` |
| `HomeProjectsView.tsx` | `src/renderer/panels/home-panel/sub-views/HomeProjectsSubView.tsx` |
| `HomeStarredView.tsx` | `src/renderer/panels/home-panel/sub-views/HomeStarredSubView.tsx` |
| `HomeCollectionsView.tsx` | `src/renderer/panels/home-panel/sub-views/HomeCollectionsSubView.tsx` |
| `HomeTrailsTopicsView.tsx` (bookmarks) | `src/renderer/panels/home-panel/sub-views/HomeBookmarksSubView.tsx` |
| `HomeTrailsTopicsView.tsx` (library) | `src/renderer/panels/home-panel/sub-views/HomeLibrarySubView.tsx` |
| `HomeRecentlyVisitedView.tsx` | `src/renderer/panels/home-panel/sub-views/HomeRecentSubView.tsx` |
| `SlidePane.tsx` | `src/renderer/components/SlidePane/SlidePane.tsx` (shared) |
| `RailPaneHeader.tsx` | `src/renderer/panels/home-panel/sub-views/SubViewHeader.tsx` |
| `languageColors.ts` | `src/renderer/panels/home-panel/languageColors.ts` |

### What we deliberately changed

1. **Inline styles, not Tailwind.** The electron app uses `useTheme()` + inline
   `style` objects throughout. All components were converted from Tailwind
   classes to inline styles.

2. **`SlidePane` is a shared component.** Extracted to
   `src/renderer/components/SlidePane/` so other surfaces (Trails, Topics) can
   reuse the same animated carousel without re-implementing it.

3. **Data fetching is self-contained.** The web app fetches all data in
   `SignedInHome.tsx` (a connected wrapper). The electron app's `HomeLeftPanel`
   fetches its own data using existing services (`GithubService`,
   `WebAdeService`, `TopicService`) and the `useAuthState` hook.

4. **View ID is `home-panel`, not `home`.** The existing `home` NavigationView
   is the overlay `HomeView` dashboard (toggled from the titlebar).
   `home-panel` is a workspace surface that lives in the persistent
   `PrincipalPortal` / `WorkspaceShell` — a different layer.

## Architecture

### Where it sits in the panel system

```
IntegratedShell (owns activeView state)
  ├── NavigationSidebar (new Home icon button at top)
  └── PrincipalPortal
       └── WorkspaceShell (activeView === 'home-panel')
            └── HomeLeftPanel
                 ├── SlidePane (shared animated carousel)
                 │    ├── [view='home']  → UserAboutCard + HomeNavCards
                 │    ├── [view='projects']  → HomeProjectsSubView
                 │    ├── [view='starred']   → HomeStarredSubView
                 │    ├── [view='collections'] → HomeCollectionsSubView
                 │    ├── [view='bookmarks'] → HomeBookmarksSubView
                 │    ├── [view='library']   → HomeLibrarySubView
                 │    └── [view='recent']    → HomeRecentSubView
                 └── (emits repository:selected on the shell's local events bus)
```

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
  'home', 'projects', 'starred', 'collections', 'bookmarks', 'library', 'recent',
];
```

Other surfaces can import `SlidePane` + `makeSlideDirection` and provide their
own ordering + content. The component is framework-agnostic — it knows nothing
about the Home panel's specific views.

### The default "home" view

The overview shows two stacked blocks:

1. **`UserAboutCard`** — the signed-in user's GitHub profile (avatar, name,
   @login, bio, public repo count, join date, company, location,
   followers/following). Includes a skeleton loading state. Fetches via
   `GithubService.getCurrentUser()` + `useAuthState()`.

2. **`HomeNavCards`** — 6 clickable cards, each with an icon, label,
   description, optional count badge, and a chevron-right:
   - Your Projects → grouped repos (user's own + org repos)
   - Starred Projects → flat starred repo list with filter + sort
   - Collections → starred collections from web-ade
   - Bookmarks → inbox trails (proxied; dedicated bookmarks API is WIP)
   - Your Trails & Topics → local topics from `TopicService`
   - Recently Visited → recent projects from localStorage

### Sub-views

Each sub-view leads with a `SubViewHeader` (back chevron + label + count) and
contains its own scrollable content. All sub-views are rendered conditionally
inside the SlidePane — only the active view is mounted.

| Sub-view | Data source | Notes |
| --- | --- | --- |
| Projects | `GithubService.getUserRepositories` + `getOrgRepositories` | Grouped by owner with sticky section headers; filter when ≥ 8 repos |
| Starred | `GithubService.getUserStarredRepositories` | Filter + sort (A-Z / Stars / Updated) |
| Collections | `WebAdeService.getStarredCollections` | Flat list; create/detail deferred |
| Bookmarks | `WebAdeService.getInbox` | Proxied from inbox until dedicated bookmarks API lands |
| Library | `TopicService.getTopics` | Local topics only; trails listing is WIP |
| Recent | `localStorage.getItem('recent-repositories')` | Projects only; trails deferred |

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
| `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx` | Added `'home-panel'` to `VIEW_OPTIONS`, `viewCollapsedStates` defaults, and both reset handlers |

### Event contract

The Home panel emits `repository:selected` on the shell's **local** `events`
bus (the `PanelEventEmitter` passed as a prop from `WorkspaceShell`). The
payload must be a `RepositorySelectedPayload` (not a plain object) — built via
the existing `payloadFromGithub` / `payloadFromLocalEntry` helpers from
`src/renderer/events/repositorySelected.ts`.

**This is the contract that was broken in the initial implementation** (sending
`{ repositoryId: full_name }` instead of the proper payload), causing a crash
in `RepositoryProfilePanel` at `getInitials(repositoryData.name)` because
`repositoryData` was `undefined`. The fix: split `full_name` into owner/name,
match against local clones (`repositories` prop), and build the payload with
the shared helpers — the same pattern used by `ProjectsList` and
`StarredReposList`.

## Decisions locked

- **Separate button, not a replacement.** The Home panel gets its own icon in
  the `NavigationSidebar` alongside (before) Projects. Both remain accessible.
  Projects is clone/dev-oriented; Home is browse-oriented.

- **Animated slide transitions.** Sub-views slide in/out via the shared
  `SlidePane` component with a 320ms CSS `translateX` animation. Direction is
  determined by the positional ordering array.

- **`SlidePane` is shared.** Lives in `src/renderer/components/SlidePane/` so
  other surfaces can reuse it. The component is generic — it knows nothing
  about the Home panel's specific views.

- **`home-panel` as the view ID.** Avoids collision with the existing `home`
  overlay view (the `HomeView` dashboard toggled from the titlebar).

- **Inline styles, not Tailwind.** Matches the electron app's conventions.

## Known gaps & follow-ups

| Gap | Status | Notes |
| --- | --- | --- |
| Bookmarks | Proxied from inbox | Dedicated bookmarks API (`getBookmarkedTrails` / `getBookmarkedTopics`) doesn't exist in the electron app yet |
| Library — trails | WIP | No local trails listing API; only topics shown via `TopicService.getTopics()` |
| Recently visited — trails | Deferred | Only projects from localStorage; trails deferred until a recent-trails listing is available |
| Collections — create/detail | Deferred | Collection create modal and detail drilldown are not wired yet |
| Repo click → right pane | Not wired | `repository:selected` is emitted but the right pane in `WorkspaceShell` is a placeholder; the profile panel renders as a tab via the forwarder |

## File inventory

### New files

| File | Purpose |
| --- | --- |
| `src/renderer/components/SlidePane/SlidePane.tsx` | Shared animated carousel (reusable) |
| `src/renderer/components/SlidePane/makeSlideDirection.ts` | Direction resolver helper |
| `src/renderer/components/SlidePane/index.ts` | Barrel export |
| `src/renderer/panels/home-panel/HomeLeftPanel.tsx` | Main orchestrator + data fetching |
| `src/renderer/panels/home-panel/UserAboutCard.tsx` | GitHub profile card |
| `src/renderer/panels/home-panel/HomeNavCards.tsx` | 6 nav cards |
| `src/renderer/panels/home-panel/languageColors.ts` | Language color helper |
| `src/renderer/panels/home-panel/index.ts` | Barrel export |
| `src/renderer/panels/home-panel/sub-views/SubViewHeader.tsx` | Shared back-header for sub-views |
| `src/renderer/panels/home-panel/sub-views/HomeProjectsSubView.tsx` | Projects sub-view |
| `src/renderer/panels/home-panel/sub-views/HomeStarredSubView.tsx` | Starred sub-view |
| `src/renderer/panels/home-panel/sub-views/HomeCollectionsSubView.tsx` | Collections sub-view |
| `src/renderer/panels/home-panel/sub-views/HomeBookmarksSubView.tsx` | Bookmarks sub-view |
| `src/renderer/panels/home-panel/sub-views/HomeLibrarySubView.tsx` | Library sub-view |
| `src/renderer/panels/home-panel/sub-views/HomeRecentSubView.tsx` | Recently visited sub-view |

### Modified files

| File | Change |
| --- | --- |
| `src/shared/types/userPreferences.types.ts` | Added `'home-panel'` to `InteractiveShellNavigationView` |
| `src/renderer/principal-window/components/PrincipalPortal/PrincipalPortal.tsx` | Added `'home-panel'` to `WorkspaceView`, `WORKSPACE_VIEWS`, routing guard |
| `src/renderer/workspace-shell/WorkspaceShell.tsx` | Added `'home-panel'` to `WorkspaceView`; import + render `HomeLeftPanel`; label mapping |
| `src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx` | Added `Home` icon import + nav item |
| `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx` | Added `'home-panel'` to `VIEW_OPTIONS`, collapsed-state defaults, both reset handlers |
