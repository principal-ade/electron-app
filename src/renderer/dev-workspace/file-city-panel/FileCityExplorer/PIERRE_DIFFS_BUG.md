# Bug: `@pierre/diffs` `FileDiff` requires manual theme + `unsafeCSS` injection in `CommitFileOverlay`

## Summary

`CommitFileOverlay` (file-city-panel "click a file in the latest-commit card → see
its diff") renders the `@pierre/diffs/react` `FileDiff` component. With *minimal*
options (`{ diffStyle: 'unified' }`) the component renders with a light/white
theme and broken layout (collapsed grid columns, run-together lines).

Working around it required pinning the theme and copying a slab of `unsafeCSS`
from `PierreFileView`. We don't think that should be necessary — something
about how this overlay is hosted is making `@pierre/diffs` lose styles that
work fine in the existing consumers, and we'd like someone with diffs-library
context to take a look before we lock the workaround in.

## Affected file

- `src/renderer/dev-workspace/file-city-panel/FileCityExplorer/CommitFileOverlay.tsx`

## Existing components that work without the workaround

- **`src/renderer/dev-workspace/file-city-panel/PierreFileView.tsx`** — uses
  `<File>` from `@pierre/diffs/react`. Pins `theme: 'pierre-dark'` and injects
  `baseUnsafeCSS` (the blob we ended up copying). Renders correctly inside
  `FileOverlay` in the file-city panel.
- **`src/renderer/panels/ReviewCommitPanel.tsx`** — uses `<FileDiff>` with
  *only* `{ diffStyle: 'unified' }` — no theme, no `unsafeCSS`. Renders
  correctly when mounted under the principal-window/feed view.
- **`@industry-theme/file-editing-panels` → `GitDiffPanel`** — the workspace's
  "git-diff" tab. Renders correctly. Theme integration appears to be handled
  internally by the package.

## Reproduction (current main)

1. Open the file-city panel for any repo with at least one recent commit.
2. Click the recent-commit card to activate it; click a file row in the
   expanded list.
3. The slide-in overlay renders the `FileDiff` with a white background,
   columns that don't line up, and lines that aren't separated.

If you swap the `options` in `CommitFileOverlay` to:

```ts
{
  diffStyle: 'unified',
  theme: 'pierre-dark',
  themeType: 'dark',
  unsafeCSS: pierreUnsafeCSS,  // copied verbatim from PierreFileView
}
```

…it renders correctly. Same library version, same React tree, same theme
provider above it.

## What we'd like investigated

1. Why does `ReviewCommitPanel` get away with no theme / no `unsafeCSS` while
   `CommitFileOverlay` does not? Both call `<FileDiff>` from
   `@pierre/diffs/react` with effectively the same options. The difference
   appears to be where they're mounted in the React tree (dev-workspace pane
   vs. principal-window feed view).
2. Is `@pierre/diffs` reading something from the host environment
   (`color-scheme`, an ancestor `data-theme` attribute, a parent stylesheet)
   that the dev-workspace pane doesn't provide? If so, can we surface that as
   an explicit opt-in instead of an implicit "works if hosted in the right
   place" behavior?
3. The `unsafeCSS` `PierreFileView` adds re-asserts `--diffs-code-grid`,
   `--diffs-grid-number-column-width`, and `[data-line]` whitespace rules.
   Why does the library's own stylesheet drop these? `PierreFileView`'s
   comment hints at Chromium-specific behavior — is that still required, or
   has it been fixed upstream?

## Why we care

If two of three existing consumers need a copy-pasted `unsafeCSS` blob to
render correctly, the next consumer will hit the same trap. Today our
workaround is a comment pointing at `PierreFileView`; the right fix is either
upstream in `@pierre/diffs` or a documented "host setup" requirement we can
satisfy once at the dev-workspace level.
