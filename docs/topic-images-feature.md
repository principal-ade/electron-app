# Topic Images (drag-and-drop screenshots)

> Status: **Design / not started** · Last updated: 2026-06-07

Let users attach images to topics — primarily screenshots of Storybook stories —
by dragging an image file into the topic description editor. Images are stored
**on the topic, referenced from the description**, and must survive publishing to
web-ade.

## Goal & scope

- **In scope:** human drags a screenshot (image file) into the topic description
  surface; it renders in the desktop app; it publishes to web-ade and renders
  there too.
- **Out of scope (for now):** agent/Playwright capture, live Storybook embeds,
  video/other media. The data shape leaves room for these later
  (`source.storyId`, `mime`) but we are not building them.

## Core decision

Image bytes live in a dedicated `assets` field **on the `Topic`**, *not* inlined
into the `description` markdown string. The description only holds a reference:

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
  url?: string;     // resolvable URL (web-ade may offload to S3 later)
  alt?: string;
  source?: { storyId?: string; storybookUrl?: string }; // future: re-capture / open live
}

interface Topic {
  /* …existing… */
  assets?: TopicAsset[];
}
```

Resolver rule: prefer `url`, else build a data-URL from `data`. This keeps a
local topic (data-only) and a published one (url, if offloaded) both renderable
and "interchangeable on read."

## Architecture (4 repos)

| Repo | Path | Role |
|---|---|---|
| themed-markdown | `/Users/griever/Developer/web-ade/industry-themed-markdown` | Renders the description in **both** apps; needs an image-resolver hook |
| alexandria-core-library | `/Users/griever/Developer/backlog-adaptation/alexandria-core-library` | Owns the canonical `Topic` type; add `assets` |
| electron-app | `/Users/griever/Developer/desktop-app/electron-app` | Drag-drop capture, sidecar storage, render wiring, publish |
| web-ade | `/Users/griever/Developer/web-ade/web-ade` | Accept/store/serve `assets`; render with the same hook |

### Flow

```
screenshot → drag image file onto description editor
  → desktop hashes bytes, writes sidecar (~/.alexandria/topic-assets/<topicId>.json)
  → inserts ![alt](asset://<hash>) into description markdown
  → IndustryMarkdownSlide resolves asset://<hash> via transformImageUri → <img>
  → on publish: assets hydrated from sidecar into POST /api/topics payload
  → web-ade stores assets in topic JSON (S3), serves on GET, renders same way
```

### Key reference points (verified)

- **Topic type / storage:** `alexandria-core-library/src/projects-core/types.ts:179`
  (`Topic`), `TopicManager.ts` (writes `~/.alexandria/topics.json`, version
  `1.0.0`, no migration logic; spread-based updates pass new fields through).
- **Desktop storage hot path:** `TopicManager.getTopics()` loads all topics from
  one file — bytes must **not** live here. Use a per-topic sidecar, hydrate on
  single-topic open only.
- **Desktop drop zone:** `TopicDescriptionSlideOver.tsx` already uses
  `useDropZone` but only handles `DATA_TYPES.TEXT_SELECTION` / plain text — extend
  it to accept `image/*`.
- **Desktop render:** `IndustryMarkdownSlide` (from `themed-markdown`) in the
  slide-over; existing `useMarkdownLinkHandler` intercepts the `file:` scheme — the
  pattern to mirror for assets.
- **Desktop publish:** `topicShare.ts:206` — `POST /api/topics` sends a
  hand-picked `{ title, description, trailIds, status }`; `assets` must be added
  explicitly. Base URL `WEB_ADE_API_URL || https://app.principal-ade.com/api`,
  Bearer token.
- **web-ade storage:** `web-ade/src/lib/topics/s3-storage.ts` — whole topic as
  JSON at `topics/_by-id/{id}.json` (ETag read-modify-write). No image/blob infra
  exists today. `TopicPayload` in `web-ade/src/lib/topics/types.ts:48`.
- **web-ade render:** `web-ade/src/app/topic/[id]/page.tsx:951` — same
  `IndustryMarkdownSlide`.
- **themed-markdown image pipeline:** react-markdown → `img` handler
  (`IndustryMarkdownComponents.tsx:688`) → `OptimizedMarkdownMedia` →
  `transformImageUrl(src, repositoryInfo)` (`:94`). **No host-facing override
  today** — must add a hook. Package `themed-markdown@0.1.97`, built to dist and
  consumed via node_modules (not linked).

## Plan

### Slice 1 — local end-to-end (no network)

- [ ] **themed-markdown:** add a synchronous `transformImageUri?: (src: string) => string`
  prop on `IndustryMarkdownSlideProps`; plumb through `createIndustryMarkdownComponents`
  → `OptimizedMarkdownMedia` (`:94`), applied before/instead of `transformImageUrl`
  when it returns a value. Release; bump in both apps.
- [ ] **alexandria-core-library:** add `TopicAsset` + `assets?` to `Topic`
  (`types.ts:179`). Release; bump in electron-app.
- [ ] **electron-app (storage):** per-topic sidecar
  `~/.alexandria/topic-assets/<topicId>.json`; hydrate `topic.assets` on
  single-topic open only; keep `getTopics()` lean.
- [ ] **electron-app (capture + render):** extend `TopicDescriptionSlideOver.tsx`
  drop zone to accept `image/*` → hash → sidecar → insert `asset://` node; pass
  `transformImageUri` into the slide-over's `IndustryMarkdownSlide`.

_Exit criteria: screenshot → drag → renders, fully local._

### Slice 2 — publish

- [ ] **electron-app:** add `assets` to the `POST /api/topics` payload
  (`topicShare.ts:206`); hydrate from sidecar at publish time.
- [ ] **web-ade:** accept + validate `assets` (cap count / total bytes / mime) on
  POST; **start by inlining bytes in the topic JSON** (`data` field — matches the
  S3-blob-per-topic model, no new upload infra); return on GET; pass
  `transformImageUri` to `IndustryMarkdownSlide` in `topic/[id]/page.tsx`.

_Exit criteria: publish a topic with an image → renders on web-ade._

### Later / optional

- [ ] web-ade S3-media offload: split bytes to `topics/_media/{topicId}/{assetId}`,
  return `url`. Reversible — the `url` field already accommodates it.
- [ ] Asset garbage collection on topic delete / when an image node is removed.
- [ ] Storybook-native affordances using `source.storyId` ("re-capture",
  "open live in Storybook").
- [ ] Agent capture route (`POST /api/topics/:id/assets`) if/when agents need it.

## Open questions

- **Resolver prop:** function (`transformImageUri`, react-markdown convention,
  host owns scheme detection) vs lookup map (`assetLookup: Record<id,url>`).
  Leaning function. _Pick before touching themed-markdown._
- **Drop insertion point:** the rendered slide-over surface (`useDropZone`,
  already wired) vs the MDXEditor surface. Need to confirm where the current
  **text** drop inserts so image-drop lands consistently.
- **Validation caps:** max image count per topic, max bytes per image / per
  topic, allowed mime types — needed for web-ade POST validation.
