# Topic Images (drag-and-drop screenshots)

> Status: **Local-only feature** · Last updated: 2026-06-08
>
> Desktop topic publishing, shared-topic links, and Topic Inbox were removed.
> Any remote-publishing plans below are obsolete; a future sharing design (for
> example, GitHub Gists) is not implemented.

Let users attach **screenshots** to topics — primarily of Storybook stories — by
dragging an image file into the topic description editor. Images are stored
**on the local topic, referenced from the description**, and render in the
desktop app.

This is a screenshot-sharing feature, not a general asset store: the drop zone
**rejects large images up front** (see validation caps), so the bytes a topic
carries stay small by construction.

## Goal & scope

- **In scope:** human drags a screenshot (image file) into the topic description
  surface; it renders in the desktop app.
- **Out of scope (for now):** agent/Playwright capture, live Storybook embeds,
  video/other media, and remote topic sharing. The data shape leaves room for
  future image sources (`source.storyId`, `mime`) but we are not building them.

## Core decision

Image bytes live in a dedicated `assets` field **on the `Topic`** (persisted
inline with the topic, alongside its other fields), *not* inlined into the
`description` markdown string. The description only holds a reference:

```markdown
![Button primary](asset://<hash>)
```

A render-time resolver swaps `asset://<hash>` → a real URL or data-URL.

Why not the alternatives:

- **Base64 in the description** — dead on arrival: web-ade caps `description` at
  **8,000 chars** (`web-ade/src/lib/topics/constants.ts`). Also bloats the editor.
- **Separate blob store + upload infra** — heavier than needed; web-ade already
  stores each topic as a whole JSON blob in S3, so carrying bytes on the topic is
  consistent with the existing model and needs no new upload endpoint to start.

## Data shape

Added to the canonical `Topic` in `@principal-ai/alexandria-core-library`
(`src/projects-core/types.ts:179`). Optional field → no topics.json migration.

```ts
interface TopicAsset {
  id: string;       // content hash → free dedup, stable asset:// target
  mime: string;     // "image/png"
  data?: string;    // base64 bytes (present locally + on publish)
  url?: string;     // optional hosted URL if remote asset support is added later
  alt?: string;
  source?: { storyId?: string; storybookUrl?: string }; // future: re-capture / open live
}

interface Topic {
  /* …existing… */
  assets?: TopicAsset[];
}
```

Resolver rule: prefer `url`, else build a data-URL from `data`. This keeps a
  local topic (data-only) renderable without a network service.

## Architecture (4 repos)

| Repo | Path | Role |
|---|---|---|
| themed-markdown | `/Users/griever/Developer/web-ade/industry-themed-markdown` | Renders the description in **both** apps; needs an image-resolver hook |
| alexandria-core-library | `/Users/griever/Developer/backlog-adaptation/alexandria-core-library` | Owns the canonical `Topic` type; add `assets` |
| electron-app | `/Users/griever/Developer/desktop-app/electron-app` | Drag-drop capture (size-capped), local storage, render wiring |
| web-ade | `/Users/griever/Developer/web-ade/web-ade` | Historical remote-rendering plan; not part of the current feature |

### Flow

```
screenshot → drag image file onto description editor
  → desktop rejects oversized images (drop-zone size cap)
  → hashes bytes, writes the asset onto topic.assets (persisted in topics.json)
  → inserts ![alt](asset://<hash>) into description markdown
  → IndustryMarkdownSlide resolves asset://<hash> via transformImageUri → <img>
```

### Key reference points (verified)

- **Topic type / storage:** `alexandria-core-library/src/projects-core/types.ts:179`
  (`Topic`), `TopicManager.ts` (writes `~/.alexandria/topics.json`, version
  `1.0.0`, no migration logic; spread-based updates pass new fields through).
- **Desktop storage:** `TopicManager` (in `alexandria-core-library`) has no
  in-memory cache — `getTopics()` and `getTopic()` both read+parse the whole
  `~/.alexandria/topics.json` on every call, and every mutation rewrites the
  entire file. Bytes ride inline on the topic, so the **drop-zone size cap is the
  thing that keeps this file small** — there is no separate asset store to manage.
- **Desktop drop zone:** `TopicDescriptionSlideOver.tsx` already uses
  `useDropZone` but only handles `DATA_TYPES.TEXT_SELECTION` / plain text — extend
  it to accept `image/*`.
- **Desktop render:** `IndustryMarkdownSlide` (from `themed-markdown`) in the
  slide-over; existing `useMarkdownLinkHandler` intercepts the `file:` scheme — the
  pattern to mirror for assets.
