# RepoAboutCard — Planned Left-Rail Repo About Surface (electron-app)

> How a **selected-repo About card** will appear in the desktop Home left panel
> when the user picks a repository from any sub-view. This is the electron-app
> counterpart of web-ade's `RepoAboutCard` / `RepoOverview` left-rail extract.
> For the full profile hub that opens as a tab, see
> [repository-profile-panel-surface.md](./repository-profile-panel-surface.md).

## What it is (today)

The Home left panel (`HomeLeftPanel`) has two layers in its default `"home"`
view:

1. **`UserAboutCard`** — the signed-in user's GitHub profile (avatar, login,
   bio, stats). Always visible at the top.
2. **`HomeNavCards`** — clickable nav cards (Projects, Other Clones, Starred,
   Collections, Recent).

When the user selects a repo from any sub-view (Projects, Starred, Other
Clones, …), the panel emits `repository:selected` on the shell events bus,
which opens `RepositoryProfilePanel` as a **tab** in the right pane. The left
panel does **not** currently show any repo-specific about information — it
stays on the sub-view the user was browsing.

## What it will be

A **`RepoAboutCard`** that replaces (or slides in place of) the `UserAboutCard`
when a repository is selected in the left rail, giving the user a quick
overview without leaving the home surface. This mirrors web-ade's behavior
where `RepoAboutCard` appears in the left rail on `owner/repo` routes.

### When it appears

- User clicks a repo row in any left-rail sub-view (Projects, Starred, Other
  Clones, Recent)
- User navigates to a repo via search, activity cards, or other entry points
  that emit `repository:selected`
- The left panel slides back to the `"home"` view with the `RepoAboutCard`
  replacing the `UserAboutCard`

### When it dismisses

- User clicks back / navigates to the sidebar Home button → returns to
  `UserAboutCard` + `HomeNavCards`
- User selects a different repo → card updates in place
- User signs out → falls back to `UserAboutCard`

## Proposed card content

| Section | Source | Notes |
| --- | --- | --- |
| Owner avatar + repo name | `RepositorySelectedPayload.github` | Clickable → opens `RepositoryProfilePanel` tab |
| Description | `github.description` | Truncated to 2–3 lines |
| Language + star count | `github.primaryLanguage`, `github.stars` | Inline badges |
| Default branch | `github.defaultBranch` | Subtle label |
| Local clone status | Match against `repositories` (Alexandria entries) | "Cloned at ~/…" or "Not cloned" |
| Quick actions | Open workspace, Open terminal, Clone/Fork | Only if local clone exists; mirrors profile panel actions |

The card is intentionally **lighter** than `RepositoryProfilePanel` — it is a
preview, not the full hub. Users who want the full experience click through to
the profile tab.

## Relationship to other surfaces

| Surface | Scope | Lives |
| --- | --- | --- |
| **RepoAboutCard** (this doc) | Left-rail preview of a selected repo | electron-app Home left panel |
| `RepositoryProfilePanel` | Full project hub tab (heatmap, city, clones, contributors, README) | electron-app profile tab |
| web-ade `RepoAboutCard` / `RepoOverview` | Left-rail about on `owner/repo` routes | web-ade |
| `UserAboutCard` | Signed-in user profile (always in left rail when no repo selected) | electron-app Home left panel |

## Open path (proposed)

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
        → renders RepoAboutCard instead of UserAboutCard
```

The existing `repository:selected` → tab flow is preserved. The RepoAboutCard
is an **addition** to the left rail, not a replacement for the tab.

## Integration with HomeLeftPanel

### State additions

```ts
// In HomeLeftPanel
const [selectedRepo, setSelectedRepo] = useState<RepositorySelectedPayload | null>(null);
```

When `emitRepoSelected` or `emitLocalEntrySelected` fires, the panel stores
the payload and slides to the home view.

### View routing

The `"home"` view branch in the `SlidePane` would conditionally render:

```tsx
{view === 'home' ? (
  selectedRepo ? (
    <RepoAboutCard
      repo={selectedRepo}
      onDismiss={() => setSelectedRepo(null)}
      onOpenProfile={() => { /* emit repository:selected to open tab */ }}
    />
  ) : (
    <>
      <UserAboutCard info={aboutUser} loading={userLoading} />
      <HomeNavCards … />
    </>
  )
  // … rest of sub-views
) : null}
```

### Data requirements

`RepoAboutCard` needs a subset of `RepositorySelectedPayload`:

```ts
interface RepoAboutCardData {
  owner: string;
  name: string;
  description?: string;
  stars?: number;
  primaryLanguage?: string;
  isPublic?: boolean;
  defaultBranch?: string;
  // Enriched from local clones:
  localClone?: {
    path: string;
    branch: string;
    ahead: number;
    behind: number;
    dirty: boolean;
  };
}
```

Enrichment (local clone status) comes from matching `selectedRepo.purl`
against the `repositories` prop (Alexandria entries).

## Explicit non-goals

- **Not a replacement for `RepositoryProfilePanel`.** The card is a preview;
  the full hub with heatmap, city, contributors, and README stays in the tab.
- **Not a host of `FileCityGuidePanel`.** No guide modes (tour/commit/readme)
  in the left rail.
- **Not the `UserAboutCard`.** These are two distinct cards — user profile vs.
  repo profile. The `UserAboutCard` always returns when no repo is selected.

## Status

- [ ] Design card layout (avatar overlap, description truncation, badge row)
- [ ] Add `selectedRepo` state to `HomeLeftPanel`
- [ ] Build `RepoAboutCard` component
- [ ] Wire sub-view repo selections to set `selectedRepo` + slide home
- [ ] Add quick-action buttons (open workspace, terminal, clone)
- [ ] Dismissal logic (Home button, sign-out, different repo)
- [ ] Loading / skeleton state for enriched data (local clone status)

## Related docs

| Doc | Scope |
| --- | --- |
| [repository-profile-panel-surface.md](./repository-profile-panel-surface.md) | Full profile hub tab |
| [home-left-panel-design.md](./home-left-panel-design.md) | Home left rail architecture |
| [repository-profile-panel-architecture.md](./repository-profile-panel-architecture.md) | Profile panel internals |
| web-ade `docs/repo-about-surface.md` | Web RepoAboutCard / RepoOverview |

## Key source paths

| Path | Role |
| --- | --- |
| `src/renderer/panels/home-panel/HomeLeftPanel.tsx` | Home left rail orchestrator |
| `src/renderer/panels/home-panel/UserAboutCard.tsx` | Current user profile card |
| `src/renderer/panels/home-panel/HomeNavCards.tsx` | Nav cards |
| `src/renderer/events/repositorySelected.ts` | Payload builders |
| `src/renderer/panels/RepositoryProfilePanel.tsx` | Full profile tab (target of click-through) |
