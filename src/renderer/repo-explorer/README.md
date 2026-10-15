# Repo Explorer (ported from web-ade)

This folder is a **verbatim port** of web-ade's owner/repo page
(`web-ade/src/app/[owner]/[repo]/`) into the desktop app, copied so we can
review the full UI in Storybook before wiring real data. It is the baseline for
replacing the current `RepositoryProfilePanel` (the `project-info` tab) with the
web-ade owner/repo page.

## What's here

- `app/[owner]/[repo]/RepoExplorerPage.tsx` — the page (header, left rail,
  right-pane File City). Copied from web-ade, unchanged except import seams.
- `app/[owner]/[repo]/*` — sibling panes (activity, issues, PRs, analysis,
  file source, markdown frontmatter).
- `components/**`, `hooks/**`, `lib/**`, `contexts/**` — the page's transitive
  local closure (copied to preserve the relative structure web-ade used).
- `RepoExplorerPage.stories.tsx` — Storybook entry.
- `storybook/mockFetch.ts` — route-handler fixtures.
- `shims/**` — Next.js and heavy-dependency stand-ins.

## How to view it

```bash
npm run storybook
# → Repo Explorer / OwnerRepoPage
```

The story renders `RepoExplorerPage` with mocked data — no Electron main
process and no Next server required.

## Seams introduced by the port

Everything below is a deliberate stand-in, not a web-ade behavior change. Each is
the place to swap in the real desktop implementation later.

| Seam | File(s) | Why |
| --- | --- | --- |
| Module alias | `@repo-explorer/*` → this folder | web-ade used `@/*`; a namespaced alias avoids colliding with the app's graph. Configured in `.storybook/main.ts` and `tsconfig.base.json`. |
| `next/link` | `shims/next-link.tsx` | No Next router; degrades to `<a>`. |
| `next/navigation` | `shims/next-navigation.ts` | `useRouter`/`usePathname` no-ops. |
| `next/dynamic` | `shims/next-dynamic.tsx` | Everything is client-side; wraps loaders in `React.lazy`. |
| tRPC client | `lib/trpc/client.ts` | Replaces `@trpc/client` + the web-ade `AppRouter` with fixtures. Real data → main-process hosted-API proxy. |
| Route handlers | `storybook/mockFetch.ts` | Stubs `/api/**` (commits, issues, PRs, trails, tours, analysis, star, auth…). |
| Server type stubs | `lib/repo-analysis/s3-cache.ts`, `lib/repo-analysis/identity-cache.ts`, `app/api/github/user/[username]/activity/route.ts` | Type-only imports whose real modules are server-only (AWS SDK / Redis / Next). |
| Document previews | `components/document/PdfView.tsx`, `shims/unsupported-docx.ts` | `react-pdf` / `pptx-preview` / `mammoth` / `docx-preview` aren't installed yet. |
| Tailwind | `.storybook/main.ts` (postcss-loader) + `styles/tailwind.css` import in the story | The page is laid out with Tailwind utilities; Storybook's default CSS rule skips PostCSS. |

## Changes from web-ade

Edits applied on top of the verbatim copy (kept minimal and localized):

- **Header** (`Header` in `RepoExplorerPage.tsx`): removed the "Principal AI"
  brand link, the repo search bar (desktop + mobile sheet), the bookmark button,
  and the user avatar menu. The header is now just the owner avatar / `owner /
  repo` crumb plus the agent-view and vibe-coding buttons.
- **Trails**: fully excised the old "trails" concept (shared trail list, trail
  explorer, files-view, trail-derived highlight layers and the "files explored"
  counter). Subsystem-model trails will be added later. The left rail keeps its
  non-trail views (tours, activity, issues, pull requests, structure,
  contributors, vibe-coding) and the right pane keeps `FileCityGuidePanel`.
  Removed the now-unused `TrailErrorView`, `TrailShareModal`, `CreateTrailModal`,
  and `lib/trails/` modules. The loading-animation helpers under
  `components/trail/` (`BlockDropLoadingScreen`, `InlineTrailLoader`, …) are
  generic and still used across the app.
- **Repo analysis (Freestyle)**: the third-party VM-backed repo-analysis
  integration (line counts + contributor ownership/coverage) is **kept but
  disabled** via `REPO_ANALYSIS_ENABLED = false` in `RepoAnalysisContext.tsx`.
  No fetch/VM calls fire while disabled; the "Line Counts" status block renders
  an inert header. The plumbing is intact so it can be re-sourced through the
  desktop app's IPC layer later — flip the flag once that lands. All
  Freestyle branding/links were removed.

## Known gaps / next steps

- **Real data layer** — replace `lib/trpc/client.ts` and `storybook/mockFetch.ts`
  with the main-process hosted-API proxy (`WebAdeService` / `webAdeRouter`).
- **Navigation** — route `next/link` / `useRouter` calls through workspace tab
  intents (`repository:selected`, `user:profile-selected`, `file:open`, …).
- **Local-git overlay** — the web page is remote-only; re-add desktop clone
  management (branch sync, dirty status, open workspace/terminal) from the
  current panel via `GitService` / `RepositoryMonitoringService`.
- **Typecheck** — `src/renderer/repo-explorer/**` is currently excluded from
  `tsconfig.renderer.json` while the data seams are stubs. Remove the exclusion
  once the real types are wired.
- **`AbortError`** — an aborted fetch surfaces as an unhandled `pageerror` in
  Storybook; harmless, worth tracing during wiring.