- **Desktop remote publishing:** removed; no Web-ADE topic publishing API is
  part of the desktop app.
- **web-ade storage:** `web-ade/src/lib/topics/s3-storage.ts` — whole topic as
  JSON at `topics/_by-id/{id}.json` (ETag read-modify-write). No image/blob infra
  exists today. `TopicPayload` in `web-ade/src/lib/topics/types.ts:48`.
- **web-ade render:** `web-ade/src/app/topic/[id]/page.tsx:951` — same
  `IndustryMarkdownSlide`.
- **themed-markdown image pipeline:** react-markdown → `img` handler
  (`IndustryMarkdownComponents.tsx`) → `OptimizedMarkdownMedia` →
  `transformImageUri` (host hook) → `transformImageUrl(src, repositoryInfo)`.
  **Host hook shipped in `themed-markdown@0.1.98`** (`transformImageUri` on
  `IndustryMarkdownSlideProps`); built to dist and consumed via node_modules
  (not linked).

## Plan

### Slice 1 — local end-to-end (no network)

- [x] **themed-markdown:** added `transformImageUri?: (src: string) => string` on
  `IndustryMarkdownSlideProps`, plumbed through `createIndustryMarkdownComponents`
  → `OptimizedMarkdownMedia`, applied before `transformImageUrl` when it returns a
  value. Custom schemes (`asset://`) needed two pipeline gates relaxed (only when
  a resolver is set): drop the `src` protocol allow-list in `rehypeSanitize`, and a
  custom react-markdown `urlTransform` that passes image `src` through instead of
  `defaultUrlTransform` stripping it. **Released `themed-markdown@0.1.98`** — bump
  in both apps. (Demo: `IndustryMarkdownSlide.transformImageUri.stories.tsx`.)
- [x] **alexandria-core-library:** added `TopicAsset` + `assets?` to `Topic`
  (`types.ts`), exported from the index. **Published `0.6.3`**, bumped in
  electron-app (`^0.6.3`).
- [x] **electron-app (capture + storage):** `topicImageDrop.ts` validates
  dropped `image/*` files (mime allow-list + 2 MB cap), hashes (SHA-256) and
  base64-encodes them. `TopicDescriptionSlideOver.tsx` composes a file-drop
  handler over `useDropZone` (which ignores `dataTransfer.files`), rejects with a
  dropped image handler over `useDropZone` (which ignores `dataTransfer.files`), rejects with a
  transient banner, and calls the `topic_attachImageAsset` route. That route
  stores the asset inline on the local topic (deduped by hash) and appends the
  `asset://<id>` reference. Now
  cast); `UpdateTopicInput` carries `assets?: TopicAsset[]`.
- [x] **electron-app (render):** bumped `themed-markdown` to `0.1.98` and pass
  `transformImageUri` into the slide-over's `IndustryMarkdownSlide` — resolves
  `asset://<id>` to a hosted `url` or a data-URL built from the asset's base64
  bytes; other schemes pass through.

_Exit criteria: screenshot → drag → renders, fully local._

### Remote sharing

Not implemented. The former Web-ADE publishing and shared-link flow has been
removed; a future replacement is a separate design decision.

### Later / optional

- [ ] Prune `topic.assets` entries when their `![](asset://…)` node is removed
  from the description (deleting a topic already drops its assets, since they live
  on the topic).
- [ ] Storybook-native affordances using `source.storyId` ("re-capture",
  "open live in Storybook").
- [ ] Agent capture route (`POST /api/topics/:id/assets`) if/when agents need it.

## Open questions

- ~~**Resolver prop:** function vs lookup map.~~ **Resolved:** went with a
  function (`transformImageUri`, react-markdown convention, host owns scheme
  detection). Shipped in 0.1.98.
- **Drop insertion point:** matched the existing **text** drop — the image
  `asset://` ref is *appended* to the bottom of the description (same atomic
  read-modify-write path as `topic_appendDescription`), not inserted at a cursor.
  Revisit if/when drops should land at a caret in the MDXEditor surface.
- **Validation caps:** desktop drop zone enforces **2 MB per image** and a mime
  allow-list of **PNG / JPEG / WebP / GIF** (`topicImageDrop.ts`). Oversized /
  wrong-type drops are rejected, not stored. Still open: max image *count* and
  *total* bytes per topic — needed for web-ade POST validation, which must agree
  with the desktop per-image cap.
