# Purl-aware doc-link clicking across markdown surfaces

Status: **design / not started** · Topic: `topic-1782579770916-zsaz28du3`

## Why

The agent-facing validator (`POST /api/topics/:id/validate-links`, topic
`topic-1782535373497-ru2wcp44m`) is about to start pushing **purl-qualified**
doc links — `pkg:github/owner/repo#path` — into topic descriptions once the
`create-topic` / `topic-context` skills are updated. The human-facing,
click-time resolver in the renderer is **bare-path only** and will *break* on
those links.

The goal is not a narrow fix for one surface. The destination is: **every place
we render markdown supports purl-aware clicking**, and a purl resolves **even
when there is no local clone** (the purl is self-describing — it names host,
owner, repo, ref, and subpath).

## The two confirmed bugs (today)

Walking `useMarkdownLinkHandler.onLinkClick`
(`src/renderer/hooks/useMarkdownLinkHandler.ts`) with
`pkg:github/owner/repo#docs/foo.md`:

1. `EXTERNAL_SCHEME` (`:25`) doesn't include `pkg:`, so it isn't treated as
   external.
2. `const cleanPath = href.split(/[?#]/)[0]` (`:139`) **drops the `#subpath`** —
   the actual file — leaving `pkg:github/owner/repo`.
3. `useWorkspaceFileIndex.resolve` (`src/renderer/hooks/useWorkspaceFileIndex.ts`)
   then searches member-repo trees for a file literally named
   `pkg:github/owner/repo` → 0 hits → `missing` notice (or, pre-index, a bogus
   `file:opened` that errors on load).

Root causes: the `#`-split happens **before** any purl awareness, and
`useWorkspaceFileIndex` keeps only `{path, name, files}` per repo — it
**discards `entry.purl`**, so it cannot map a purl to a repo at all.

## Audit — markdown render surfaces, grouped by window

The webpack entry points *are* the windows; each loads one root React app. Three
windows render markdown — the rest (titlebar, window-switcher, splash, goodbye,
quick-open) are chrome.

The markdown surfaces are **shared components mounted into multiple windows**,
and *the window provides only an optional context hint* — never a guarantee.

**Topics are portable: any topic can be opened in any window.** A topic
references arbitrary repos, which may not be cloned and may not be in the current
window's workspace. So you **cannot** partition resolution by window
("workspace windows → local, principal window → remote") — even a dev-workspace
window will be handed a topic pointing at an un-cloned repo. **Every surface, in
every window, needs the same full two-tier resolution** (local clone → remote →
unresolvable). A window's `workspaceId` / `repositoryPath` is at most a *hint*
(prefer this clone, disambiguate ties); it can never gate what resolves.

The window grouping below is therefore an **inventory** — where each surface is
mounted and whether it's wired yet — not a resolution-strategy split. Its value:
the same components (`TopicDescriptionBody`, `MarkdownPanel`) recur across
windows, so wiring them once helps everywhere.

The terminal overlay
(`dev-workspace/file-city-panel/FloatingTerminalOverlay.tsx:283`) is
external-URL-only (`ShellService.openExternal`) and excluded.

Both current windows need the identical full resolver. The only per-surface
variables are **wired?** (does it use `useMarkdownLinkHandler` yet) and **local
hint** (any `repositoryPath`/`workspaceId` to bias clone selection — optional).

### Principal window — `principal-window/PrincipalApp.tsx` (`WorkspaceShell` + portal views)

| Surface | File:line | Local hint available | Wired? |
|---|---|---|---|
| TopicTabContent (published / inbox) | `inbox-view/TopicTabContent.tsx:496` | none (`repositories[]` prop only) | ✗ |
| LocalTopicTabContent → TopicDescriptionBody | `topics-view/LocalTopicTabContent.tsx:267` → `TopicDescriptionBody.tsx:191` | `workspaceId` (if any) + `repositoryPath` | ✓ |
| MarkdownDocTabContent → MarkdownPanel | `projects-view/MarkdownDocTabContent.tsx:73` → `MarkdownPanel.tsx:228` | `repositoryPath` + doc `basePath` | ✓ |
| RepositoryProfilePanel README | `panels/RepositoryProfilePanel.tsx:2866` | GitHub `{owner, repo, branch}` | ✗ |
| RepoExplainOverlay (AI commit summary) | `panels/RepoExplainOverlay.tsx:233` | `repoName` only | ✗ |

### Dev workspace window — `dev-workspace/DevWorkspacePanelFramework.tsx`

| Surface | File:line | Local hint available | Wired? |
|---|---|---|---|
| MarkdownPanel | `DevWorkspacePanelFramework.tsx:3130` → `MarkdownPanel.tsx:228` | `repositoryPath` + doc `basePath` | ✓ |
| DevWorkspaceTopicTab → TopicDescriptionBody | `dev-workspace/topics-panel/DevWorkspaceTopicTab.tsx` → `TopicDescriptionBody.tsx:191` | `workspaceId` → multi-repo index + `repositoryPath` | ✓ (local) |
| DevWorkspaceTopicTab → TopicTabContent (published) | same | published topic | ✗ |

