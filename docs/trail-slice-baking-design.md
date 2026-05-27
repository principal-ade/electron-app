# Trail slice baking — design notes

## Problem

When the desktop-app shares a trail to web-ade, `kind: 'slice'` snippets are
shipped as line numbers only. The web viewer resolves them against the
repo's default branch on GitHub. That works when the trail was authored on
a commit reachable from the default branch with a clean working tree;
it silently misaligns when either is false.

Two cases break today:

1. **Dirty working tree.** Slice line numbers were computed against the
   author's working copy, but the file on the default branch hasn't
   moved. Lines `42–67` point at different code (or at nothing — the
   range may extend past EOF). No error surfaces; the reader sees the
   wrong slice and is none the wiser.
2. **Commit not on the default branch.** Authored on a feature branch
   that hasn't merged, or against an older SHA. Same outcome —
   `readFile` returns the default-branch content, the slice math runs
   against the wrong file.

Diff snippets don't have this problem because `bakeSnippets` already
inlines `newContents` from the working tree at share time
(`src/main/file-city/trailShare.ts:154-193`).

## Current state

### Producer side — `bakeSnippets`

`src/main/file-city/trailShare.ts:161-184`. Walks
`payload.markers`. For each marker:

- No `snippet` → returned unchanged.
- `snippet.kind === 'slice'` → returned unchanged (slices are not baked).
- `snippet.kind === 'diff'` with `newContents != null` → returned unchanged.
- `snippet.kind === 'diff'` with `newContents == null` →
  `fs.readFile(join(repositoryPath, sourcePath))` inlined onto the snippet.

A failed read on a diff marker throws `MISSING_FILES_NEEDS_CONFIRM`
unless the caller passed `allowMissing: true`, in which case
`newContents` becomes `''`.

### Consumer side — web-ade trail page

- `src/app/trail/[id]/page.tsx` mounts `TrailViewer`.
- `src/components/trail/TrailViewer.tsx:499-530` defines `readFile`,
  which fetches
  `/api/github/repo/${owner}/${repo}?action=file&path=${cleanPath}` and
  base64-decodes the response.
- `src/app/api/github/repo/[owner]/[name]/route.ts:243-258` proxies to
  GitHub's `/repos/{owner}/{name}/contents/{path}` **without a `ref`
  query** — GitHub serves the default branch.
- `industry-themed-file-city-panels/src/panels/.../TrailSnippetView.tsx:119-160`
  calls `readFile(filePath)`, then slices the response client-side using
  `snippet.startLine` / `endLine` / `contextLines` / `extraAbove` /
  `extraBelow`.

There is no `ref` plumbing on the viewer side today.

### Schema — the addition is already pre-declared

`industry-themed-file-city-panels/src/types/Trail.ts:23-27`:

> v1 explicitly does NOT ship (all non-breaking future additions):
> - Per-marker time pin (`marker.at`)
> - **Baked slice content (`TrailSliceSnippet.contents`)**
> - Two-sided historic diffs (`TrailDiffSnippet.oldRef` / `newRef`)
> - File-rename archeology for File City highlight

And `Trail.ts:124-132`:

> V1 content source is the working tree (resolved via a host-provided
> resolver — not a direct fs read). Future, non-breaking addition:
> `contents?: string` for durable archival trails that bake content at
> author time.

So the field name (`contents`), the semantics ("baked at author time"),
and the non-breaking-ness are already pinned down by the schema's
forward-compat plan. This doc is about flipping the switch.

## Proposal

### Schema

Add one optional field to `TrailSliceSnippet`:

```ts
export interface TrailSliceSnippet {
  kind: 'slice';
  startLine: number;
  endLine: number;
  focusLine?: number;
  contextLines?: number;
  /**
   * Baked file contents at author time. When present, the viewer
   * prefers this over the host's `readFile` resolver and applies the
   * line-window math directly to it. Producers bake when working-tree
   * state would otherwise misalign with the reader's content source
   * (dirty file, or commit not reachable from the repo's default
   * branch upstream).
   */
  contents?: string;
}
```

