# File City Sequence Diagram Sharing — Desktop Integration

This document describes how the desktop app publishes a saved sequence-diagram payload to web-ade so a teammate with GitHub access to the same repo can open the walkthrough in a browser.

The web-ade side is documented at [`web-ade/docs/file-city-sequence-diagram-sharing.md`](https://github.com/principal-ade/web-ade/blob/main/docs/file-city-sequence-diagram-sharing.md). API + storage layout + access model live there; this doc covers what we change inside `electron-app` to talk to it.

This work is **Slice 3** in that doc's status checklist. Slice 1 (web-ade backend) is shipped and round-trippable today; Slice 2 (extracting the renderer for the web viewer) is a parallel track that doesn't gate Slice 3 — we can ship the publish path first and links will work as soon as the viewer page lands.

## Background

Persisted sequence diagrams live in `userData/file-city-sequence-diagrams/` and never leave the producing machine. There's no way for a reviewer who isn't sitting at the producer's keyboard to see a walkthrough that was generated for them. The web-ade side now exposes a small "private gist for the repo" API gated by GitHub repo-read access. We need a one-click flow from the dev-workspace sidebar that:

1. Resolves the repo's GitHub origin.
2. Bakes any reference-only diff snippets into self-contained content.
3. Posts the payload to web-ade with the user's GitHub token.
4. Returns the share URL for clipboard / browser hand-off.

## Goals

- One-click "Share…" from `SequenceDiagramRow` in the dev-workspace sidebar.
- Self-contained payload upload — the receiver doesn't need a local checkout to view diff snippets.
- Reuse the existing GitHub token already stored in `UnifiedSecureStorage`; no new auth.
- Surface a URL the user can copy or open in a browser.
- Stamp the row with a "shared" indicator and switch the action to "Copy link" once a share has been posted.
- List shares for the current repo in the sidebar alongside local payloads, with click-to-hydrate. Doubles as the round-trip smoke test for the share path.

## Non-goals

- Editing or replacing a previously-shared payload (re-share creates a new record on the web-ade side; we surface that without ceremony).
- Curating, deleting, or editing shares from the desktop — listing is in scope (see [Fetching shared sequences](#fetching-shared-sequences)); mutation belongs to web-ade.
- Implementing the viewer itself (Slice 2 in the web-ade doc).
- Hydrating snippets from GitHub at view time (deferred — the producer-side hook for it is documented as the optional `gitRef` field on `DiffSnippet` and we don't populate it today).

## Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│              Dev Workspace renderer (sidebar panel)                │
│  - "Share…" action on SequenceDiagramRow                           │
│  - Calls SequenceDiagramShareService.share(id)                     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ IPC: file-city:sequence-diagram:share
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│             SequenceDiagramStore (main, existing)                  │
│  - Loads payload by id                                             │
│  - Resolves owner/repo from `git remote get-url origin`            │
│  - Bakes newContents for snippets that have only oldContents       │
│  - Reads stored GitHub token from UnifiedSecureStorage             │
│  - POSTs to web-ade /api/sequence-diagrams                         │
│  - Returns { url } to renderer                                     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS POST
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                       web-ade (existing)                           │
│  - Verifies repo read access via GitHub API                        │
│  - Writes sequence-diagrams/{owner}/{repo}/{id}.json + index.json  │
│  - Returns { id, url, entry }                                      │
└────────────────────────────────────────────────────────────────────┘
```

## Goals + non-goals are already covered upstream

The web-ade doc enumerates the access model, error codes, payload validation, snippet handling, and viewer URL shape. Don't duplicate those decisions here — link out to that doc when relevant.

## Key files reference

### Existing infrastructure

| File | Purpose |
|------|---------|
| `src/main/file-city/sequenceDiagramStore.ts` | Persistence + IPC + broadcast layer; gains `share()` method |
| `src/main/file-city/sequenceDiagramPersistence.ts` | On-disk store; we read `loadById(id)` for the bake step |
| `src/main/services/UnifiedSecureStorage.ts` | Stores the GitHub token under `TOKEN_KEYS.GITHUB_TOKEN` |
| `src/main/file-system/gitRepositoryService.ts` | Reference for "read GitHub token from secure storage and call api.github.com" — pattern to mirror |
| `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts` | Shared types + IPC enum |
| `src/window/main-process-api-implementations/fileCitySequenceApi.ts` | Renderer-facing API surface (preload) |
| `src/renderer/dev-workspace/sequence-diagrams-panel/SequenceDiagramRow.tsx` | Sidebar row — gets the new "Share" action; reused for shared-row rendering |
| `src/renderer/dev-workspace/sequence-diagrams-panel/SequenceDiagramsPanel.tsx` | Panel root — gains a "Shared with this repo" section that lists+hydrates web-ade shares |

### New files

| File | Purpose |
|------|---------|
| `src/main/file-city/sequenceDiagramShare.ts` | Bake + post helper plus list/fetch helpers. Walks the payload, lifts `newContents` from disk, resolves origin, performs the HTTPS calls (POST share, GET list, GET single), returns shaped results |
| `src/renderer/services/SequenceDiagramShareService.ts` | Renderer-side wrapper around `mainProcess.fileCitySequence.{share,listShared,fetchShared}` mirroring the existing `SequenceDiagramService` pattern |

The desktop bridge already exposes localhost-only HTTP routes. We deliberately do **not** add a bridge route for share — sharing requires the user's GitHub token, and we keep that out of the bridge surface to avoid a localhost browser tab being able to publish on behalf of the user. Share is renderer-only, IPC-only.

## IPC contract

Add to `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`:

```ts
export enum FileCitySequenceEvent {
  // …existing entries…
  SHARE = 'file-city:sequence-diagram:share',
  LIST_SHARED = 'file-city:sequence-diagram:list-shared',
  FETCH_SHARED = 'file-city:sequence-diagram:fetch-shared',
}

export interface FileCitySequenceShareResult {
  url: string;
  id: string;
  entry: SharedSequenceDiagramIndexEntry;
}

export interface FileCitySequenceAPI {
  // …existing methods…
  share: (
    id: string,
    options?: { owner?: string; repo?: string },
  ) => Promise<FileCitySequenceShareResult>;
  listShared: (
    options?: { owner?: string; repo?: string },
  ) => Promise<SharedSequenceDiagramIndexEntry[]>;
  fetchShared: (
    owner: string,
    repo: string,
    id: string,
  ) => Promise<SequenceDiagramPayload>;
}
```

`SharedSequenceDiagramIndexEntry` is duplicated from web-ade's type as called out in the web-ade doc's "Type duplication is expected for now" note. When a shared types package lands we'll swap both repos at once.

The renderer can pre-resolve `owner`/`repo` when it has them in scope (most of the time it does — the panel knows `repositoryPath` and the payload carries it). Main re-resolves and validates regardless so callers can't post to the wrong repo by mistake.

## Bridge route policy

**No new bridge route.** Adding `POST /api/file-city/sequence/:id/share` to the localhost bridge was an option we rejected:

- The localhost bridge has no shared-secret today — any local browser tab can hit it.
- Sharing reads the user's GitHub token from secure storage and posts content authored by them.
- Letting any local origin trigger that is asymmetric with our existing posture (notes are also IPC-only; same reasoning).

If a future automation needs to share programmatically (an MCP tool, say), we'd add a bridge route gated by an explicit per-process secret rather than CORS-defaulted-`*`.

## Origin derivation

```ts
// inside sequenceDiagramShare.ts
async function resolveGithubOrigin(
  repositoryPath: string,
): Promise<{ owner: string; repo: string }> {
  // Run `git remote get-url origin` against repositoryPath using the same
  // simple-git instance the rest of main uses (gitRepositoryService.ts has
  // the canonical reference for that wiring).
  // Parse: github.com[:/]<owner>/<repo>(\.git)?$
  // Return on first match. Throw a typed error otherwise — the renderer
  // surfaces it as "Sharing requires a GitHub remote on this repo".
}
```

If the user has multiple GitHub remotes, prefer `origin`. If `origin` isn't a GitHub URL, fall back to the first remote that is and surface a confirmation prompt with the repo it picked.

If the renderer passed `options.owner` / `options.repo`, accept those after a sanity check that they match `/^[A-Za-z0-9._-]+$/`. They override the git-remote derivation. Useful for forks where the user wants to share against the upstream repo.

## Bake step

`SequenceDiagramPayload.events[].snippet` can be `slice` or `diff`. Slice snippets are already self-contained on the web-ade side — they carry `sourcePath` + line ranges and the viewer hydrates from GitHub by path. Diff snippets need attention.

Today our diff snippets carry `oldContents` always; `newContents` is optional and the renderer reads from disk at view time. For the web viewer, every diff snippet must arrive with `newContents` baked in (web-ade rejects unbaked snippets with `SNIPPET_NOT_BAKED`). The bake step lives in `sequenceDiagramShare.ts`:

```ts
async function bakeSnippets(
  payload: SequenceDiagramPayload,
  repositoryPath: string,
): Promise<{ baked: SequenceDiagramPayload; missing: string[] }> {
  const missing: string[] = [];
  const events = await Promise.all(
    payload.events.map(async (ev) => {
      const snippet = ev.snippet;
      if (!snippet || snippet.kind !== 'diff') return ev;
      if (snippet.newContents != null) return ev;
      if (!ev.sourcePath) {
        missing.push(`${ev.id} (no sourcePath)`);
        return ev;
      }
      const absPath = ev.sourcePath.startsWith('/')
        ? ev.sourcePath
        : path.join(repositoryPath, ev.sourcePath);
      try {
        const newContents = await fs.readFile(absPath, 'utf8');
        return { ...ev, snippet: { ...snippet, newContents } };
      } catch {
        missing.push(`${ev.id} (${ev.sourcePath})`);
        return ev;
      }
    }),
  );
  return { baked: { ...payload, events }, missing };
}
```

If `missing` is non-empty when we're done, throw a typed error up to the renderer with the file list — the row's "Share…" action surfaces a confirmation prompt before retrying with the speculative-content disclaimer ("3 snippets reference missing files; share anyway?"). Confirming retries the bake with `allowMissing: true` and we ship empty `newContents` for the missing ones; web-ade's validator will accept that path because the field is present.

### Notes ride along

This was shipped in `feat(file-city): user-authored notes on sequence payloads` (commit `5e2b1e5a8`). `payload.notes` is a regular field on the payload and will be uploaded as-is. The web-ade type duplication needs to extend its copy of `SequenceDiagramPayload` to include the `notes?: SequenceNote[]` field; until it does, web-ade may strip notes silently on its `payload` shape — confirm before shipping. If we want to support a "share without notes" toggle later, do it as a checkbox in the share dialog rather than a separate API.

## Auth

Read the GitHub token from the existing secure store:

```ts
import { storage } from '../services/UnifiedSecureStorage';
import { TOKEN_KEYS } from '../services/UnifiedSecureStorage';

const tokenData = await storage.getTokenWithMetadata(TOKEN_KEYS.GITHUB_TOKEN);
const githubToken = tokenData?.token;
if (!githubToken) {
  throw new ShareError('NO_GITHUB_TOKEN', 'Sign in to GitHub before sharing.');
}
```

Send it as `Authorization: Bearer <token>` per the web-ade doc. Never log the token; never include it in error responses surfaced to the renderer.

The `gitRepositoryService.ts` precedent (lines 716-730) is the pattern to mirror — same store, same key, same header shape.

## Renderer wiring

### Service

Add `src/renderer/services/SequenceDiagramShareService.ts`:

```ts
import type { FileCitySequenceShareResult } from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

export class SequenceDiagramShareService {
  static async share(
    id: string,
    options?: { owner?: string; repo?: string },
  ): Promise<FileCitySequenceShareResult | null> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return null;
    try {
      return await api.share(id, options);
    } catch (err) {
      console.error('[SequenceDiagramShareService] share failed', err);
      return null;
    }
  }
}
```

Mirrors `SequenceDiagramService` and `SequenceNotesService`. Components/hooks never touch `window.mainProcess` directly.

### Row action

`SequenceDiagramRow` gains a "Share" button in its hover/overflow cluster, alongside the existing trash icon. State machine:

- Idle → "Share…" button visible on hover.
- Clicking → sets a `sharing` flag; calls `SequenceDiagramShareService.share(entry.id)`.
- Success → row stamps a small "shared" indicator (use the `Share2` icon from lucide); button text flips to "Copy link"; clicking again copies the URL via `navigator.clipboard.writeText`. Toast: "Link copied — anyone with read access to {owner}/{repo} can view".
- Error path: show inline error with a tooltip carrying the message. Don't auto-retry. Recoverable cases (`NO_GITHUB_TOKEN`, `MISSING_FILES_NEEDS_CONFIRM`) prompt the user; everything else falls back to the generic message.

We don't track shared/unshared state in the local manifest. The row's "shared" stamp is **per-session** (a `Map<id, url>` in the panel's React state) — restarting the app resets the visual. This is fine because re-sharing creates a new web-ade record anyway, so persisting the link locally would be misleading. If users start asking for "show me everything I've shared", we surface that from web-ade's listing API rather than local state.

### Sidebar UI affordance details

- Button label: `Share…` (with ellipsis to signal a confirm step is possible).
- Order: `Share…` to the left of the existing trash icon, separated by a small divider.
- After successful share: button collapses to a `Share2` icon with tooltip "Copy link"; trash icon stays.
- "Replace shared copy" is **not** a v1 feature — sharing again creates a new record.

## Fetching shared sequences

Shared payloads aren't useful if they only flow one way. The sidebar lists shares for the current repo alongside local ones so:

- The producer can confirm a share round-trips (their just-uploaded entry shows up under "Shared with this repo" without leaving the desktop).
- Other contributors discover what's been shared for the repo they're working in without scraping links out of chat.

The web-ade side already exposes the GET endpoints needed (see the upstream doc); we just consume them. `listShared` mirrors `share`'s origin-resolution behavior — main re-derives `owner`/`repo` from the repo's git remote when callers don't pass them. `fetchShared` requires both because shared payloads are identified by the full `(owner, repo, id)` tuple on the web-ade side.

### Auth

Same GitHub token, same `Authorization: Bearer <token>` header. Web-ade gates GET behind the same repo-read access check it gates POST behind, so an unauthenticated or unauthorized caller gets `NO_REPO_ACCESS` from list/fetch the same way they would from share.

### Renderer wiring

`SequenceDiagramsPanel` holds two row collections:

- **Local** (existing): payloads in `userData/file-city-sequence-diagrams/`.
- **Shared** (new): index entries from `listShared()`, fetched on panel mount and refreshed after a successful share completes.

Render them in two labeled sections — "On this machine" and "Shared with this repo" — reusing `SequenceDiagramRow` for both. Shared rows differ only in:

- No trash action (deletion is web-ade's job; not a v1 desktop feature).
- Click-to-open hydrates the payload via `fetchShared` and pushes it through the existing visualizer pipeline.
- Author + shared-at timestamp from the index entry, shown muted below the title.

If the same `id` appears in both collections (the producer is looking at their own share), prefer the local entry and stamp it with the existing "shared" indicator instead of duplicating the row.

### Edge cases

- **No GitHub remote / no token.** Hide the "Shared" section silently — expected for non-GitHub repos and not worth a banner.
- **Empty list.** Show the section header with a muted "No shares yet" sub-line so users know the panel checked.
- **List fetch fails.** Show the section header with an inline error + retry. Don't block the local list.
- **Fetch-on-click fails.** Toast the error; leave the row in place so the user can retry.

### Round-trip verification

This is also the primary smoke test for Slice 3, end-to-end, without leaving the desktop:

1. Share a local payload from the producer machine.
2. Wait for the panel's shared list to refresh (the share success handler triggers it; manual refresh is a fallback).
3. Confirm the new entry appears under "Shared with this repo".
4. Click it — payload should hydrate and render identically to the local copy.

## Lifecycle / edge cases

- **Repo with no GitHub remote.** Refuse with a typed error. The row's button is enabled regardless because we don't know the repo state until the user clicks; the error surfaces inline at click time.
- **Multiple GitHub remotes.** Pick `origin` if it's a GitHub URL; otherwise pick the first GitHub remote and confirm.
- **Renamed/transferred repo.** The bake step uses whatever the local remote currently says. GitHub's redirect resolves the access check on the web-ade side; the share record gets the new owner/repo. Old shared records keep working under their original prefix because of the `githubRepoId` backstop on the index entry.
- **Bake found missing files.** As described under [Bake step](#bake-step) — confirm with the user before retrying with `allowMissing: true`.
- **Web-ade returns 403.** Translate `NO_REPO_ACCESS` into "GitHub says you don't have read access to {owner}/{repo}." Don't retry.
- **Network timeout.** Bubble up; the renderer surfaces "Couldn't reach web-ade — try again later." No silent retry; sharing is explicit.
- **10 MB cap.** Web-ade rejects payloads > 10 MB. After the bake step, check serialized size before posting and refuse early with a friendlier message ("This walkthrough is X MB after baking — the share size cap is 10 MB.").

## Security

- **Token stays in main.** Never expose the GitHub token to the renderer; the share IPC takes nothing token-shaped.
- **Repo-access check is web-ade's job.** We don't pre-flight; the upload either succeeds or web-ade returns `NO_REPO_ACCESS`.
- **Speculative content.** Baked `newContents` may include unpushed working-tree code. The web-ade doc covers the privacy posture (anyone with read access could be DM'd a diff anyway) — the share confirmation prompt should be unambiguous so a user knows what's about to leave their machine. Surface the file count + total size in the prompt.
- **No bridge route.** Sharing is intentionally renderer-driven IPC, not bridge HTTP. Mirrors the notes-mutations-are-people-only choice we just shipped.
- **Notes contents.** `payload.notes` includes free-form prose that the user authored. It rides along with the share. The confirm prompt should mention notes when the payload has any, so users aren't surprised that a private comment they left is now shared.

## Open questions

1. ~~**Shared-state visibility across sessions.**~~ Resolved: see [Fetching shared sequences](#fetching-shared-sequences). The panel calls `listShared()` on mount and after each successful share; nothing is persisted locally.
2. **Origin override UI.** Is the implicit "origin first, then any github remote" enough, or do we want an explicit "share to {owner}/{repo}" picker for forks/upstreams? Start implicit, add the picker if users hit it.
3. **Re-share semantics.** Web-ade creates a new record per share; our row UI shows the most recent link. Do we want to show a history of links per local payload? Likely no — encourages link rot. Surface "shared earlier today" in the tooltip if needed.
4. **Notes-aware sharing toggle.** Add an explicit "Share without notes" checkbox once notes meet a teammate-visible threshold? Defer; observe what users actually do.
5. **Anonymous shares.** Authoring without a GitHub token is unsupported today. If we ever want to allow signed-out users to share (e.g., agent-generated walkthroughs from a CI environment), we'd need a separate auth path. Out of scope.

## Status

Not yet implemented in `electron-app`. Slice 1 (web-ade backend) is shipped per the upstream doc; Slice 2 (web viewer) is a parallel track. The work below is what lands in this repo for Slice 3.

- [ ] Add `SHARE`, `LIST_SHARED`, `FETCH_SHARED` to `FileCitySequenceEvent`; add `share()`, `listShared()`, `fetchShared()` to `FileCitySequenceAPI`; mirror on the preload surface.
- [ ] Add `src/main/file-city/sequenceDiagramShare.ts` with `bakeSnippets`, `resolveGithubOrigin`, `postToWebAde`, `listFromWebAde`, `fetchFromWebAde`, and `share(id, options)` / `listShared(options)` / `fetchShared(owner, repo, id)` orchestrators.
- [ ] Register `SHARE` / `LIST_SHARED` / `FETCH_SHARED` IPC handlers in `registerSequenceDiagramHandlers()`.
- [ ] Add `src/renderer/services/SequenceDiagramShareService.ts` exposing `share`, `listShared`, `fetchShared`.
- [ ] Wire the "Share…" action + post-share state into `SequenceDiagramRow.tsx`. Toast + clipboard hand-off.
- [ ] Wire the "Shared with this repo" section into `SequenceDiagramsPanel.tsx`: fetch on mount, refresh after successful share, hydrate on row click, dedupe against local entries.
- [ ] Confirm web-ade has been extended to round-trip `payload.notes` (or accept the silent-strip behavior and document it). Coordinate with the web-ade Slice-2 viewer work.
- [ ] Update [`file-city-sequence-diagram-persistence.md`](file-city-sequence-diagram-persistence.md): drop "Cross-machine sync of saved payloads" from the non-goals list and link here.

### Manual smoke test (once shipped)

```
# In the dev workspace, with a sequence-diagrams sidebar entry visible:
1. Hover the row → "Share…" button appears.
2. Click "Share…".
   - Expected: brief "Sharing…" state, then a toast "Link copied".
   - Pasted link should be of the form https://web-ade.…/d/{owner}/{repo}/{id}.
3. Open the link in a browser signed in to GitHub with read access to the repo.
   - Expected: walkthrough renders. (Pending Slice 2 viewer.)
4. Click the row again — button should now read "Copy link".
5. Trash icon still removes the *local* entry; it does not delete the shared copy.
6. The "Shared with this repo" section should now contain the just-shared entry. Click it — payload hydrates from web-ade and renders identically to the local copy. (This is the round-trip check that the upload actually landed.)

# Permission failure path:
6. Sign out of GitHub from the desktop's auth panel.
7. "Share…" should fail with "Sign in to GitHub before sharing."
```