**The pattern:** `TopicDescriptionBody` (local topics) and `MarkdownPanel`
(on-disk docs) are already wired in both current windows — landing the
resolver lights them up everywhere at once. The unwired surfaces
(`TopicTabContent`, `RepositoryProfilePanel`, `RepoExplainOverlay`) need the
hook added. None of this changes *what* resolution they need — it's uniform; the
table only tracks adoption.

## Architecture decision — resolution is purl-backed, not workspace-backed

The first instinct was to extend the workspace file index. **Wrong layer.** A
purl is a canonical repo id; resolving it is a registry/remote lookup, not a
workspace-membership question. Because topics are portable across windows and
reference arbitrary repos, purl resolution **must** be decoupled from the
workspace — it's one universal resolver every surface calls, identical in every
window. The workspace index is demoted to an optional *hint* (and to back-compat
for legacy bare-path links), not a precondition.

Resolution is **two-tier and registration-independent**, mirroring
`src/main/topics/validateTopicLinks.ts` (`resolveExistence`) — but for *opening*,
not just validating:

1. **Local clone first** — if a registered Alexandria repo's `purl` matches
   (`normalizeRepoPurl`), open `entry.path + subpath` as a local, editable tab.
   The full registry is reachable from the renderer via
   `AlexandriaService.getRepositories()` — every entry carries `purl` + local
   `path`. The registry is a **local-clone shortcut**, not the source of truth.
2. **Remote fallback** — no clone → resolve from the host. For GitHub purls,
   fetch via `GithubService.getFileContent` honoring the purl's pinned ref
   (`@version` / `?commit=`, else default branch) and open read-only.
3. **Non-GitHub host, no clone** → `repo-unresolvable` (same as the validator).

A valid GitHub purl therefore **always resolves to something** — a local tab or
a remote read-only view. There is no missing/out-of-scope dead-end. "Add this
project" becomes an *enhancement* offered alongside a successfully-opened remote
view ("viewing remotely — clone it?"), not a failure fallback.

### Reuse — same grammar, more consumers

`parsePurl` / `ParsedPurl` (`@principal-ai/alexandria-core-library`),
`repoRootPurl`, `normalizeRepoPurl` (`src/shared/utils/classifyTopicReferences.ts`)
are all renderer-importable and are exactly what `validateTopicLinks` already
uses. Same parser and same normalization, two consumers (agent-facing validator,
human-facing click resolver).

## Resolving → which UI opens (the open side, by file type)

Resolution produces a *path*; what UI that path opens depends on its **file
type**, and that's where the second big gap lives. Purl links are not
markdown-only — the classifier linkifies any inline path with an extension
(`looksLikeFilePath`), so a topic can link `pkg:…#src/foo.ts`, `…#diagram.png`,
`…#data.json`. Today the open side handles this **inconsistently across windows**,
and the markdown link handler routes through the wrong event.

### Two events, different routers

`useMarkdownLinkHandler` emits **`file:opened`**. But the rich file-type router
lives on a *different* event, **`file:open`** (the file-explorer / file-city
path). So what actually happens to a doc-link click depends on the window's
`file:opened` listener:

| Window | `file:opened` listener | Non-markdown behavior |
|---|---|---|
| **Dev workspace** | `DevWorkspacePanelFramework.tsx:1957` | **Silently dropped** — early-returns unless `.md`/`.mdx` (`:1970`) |
| **Principal** | `WorkspaceShell.tsx:345` → `openMarkdownDoc` | **Markdown only** — non-md never opens |

The same purl link to `src/foo.ts` is silently dropped in the dev-workspace
window and does nothing in the principal window. This contradicts the
"uniform everywhere" goal as much as the resolver gap does.

### The richer router (dev-workspace `file:open`, `:2124`) — the model to generalize

The dev-workspace `file:open` handler is the most complete type map:

| Type (by extension) | Opens in |
|---|---|
| `.md` / `.mdx` | MarkdownPanel (`markdown`) |
| images/video (`png,jpg,jpeg,gif,webp,svg,bmp,ico,mp4,webm,mov,avi,mkv,ogv`) | MediaViewerPanel (`media`) |
| office/pdf/archive/font/audio/installer binaries | **OS native app** (`ShellService.openPath`) |
| modified (git unstaged/staged) | GitDiffPanel (`git-diff`) |
| from file-city panel | PierreFileView (`pierre-file`, read-only) |
| any other text/code | FileEditorPanel (`file-editor`, **editable**) |

Notes that matter for purl links:

- **No shared classifier.** Each window reimplements its own extension checks.
  A purl-aware open should introduce one shared `classifyFileForViewer(path)`
  helper, not another copy.
- **Read-only vs editable.** Following a doc *reference* should default to
  **read-only** (the existing source viewer), not the dev-workspace
  `file-editor` (editable) default. You're navigating a citation, not editing.