No removal, no rename. Trails authored before this change continue to
work — `contents` is absent, viewer falls back to the existing fetch.

### Producer-side: when to bake

Extend `bakeSnippets` in `src/main/file-city/trailShare.ts` with a slice
branch. For each marker whose `snippet.kind === 'slice'`:

1. Skip if `snippet.contents` is already set (re-share of a previously
   baked trail).
2. Skip if `sourcePath` is missing (slice without a file is conceptual —
   nothing to bake).
3. Compute two flags against `repositoryPath`:
   - **`isDirty`**: `git diff --name-only HEAD -- <sourcePath>` returns
     non-empty, **or** the file is untracked
     (`git status --porcelain -- <sourcePath>` shows `??`).
   - **`isUnreachable`**: `authoredAt.sha` is not an ancestor of the
     repo's default-branch upstream
     (`git merge-base --is-ancestor <sha> origin/<defaultBranch>`).
     When `authoredAt` is unset, treat as unreachable (we can't prove
     reachability without a SHA).
4. If neither flag is set, leave the slice unbaked (reader resolves from
   their checkout — the current happy path).
5. If either flag is set, read the file from `repositoryPath` and inline
   it onto `snippet.contents`. The whole file is read, not the
   `startLine`/`endLine` window — see "Window vs whole file" below.

### Producer-side: missing-file handling

A slice marker whose file can't be read (deleted from the working tree,
never existed) is a new failure mode for the bake step. Two options:

- **Reuse `MISSING_FILES_NEEDS_CONFIRM`.** Same UX as today's diff
  branch — modal flips to `missing-files` body, user opts in, retry
  with `allowMissing: true` produces a slice with `contents: ''` (or
  no `contents` at all, letting the viewer fall back to GitHub).
- **Silent fallback to unbaked.** Treat read failure as "leave the
  slice unbaked." Reader fetches from GitHub and either sees the right
  content (if the file exists there) or an error in the snippet view.

Recommended: reuse `MISSING_FILES_NEEDS_CONFIRM`. The user already
understands that branch; introducing a silent fallback for slices but
not diffs is gratuitous inconsistency.

### Window vs whole file

Two choices for *how much* to inline:

- **Whole file** (recommended). Mirrors what the diff bake does
  (`newContents` is the full file, not a window). Lets the viewer keep
  its existing slice-and-expand UX intact — `TrailSnippetView`'s
  `extraAbove` / `extraBelow` controls let the reader widen the window
  past `startLine` / `endLine`, which only works if the full file is
  available.
- **Just the slice window.** Smaller payload, but kills the
  expand-strip UX and means a future re-slice of the same marker can't
  reuse the baked contents.

Whole-file baking is the right default. Slice windows are typically
~10–25 lines but the file is the same disk read either way; the
serialized size delta is `whole_file - 25_lines`, which is rarely
load-bearing against the 10MB cap unless the trail touches many large
files. A `bakeStrategy: 'full' | 'window'` knob is forward-compat if it
ever needs to flip.

### Consumer-side change

The trail viewer needs a single edit to `TrailSnippetView` (and any
other slice consumer): when `snippet.contents` is present, skip the
`readFile` call and feed `contents` directly into the existing slice
math at `TrailSnippetView.tsx:142-160`. The line-window math is
unchanged — it operates on a string regardless of where the string came
from. `extraAbove` / `extraBelow` continue to work because `contents`
holds the whole file.

This is a 5-line change inside the `useEffect` that calls `readFile`:

```ts
React.useEffect(() => {
  if (snippetContents != null) {
    setContents(snippetContents);
    return;
  }
  // existing readFile path
}, [filePath, readFile, snippetContents]);
```

(The component currently takes `startLine` / `endLine` / `readFile` as
top-level props rather than the whole snippet — wiring `contents`
through is the bulk of the diff, not the logic.)

## Tradeoffs

