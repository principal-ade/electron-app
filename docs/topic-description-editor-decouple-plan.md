# Decoupling the topic-description editor from the file model

Status: proposal / follow-up
Last updated: 2026-05-30
Related commit: `e1650976d` (fix: stop MDX editor flashing "Loading file..." on Cmd+S)

## Problem

The Alexandria "Description" tab edits a topic's `description` field — a value in
`topics.json`, not a file on disk. It reuses the file-backed `MDXEditorPanel`
from `@industry-theme/file-editing-panels` by handing it a **synthetic path**
(`topic://<id>/description.md`) and intercepting the panel's `readFile`/`writeFile`
actions to route them to `TopicService` instead of the filesystem. The `.md`
suffix is used to trick the editor into markdown mode.

This works, but it's a hack: the panel conflates two responsibilities that the
topic case needs to separate.

1. **Editing surface** — toolbar, plugins, dirty tracking, Cmd+S handling,
   theming, the markdown WYSIWYG itself. (We want this.)
2. **Data binding** — `filePath` + `readFile`/`writeFile` + `file:open` /
   `git:diff` / `file:save` events. (Meaningless for a DB field.)

Symptoms that fall out of the mismatch:

- **Reload-on-save flash** (now fixed): the panel's file-load effect is keyed on
  the `actions` prop identity; the host re-spread the churning provider actions
  on every save, so Cmd+S handed the panel a fresh `actions` object and
  retriggered a load, flashing "Loading file...". Fixed in `e1650976d` by making
  the actions object identity-stable (ref + Proxy) — but that's still treating
  the symptom inside the hack.
- **Blind re-fetch**: `readTopicDescription` "always fetches fresh" because there
  is no change-notification channel. There are **multiple writers** to
  `topic.description` (the description tab *and* the trail brief), and the file
  model gives no clean way to react to external edits.
- **Irrelevant git UI**: `git:diff` / git-status indicators are meaningless for a
  topic field.

## Key file references

### electron-app (the hack lives here)

- `src/renderer/alexandria-workspace/topic-description-tab/topicDescriptionSentinel.ts`
  — builds/parses the `topic://<id>/description.md` sentinel path; `readTopicDescription`
  (`:39`) and `writeTopicDescription` (`:49`) route to `TopicService`.
- `src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx`
  - `:419` — `topicEditorActions` Proxy (the identity-stable workaround) that
    overrides `readFile`/`writeFile` and delegates everything else to the live
    provider actions via `actionsRef`.
  - `:503` — the `topic-description` tab renders `MDXEditorPanel` with the
    sentinel `filePath` and `topicEditorActionsRef.current`.
- `src/renderer/main-process-api/TopicService.ts:41` — `updateTopic` wrapper.
- `src/renderer/tipc/topicClient.ts:97` — TIPC `topic_updateTopic` invoke.
- `src/main/topics/tipc/topicRouter.ts:90` — main handler; broadcasts
  `TopicAPIEvent.TOPIC_UPDATED` after the update.
- `src/main/stores/TopicRegistryService.ts:106` — persists to `topics.json`
  (+ `topics-sync.json`).

### industry-themed-file-editing-panels (the panel)

Repo: `/Users/griever/Developer/industry-themed-file-editing-panels`

- `src/panels/MDXEditorPanel/MDXEditorPanel.tsx`
  - `:267` — `handleSave` (calls `actions.writeFile`, emits `file:save`).
  - `:302` — file-load effect, deps `[filePath, actions, isDirtyProp]`; sets
    `isLoading` and re-reads via `actions.readFile`. **This is the effect the
    hack keeps tripping.**
  - `:334` — Cmd+S / Ctrl+S keydown handler.
  - `:365` — the "Loading file..." render branch.
  - `:53` `filePath` prop precedence, `:71` `isDirty` prop override, `:65`
    `gitStatus` prop override — existing seams that already point toward a
    controlled mode.
- `src/types/index.ts:149` — `MDXEditorPanelActions` (adds `readFile`/`writeFile`
  to the all-optional base `PanelActions`).

## Recommendation

Don't fork a new panel that re-implements the rich editor — that clones the
editing surface and lets the two drift. **Split the existing panel so the data
binding is swappable.**

### Phase 1 — controlled core (do this first)

Extract the editing surface into a fully-controlled, presentational component;
make the file behavior one adapter among several.

```
MDXEditorCore            // pure: value, onChange, onSave, isDirty, isLoading, error, readOnly
  ├─ FileMDXEditorPanel  // adapter: filePath + readFile/writeFile  ← today's behavior
  └─ host bindings       // adapter: TopicService.getTopic/updateTopic, no path
```

The inner `@principal-ai/mdx-editor` `MDXEditor` is already controlled
(`markdown` + `onChange`), and `MDXEditorPanel` already has `isDirty`/`gitStatus`/
`filePath` prop overrides — so controlled `value`/`onSave` is additive and the
file-mode path stays fully intact. In controlled mode the `:302` load effect
simply doesn't run.

Alexandria side then collapses to roughly:

```tsx
<MDXEditorCore
  value={description}
  isLoading={isLoading}
  onSave={(md) => TopicService.updateTopic(topicId, { description: md })}
/>
// subscribe to TOPIC_UPDATED to refresh `description` when the trail brief writes it
```

Deletes: the sentinel module, the Proxy/`actionsRef` workaround, the `.md` suffix
trick, and the blind re-fetch. External edits (trail brief) flow in through the
`TOPIC_UPDATED` subscription instead of a per-render re-read.

### Phase 2 — resource/VFS layer (only if a family of virtual docs appears)

If we end up with several non-file documents (topic descriptions, trail briefs,
scratchpads, AI drafts), formalize a resource-provider layer: register URI
schemes (`topic://`) with `read`/`write`/`watch` handlers and let the file panel
resolve any registered scheme — the VS Code `FileSystemProvider` model. Keeps the
file metaphor but makes it first-class, and `watch` removes the re-fetch problem.

These compose: the controlled core is the foundation; VFS is a separate concern
(where the bytes come from) that can sit on top later. Do Phase 1 now; reach for
Phase 2 only when the second or third virtual document shows up.

## Suggested next steps

1. Add controlled-mode props (`value`/`onChange`/`onSave`/`isLoading`) to
   `MDXEditorPanel` in the library, behind the existing prop-precedence pattern,
   without touching file mode.
2. Rewire the Alexandria description tab to use controlled mode + a
   `TOPIC_UPDATED` subscription; delete `topicDescriptionSentinel.ts` and the
   Proxy in `AlexandriaWorkspaceLayout.tsx`.
3. Leave the `e1650976d` workaround in place until Phase 1 lands (it's the only
   thing keeping the current hack from flashing on save).