- **Binaries** have no in-app viewer → native open (or a notice). Fine, but the
  `file:opened` path doesn't do this today; only `file:open` does.

### Design implication

For purl-aware clicking to behave uniformly, the **open side needs the same
"make it universal" treatment as the resolver**:

1. A shared `classifyFileForViewer(path)` → `markdown | media | source | native`
   (one helper, kills the drift).
2. Each window's `file:opened` listener routes *all* types through it;
   dev-workspace and principal must stop being markdown-only,
   defaulting non-markdown to a **read-only** viewer.
3. Doc-link opens are read-only by intent.

**v1 file-type scope (proposal):** markdown (primary) + media + read-only source
via each window's existing viewer; binaries → native open or a notice. No new
viewers needed — just consistent routing into the ones that exist. This is
separable from, and smaller than, remote open.

## Scope decision — remote (clone-less) open is deferred

**Decided: this pass does local-clone resolution only. Remote open is future
work.** A purl whose repo is registered with a local clone opens its file; a purl
with no local clone shows a notice with a clone / "add this project" affordance
(it does **not** fetch + render remotely yet).

Why defer: remote open is a genuinely new capability, not a tweak. `file:opened`
and `MarkdownPanel` are **filesystem-only** today (`MarkdownPanel` calls
`actions.readFile(filePath)`), so there is no path to open a clone-less file as a
tab. Adding it means: the resolver returning `{kind:'remote', owner, repo, ref,
subpath}`; an event/tab shape that carries a purl+ref instead of a filesystem
path; and a content-seeded read-only viewer tab (RepositoryProfilePanel's
fetch-via-GitHub + `DocumentView` pattern promoted from inline to a tab). That's
a separate increment.

Known tradeoff (portability tax): because any window can open a topic
referencing un-cloned repos, the "notice instead of open" state will be common,
not a rare edge — so the clone affordance has to be genuinely useful in the
interim. Remote open stays on the roadmap (Phase 4) precisely to close that gap.

The resolver should still be **shaped** for remote from day one — return a
discriminated result (`local | needs-clone | unresolvable`) so adding a `remote`
arm later doesn't churn every call site.

## Proposed plan (phased)

**Phase 1 — universal purl resolver (registry-wide)**
- New registry-backed `useRepoPurlResolver` (context-light): load
  `AlexandriaService.getRepositories()`, build a `normalizeRepoPurl(purl) → entry`
  map, expose `resolvePurl({repoPurl, subpath})`. Registry-wide, **not**
  workspace-scoped — same result in every window.
- `useMarkdownLinkHandler.onLinkClick`: detect `pkg:` **before** the `#`-split;
  `parsePurl` → `repoRootPurl` + `subpath`; route through `resolvePurl`. Non-purl
  links fall through to today's bare-path behavior unchanged (back-compat while
  descriptions migrate). A local `repositoryPath`/`workspaceId`, when present, is
  passed only as a disambiguation *hint*.

**Phase 2 — uniform file-type → UI routing (the open side)**
- Shared `classifyFileForViewer(path)` → `markdown | media | source | native`
  (replaces the per-window inline extension checks that already drift).
- Each window's `file:opened` listener routes *all* types through it: dev-workspace
  and principal stop being markdown-only; non-markdown defaults to a **read-only**
  viewer (Alexandria's `source-file` model). Doc-link opens are read-only by intent.
- Binaries → native open or a notice.
- v1 scope: markdown + media + read-only source + native; no new viewers, just
  consistent routing into existing ones.

**Phase 3 — roll out to every surface (by adoption status, not by window)**
Resolution + routing are identical everywhere, so this is purely about *who's wired*:
- **Already wired** (`TopicDescriptionBody`, `MarkdownPanel` — both current windows):
  light up automatically when Phases 1–2 land; no per-surface work.
- **Unwired** — add `useMarkdownLinkHandler` + `MarkdownLinkNotice`:
  `TopicTabContent` (published topics, highest value), then
  `RepositoryProfilePanel` README, then `RepoExplainOverlay`. Each adoption is
  near-mechanical because the resolver is context-light.

**Phase 4 (future) — remote (clone-less) open** *(deferred — see Scope decision)*
- Resolver gains a `remote` arm: content fetched by purl ref, rendered read-only
  in a content-seeded tab. Closes the "notice instead of open" gap for un-cloned
  repos.

**Phase 5 (stretch)** — line/anchor targeting via the `file:opened` payload;
existence-precheck (lazy tree fetch) for a clean `missing` notice before opening.

## Related

- `topic-1782535373497-ru2wcp44m` — the validate-links route (agent-facing
  twin); reuse its resolver model (`validateTopicLinks.ts`).
- `topic-1780334368464-mtyvfwixs` — shipped in-app doc-link clicking + the
  5-surface rollout backlog.
- `topic-1782486994245-okeh6dp44` — purl-for-files design brief.
</content>
</invoke>