| Concern | Impact |
|---|---|
| Payload size | Inlining whole files grows the share; a trace trail across 20 files each ~5KB adds ~100KB, well under the 10MB cap. Pathological large-file cases (generated code, lockfiles) could push close. |
| Freshness | A baked slice freezes that file's content at share time. If the underlying file later changes upstream, the reader sees the author's snapshot, not current state. This is the same trade diff snippets already make. |
| Re-share semantics | Re-POSTing a previously shared trail today preserves notes; should it also preserve `contents`, or re-bake? Re-bake (mirrors how the diff path works — `newContents != null` short-circuits, but the desktop modal always calls into bake from scratch with a fresh payload). |
| Privacy | The trail share already requires GitHub read access on web-ade's side. Inlining files the user could read from GitHub directly doesn't expand the exposure surface; inlining files that exist *only* in the user's working tree does (a new-but-unpushed file becomes readable to anyone with repo read access via the trail). Worth surfacing in the share modal's "Learn more about sharing" section. |

## Open questions

1. **Reachability check — local or remote?** `git merge-base
   --is-ancestor <sha> origin/<defaultBranch>` is local-only; it
   reflects the state of the user's fetched refs, which may be stale.
   Hitting the GitHub API
   (`GET /repos/{owner}/{repo}/commits/{sha}`) would be authoritative
   but adds a network hop. Local check is the right default; if it
   says "reachable" we trust it, and if it says "unreachable" we bake.
   That biases toward over-baking (correctness over payload size),
   which is the safe direction.
2. **Default branch source.** The reachability check needs the
   default branch name. Pull from `git remote show origin` cached
   value, or from the same GitHub API call the modal already makes for
   `repoVisibility`? Cheapest is `git symbolic-ref refs/remotes/origin/HEAD`
   when present, falling back to `origin/main` and then `origin/master`.
3. **Should `authoredAt.sha` be re-derived at bake time?** Today it's
   set when the payload is first persisted. If the trail was authored
   hours ago and the user has since merged the branch, the SHA is
   "stale-but-still-on-default-branch" and the reachability check would
   correctly skip the bake. No re-derivation needed.
4. **What about untracked-but-not-dirty files?** A file the author just
   created and added to the trail before committing. `git diff` won't
   flag it; `git status --porcelain` will (`??`). The `isDirty` check
   needs both, not just `git diff`.
5. **Do we want to surface "this snippet is baked" in the viewer?**
   A small badge — "Snapshot from <sha>" — would warn readers when
   they're looking at frozen content rather than the live default
   branch. Out of scope for v1 of this change, but worth a follow-up
   if the staleness tradeoff bites.

## Out of scope

- Two-sided historic diffs (`TrailDiffSnippet.oldRef` / `newRef`) —
  separate item on the same forward-compat list, separate doc when we
  get there.
- File-rename archeology — same.
- A "rebake all" command for re-syncing a previously shared trail
  against the current working tree. Re-sharing already does this; a
  dedicated command is sugar.

## Files that change

Producer side (`/Users/griever/Developer/desktop-app/electron-app`):
- `src/main/file-city/trailShare.ts` — extend `bakeSnippets` with the
  slice branch + reachability/dirty checks.
- `src/renderer/dev-workspace/trails-panel/TrailShareModal.tsx` — only
  if the "Learn more about sharing" copy needs updating for the new
  privacy case (untracked file inlining).

Schema (`/Users/griever/Developer/web-ade/industry-themed-file-city-panels`):
- `src/types/Trail.ts` — add `contents?: string` to `TrailSliceSnippet`.

Consumer side (`/Users/griever/Developer/web-ade/industry-themed-file-city-panels`
and `/Users/griever/Developer/web-ade/web-ade`):
- `src/panels/FileCityTrailExplorerPanel/overlays/TrailSnippetView.tsx`
  — prefer `snippet.contents` over `readFile`.
- Caller(s) of `TrailSnippetView` that destructure the snippet — pass
  `contents` through.
