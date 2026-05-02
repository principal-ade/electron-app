# File City Sequence Diagram Overlay

This document describes how to expose an HTTP route on the electron-app that accepts a sequence-diagram payload and renders it as an overlay on top of the File City panel, with click-to-highlight wired to the corresponding building. Selecting an event also opens a right-edge **snippet drawer** rendered with `@pierre/diffs` and connects the building to the drawer with an SVG **leader line**.

The design ports the working prototype at `web-ade/file-city/packages/react/src/stories/SequenceDiagramOverlay.stories.tsx` into the electron-app's `file-city-panel`, driven by an HTTP route on the existing Principal MCP Bridge. The leader-line behavior mirrors `web-ade/file-city/packages/react/src/stories/LeaderLineSnippetOverlay3D.stories.tsx`.

## Background

### Prototype

`web-ade/file-city` ships a Storybook prototype that overlays a swimlane sequence diagram on a flat `FileCity3D`. Each event carries an optional `sourcePath`; clicking an event drives a `HighlightLayer` on the matching building.

Key prototype pieces:

- `web-ade/file-city/packages/react/src/stories/SequenceDiagramOverlay.stories.tsx` — overlay layout, drawer, settings panel, click → highlight wiring
- `@principal-ai/principal-view-react` — exports `SequenceDiagramRenderer`, `SequenceEvent`, `SequenceEdge`

### Electron app

The electron-app already has everything needed to host this:

- `@principal-ai/principal-view-react@^0.15.6` is already a dependency (`package.json:225`) → renderer can import `SequenceDiagramRenderer` directly with no install.
- An Express HTTP server runs in main: `src/main/principal-mcp/PrincipalMCPBridge.ts` (`this.app = express()` at line 35), bound to `localhost`, started from `src/main/initialization.ts:164`.
- File City panel: `src/renderer/dev-workspace/file-city-panel/FileCityPanel.tsx` mounts `FileCityExplorer`, which already manages `highlightLayers` and renders `<FileCity3D>` (`FileCityExplorer.tsx:1178`).
- Main → renderer broadcast pattern: `BrowserWindow.getAllWindows().forEach(w => w.webContents.send(eventName, payload))` (see `WorkspaceApiEventHandler.ts:60`).

## Goals

- Accept a sequence-diagram payload over HTTP from external agents/tools.
- Push the payload to the renderer process(es).
- Render the diagram as a collapsible overlay on top of the active File City panel.
- On node click: highlight the corresponding building, open a right-edge snippet drawer for the focal lines, and draw a leader line from the building to the drawer.
- Allow the overlay to be cleared.

## Non-goals

- Authoring sequence diagrams inside the app.
- Multi-payload stacking (only the latest *active* payload is shown — saved payloads are managed separately, see [persistence doc](file-city-sequence-diagram-persistence.md)).
- Multi-snippet stacking (only the selected event's snippet is shown).

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          External Caller                            │
│                  (agent, CLI, browser, MCP tool)                    │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTP POST /api/file-city/sequence
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    PrincipalMCPBridge (main)                        │
│  - Validates payload                                                │
│  - Stores latest payload (per-repository keyed)                     │
│  - Broadcasts via webContents.send(...)                             │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ IPC: 'file-city:sequence-diagram'
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    File City Panel (renderer)                       │
│  - Listens for the event                                            │
│  - Renders SequenceDiagramRenderer in a bottom drawer               │
│  - Hides elevated folder/scope panels while a payload is active     │
│  - On node click:                                                   │
│      • derives a HighlightLayer from sourcePath                     │
│      • opens SequenceEventDetailOverlay (right edge) with the       │
│        Pierre snippet view scoped to event.snippet                  │
│      • draws SequenceLeaderLine (SVG) from the building's projected │
│        screen position to the snippet drawer                        │
└────────────────────────────────────────────────────────────────────┘
```

## Key Files Reference

### Existing Infrastructure

| File | Purpose |
|------|---------|
| `src/main/principal-mcp/PrincipalMCPBridge.ts` | Express server — add routes here |
| `src/main/initialization.ts` | Bridge lifecycle (start/stop) |
| `src/shared/main-process-api-interfaces/` | Add IPC event constants here |
| `src/renderer/dev-workspace/file-city-panel/FileCityPanel.tsx` | Panel root — mount overlay here |
| `src/renderer/dev-workspace/file-city-panel/FileCityExplorer/FileCityExplorer.tsx` | Owns `cityData` and `highlightLayers`; takes injected layer for sequence selection |
| `src/renderer/utils/gitStatusHighlightLayers.ts` | Existing highlight-layer pattern to mirror |
| `src/renderer/dev-workspace/file-city-panel/buildCityDataFromContext.ts` | `stripRootPath` helper for repo-relative ↔ city-path normalization |

### New Files

| File | Purpose |
|------|---------|
| `src/main/file-city/sequenceDiagramRoutes.ts` | Express route handlers for the new endpoints |
| `src/main/file-city/sequenceDiagramStore.ts` | In-memory store + broadcast helper + `registerSequenceDiagramHandlers()` for the `GET_CURRENT` IPC |
| `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts` | Shared types (`SequenceDiagramPayload`, `FileCitySequenceEventDef`, `SequenceEventSnippet`, `FileCitySequenceAPI`) |
| `src/window/main-process-api-implementations/fileCitySequenceApi.ts` | Renderer-facing API surface (exposed via `mainProcess.fileCitySequence`) |
| `src/renderer/dev-workspace/file-city-panel/SequenceDiagramOverlay.tsx` | The bottom drawer + `<SequenceDiagramRenderer>` mount |
| `src/renderer/dev-workspace/file-city-panel/SequenceEventDetailOverlay.tsx` | Right-edge drawer; header + metadata strip + `<PierreSnippetView>` |
| `src/renderer/dev-workspace/file-city-panel/PierreSnippetView.tsx` | Pierre `<File>` (from `@pierre/diffs/react`) wrapper that slices the file to the snippet's line range and shows the original range in a header |
| `src/renderer/dev-workspace/file-city-panel/PierreSnippetDiffView.tsx` | Pierre `<FileDiff>` wrapper for the diff snippet variant. Parses old + new contents via `parseDiffFromFile`, applies the optional snippet window to both sides, and forwards `background` / `diffStyle` |
| `src/renderer/dev-workspace/file-city-panel/SequenceLeaderLine.tsx` | SVG overlay; per-frame imperative path/marker updates from `onCameraFrame` |
| `src/renderer/dev-workspace/file-city-panel/SequenceMarkdownOverlay.tsx` | Left-edge floating markdown panel rendered with `IndustryMarkdownSlide`; one slot, two sources (event `description` or payload `summary`) |
| `src/renderer/dev-workspace/file-city-panel/useSequenceDiagram.ts` | Hook: subscribes to IPC, rehydrates via `getCurrent`, exposes `{payload, selectedEventId, setSelectedEventId, clear}` |

The shared `MainProcessAPI` (`src/shared/main-process-api-interfaces/index.ts`) and the dev-workspace `DevWorkspaceMainProcessAPI` (`src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts`) both gained a `fileCitySequence: FileCitySequenceAPI` field, exposed by `preload.ts` and `preload-dev-workspace.ts`.

## HTTP API

All routes are mounted on the existing bridge (`localhost:<bridge-port>`), so they inherit the existing CORS and JSON middleware.

The bridge port comes from `APP_BRANDING.BRIDGE_PORTS.{DEVELOPMENT,PRODUCTION}.PRINCIPAL_MCP` — currently **3054** (dev) and **3044** (prod). `GET /health` on either port confirms which is alive.

### `POST /api/file-city/sequence`

Set or replace the active sequence diagram.

**Request body:**

```ts
interface SequenceDiagramPayload {
  /** Optional title shown in the drawer header */
  title?: string;
  /** Optional repo path; used to target a specific File City panel when multiple are open */
  repositoryPath?: string;
  /**
   * Optional markdown that describes the whole flow. Surfaced in the
   * left-edge overlay when no event is selected; per-event `description`
   * takes over once the user picks an event.
   */
  summary?: string;
  /** Required — events in display order */
  events: SequenceEvent[];   // from @principal-ai/principal-view-react
  /** Required — edges between events */
  edges: SequenceEdge[];
}
```

`SequenceEdge` is imported verbatim from `@principal-ai/principal-view-react`. Events are typed as `FileCitySequenceEventDef` — the upstream `SequenceEvent` plus an optional `snippet` reference defined in this repo:

```ts
// from @principal-ai/principal-view-react
interface SequenceEvent {
  id: string;
  name: string;            // namespaced, e.g. "auth.workos.callback.received"
  label?: string;
  type?: string;
  moveEvent?: boolean;
  participant?: string;
  sourcePath?: string;     // repo-relative; drives the highlight
  data?: Record<string, unknown>;
}

interface SequenceEdge {
  id: string;
  fromEvent: string;
  toEvent: string;
  label?: string;
  type?: string;
}

// from src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts
type SequenceEventSnippet = SliceSnippet | DiffSnippet;

/**
 * Default — reads `event.sourcePath` and renders a single-file snippet.
 * `kind` may be omitted for back-compat; missing `kind` is treated as `'slice'`.
 */
interface SliceSnippet {
  kind?: 'slice';
  startLine: number;       // 1-based, inclusive
  endLine: number;         // 1-based, inclusive
  focusLine?: number;      // line to highlight; defaults to startLine
  contextLines?: number;   // bufferBefore/After; default 2
}

/**
 * Diff variant — renders a before/after view inline. Used by code-review
 * walkthroughs where each event represents a change region in a PR.
 */
interface DiffSnippet {
  kind: 'diff';
  /** Pre-change file contents (full file or a pre-sliced window). */
  oldContents: string;
  /**
   * Post-change file contents. Optional — when omitted the renderer reads
   * the current contents at `event.sourcePath` and diffs against `oldContents`.
   */
  newContents?: string;
  /** Optional snippet window (1-based) applied to both sides before diffing. */
  startLine?: number;
  endLine?: number;
  focusLine?: number;
  contextLines?: number;
  /** Pierre rendering style. Defaults to `'unified'`. */
  diffStyle?: 'unified' | 'split';
}

type FileCitySequenceEventDef = SequenceEvent & {
  snippet?: SequenceEventSnippet;
};
```

When `snippet` is provided, the event must also have a `sourcePath` — that path is what the slice variant reads from, and what the diff variant uses both as the language hint for syntax highlighting and as the fallback when `newContents` is omitted.

The two variants exist for different intents:

- **`slice`** — runtime traces. The event points at a static line range in a file as it is on disk. Cheap to author; the renderer reads the file directly.
- **`diff`** — code-review walkthroughs. The event represents a change region; the payload carries the old contents (and optionally the new) so the diagram can step through a PR/commit one event at a time, inline. See [Snippet rendering](#snippet-rendering) for which Pierre wrapper each variant resolves to.

**Response:**

```json
{ "success": true, "broadcastTo": 1 }
```

`broadcastTo` is the count of windows that received the IPC message.

**Validation:**

- `events` must be a non-empty array; each must have `id` and `name`.
- `edges[*].fromEvent` and `edges[*].toEvent` must reference event IDs from the payload.
- If `event.snippet` is set, `event.sourcePath` must also be set.
- For slice snippets (`kind` omitted or `'slice'`): `startLine`/`endLine` must be positive integers with `endLine >= startLine`. `focusLine` (if present) must be a positive integer; `contextLines` must be non-negative.
- For diff snippets (`kind: 'diff'`): `oldContents` must be a non-empty string. `newContents`, if provided, must be a string (otherwise the renderer reads `sourcePath`). When `startLine`/`endLine` are provided they apply to both sides and follow the slice rules above. `diffStyle`, if present, must be `'unified'` or `'split'`.
- Reject payloads larger than the existing `10mb` JSON limit (already configured at `PrincipalMCPBridge.ts:42`).

### `DELETE /api/file-city/sequence`

Clear the active sequence diagram (closes the overlay). Optional `?repositoryPath=<path>` query targets a single panel; without it, clears the default slot.

**Response:** `{ "success": true, "broadcastTo": <number> }`

### `GET /api/file-city/sequence`

- With `?repositoryPath=<path>`: returns `{ success, payload }` where `payload` is the matching payload or `null`.
- Without a query: returns `{ success, payloads }` — every payload currently in the store.

Useful for debugging; the panel itself rehydrates via the IPC `GET_CURRENT` channel rather than this route.

## IPC Contract

Defined in `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`:

```ts
export enum FileCitySequenceEvent {
  PAYLOAD_SET = 'file-city:sequence-diagram:set',         // main → renderer broadcast
  PAYLOAD_CLEARED = 'file-city:sequence-diagram:cleared', // main → renderer broadcast
  GET_CURRENT = 'file-city:sequence-diagram:get-current', // renderer → main invoke
}

export interface FileCitySequenceAPI {
  getCurrent: (repositoryPath?: string) => Promise<SequenceDiagramPayload | null>;
  onPayloadSet: (cb: (p: SequenceDiagramPayload) => void) => () => void;
  onPayloadCleared: (cb: (info: { repositoryPath?: string }) => void) => () => void;
}
```

`PAYLOAD_SET` and `PAYLOAD_CLEARED` are pushed to all `BrowserWindow`s; the renderer hook filters by `repositoryPath` (if provided) to match the panel's current repo. `GET_CURRENT` is the IPC `invoke` handler that backs `getCurrent()` so panels can rehydrate on mount without going through the HTTP route.

## Renderer Wiring

### Hook: `useSequenceDiagram`

Talks to the typed preload surface — no raw `ipcRenderer` access in the renderer:

```ts
export function useSequenceDiagram(repositoryPath: string | null) {
  const [payload, setPayload] = useState<SequenceDiagramPayload | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return;

    api.getCurrent(repositoryPath ?? undefined).then((current) => {
      if (current && matchesRepo(current, repositoryPath)) setPayload(current);
    });

    const offSet = api.onPayloadSet((next) => {
      if (!matchesRepo(next, repositoryPath)) return;
      setPayload(next);
      setSelectedEventId(null);
    });
    const offCleared = api.onPayloadCleared((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      setPayload(null);
      setSelectedEventId(null);
    });

    return () => { offSet(); offCleared(); };
  }, [repositoryPath]);

  return { payload, selectedEventId, setSelectedEventId, clear: () => setPayload(null) };
}
```

### Highlight layer derivation

`FileCityExplorer` accepts a focused `sequenceSelection?: { sourcePath: string } | null` prop and builds the layer internally — that keeps the `toCityPath` converter and `cityBuildingPaths` lookup encapsulated, and lets the panel stay agnostic to city-coordinate conversion:

```ts
// inside FileCityExplorer.tsx
const sequenceHighlightLayer = useMemo<HighlightLayer | null>(() => {
  if (!sequenceSelection?.sourcePath) return null;
  const cityPath = toCityPath(sequenceSelection.sourcePath);
  if (!cityBuildingPaths.has(cityPath)) return null;
  return {
    id: 'sequence-selection',
    name: 'Sequence Selection',
    enabled: true,
    color: '#22d3ee',
    opacity: 0.9,
    borderWidth: 4,
    priority: 100,
    items: [{ path: cityPath, type: 'file', renderStrategy: 'fill' }],
  };
}, [sequenceSelection, toCityPath, cityBuildingPaths]);
```

This layer is appended to the existing `extras` array inside the `<FileCity3D highlightLayers={...}>` IIFE, alongside `commitHighlightLayers`, `workingTreeHighlightLayers`, and the search-related layers.

### Overlay components

Four overlay components mount on top of `<FileCityExplorer>` inside `FileCityPanel.tsx`:

- `SequenceDiagramOverlay` — bottom drawer, 50% panel height. Prop-driven (`payload`, `selectedEventId`, `onNodeClick`, `onClose`).
- `SequenceEventDetailOverlay` — right-edge drawer (38% panel width, min 360px), `top: 0` to `bottom: 50%` so it sits above the bottom drawer. Header shows `event.label` + `fileName · Lines X–Y`, plus close + open-in-tab buttons. The body is `<PierreSnippetView>` when both `sourcePath` and `snippet` are present, otherwise a placeholder. Esc closes; the building stays selected so you can pick a different node from the diagram.
- `SequenceMarkdownOverlay` — left-edge floating panel (28% width, min 280px), `top: FLOAT_INSET` to `bottom: 50% + FLOAT_INSET`, mounted whenever a markdown source is available. Renders an eyebrow + title header followed by `IndustryMarkdownSlide`. The slot is shared by two sources, with priority: the selected event's `description` wins, otherwise the payload's `summary` is used. The panel is silent (returns `null`) when neither is present.
- `SequenceLeaderLine` — full-panel SVG (`pointer-events: none; overflow: visible; z-index: 31`) drawing a single dashed bezier from the building's projected screen position to the detail overlay's left edge. See [Leader line](#leader-line).

The panel resolves `selectedEventId` → event once and threads selection down to the explorer plus the overlays:

```tsx
const selectedSequenceEvent = useMemo(() => {
  if (!sequencePayload || !sequenceSelectedEventId) return null;
  return sequencePayload.events.find((e) => e.id === sequenceSelectedEventId) ?? null;
}, [sequencePayload, sequenceSelectedEventId]);

const sequenceSelection = useMemo(() => {
  if (!selectedSequenceEvent?.sourcePath) return null;
  return { sourcePath: selectedSequenceEvent.sourcePath };
}, [selectedSequenceEvent]);

<FileCityExplorer
  ...
  sequenceSelection={sequenceSelection}
  hideFolderPanels={!!sequencePayload}
  onCameraFrame={(camera, size) => leaderLineRef.current?.onCameraFrame(camera, size)}
/>
{sequencePayload && <SequenceDiagramOverlay ... />}
{selectedSequenceEvent && (
  <SequenceEventDetailOverlay
    ref={detailOverlayRef}
    event={selectedSequenceEvent}
    absolutePath={selectedEventAbsolutePath}
    bottomOffset="50%"
    onClose={() => setSequenceSelectedEventId(null)}
  />
)}
<SequenceLeaderLine
  ref={leaderLineRef}
  containerRef={panelContainerRef}
  building={selectedSequenceEvent ? selectedBuilding : null}
  cityCenter={cityCenter}
  targetRef={detailOverlayRef}
/>
```

### Snippet rendering

`SequenceEventDetailOverlay` picks a Pierre wrapper based on `snippet.kind`:

- `'slice'` (or `kind` omitted) → `<PierreSnippetView>`.
- `'diff'` → `<PierreSnippetDiffView>`.

Both wrappers expose the same `background?: string` knob, which generates a small `unsafeCSS` block (`:host` plus the Pierre-painted `data-*` elements) so the snippet area picks up the overlay's solid theme background. `transparent` is no longer accepted — pass an explicit color.

#### Slice variant

`PierreSnippetView` reads the file via `FileSystemService.readFile`, slices to `[startLine - contextLines, endLine + contextLines]`, and feeds the slice into `<File>` from `@pierre/diffs/react`. The Pierre React component owns its own `<diffs-container>` web component (shadow DOM, theme styles, Shiki highlighting), so we use it as-is rather than driving the lower-level `File` class — see [Why the React component](#why-the-react-component).

We considered using Pierre's `renderRange` to clip a full file in-place (preserving the original gutter line numbers), but that prop isn't surfaced through `<File>` — only on the underlying class. Slicing client-side and surfacing `Lines X–Y` in our own header above the Pierre output is the simpler trade-off.

`focusLine` is currently surfaced via `selectedLines` (Pierre's selection range, offset into the slice). The class supports per-line annotations through `lineAnnotations` if we later want a custom marker on the focal line.

#### Diff variant

`PierreSnippetDiffView` accepts `oldContents` and `newContents` as strings (full files or pre-sliced windows). When `startLine`/`endLine` are set, the same window is applied to both sides before diffing — approximate when the change adds or removes lines, but adequate for snippet-scale views; callers that need exact correspondence can pre-slice and leave the window props off.

The component runs `parseDiffFromFile({ name, contents: oldText }, { name, contents: newText })` (from `@pierre/diffs`) to build a `FileDiffMetadata`, then renders `<FileDiff>` (from `@pierre/diffs/react`). `diffStyle` (`'unified'` | `'split'`) is forwarded into Pierre's options. `focusLine` becomes a `selectedLines` highlight just like the slice variant; the `Lines X–Y` header is reused so authoring remains consistent across variants.

The component does **not** call `FileSystemService.readFile` itself. Resolving "what is the new content" depends on use case (working tree, commit blob, PR head, etc.), so the wrapper takes already-resolved strings and leaves fetch policy to the caller. For diff snippets that omit `newContents`, the overlay layer is responsible for loading `event.sourcePath` and passing it through.

### Why the React component

Initial implementation used the lower-level `File` class from `@pierre/diffs` directly so we could pass `renderRange`. That ended up rendering into a plain `<div>` instead of the `<diffs-container>` custom element, which meant no shadow-DOM scoped CSS, no theme stylesheet, no syntax highlighting, and the gutter columns rendered as a stacked list. Switching to `<File>` from `@pierre/diffs/react` brings all of that back at the cost of losing real gutter line numbers — addressed by the header label.

### Leader line

`SequenceLeaderLine` mirrors the per-frame projection pattern from the prototype at `web-ade/file-city/.../LeaderLineSnippetOverlay3D.stories.tsx`:

1. **Stable layouts in refs.** `building`, `cityCenter`, and `targetRef` are mirrored in refs so the per-frame callback closure stays stable.
2. **SVG shells rendered once.** `<path>`, `<rect>` (building marker), `<circle>` (drawer marker) — all initially `opacity={0}`. Refs in `pathRef` / `buildingMarkerRef` / `nodeMarkerRef`.
3. **`onCameraFrame` callback.** Threaded from `<FileCityExplorer onCameraFrame=...>` → `<FileCity3D>`. Each frame:
   - Project `building.position - cityCenter` via `THREE.Vector3.set(x, 0, z).project(camera)`. `y` is forced to `0` (ground plane center) so the anchor sits at the building's footprint regardless of camera tilt — using `position.y` lands the anchor above the visible building under any tilted camera.
   - Convert NDC → canvas pixels: `(v.x * 0.5 + 0.5) * size.width`, `(v.y * -0.5 + 0.5) * size.height`.
   - Add **canvas inset offset**: FileCityExplorer mounts the canvas at `top: 56` under its focus-bar header (FileCityExplorer.tsx:1207), so the per-frame callback queries `container.querySelector('canvas')` and adds `canvasRect.left - containerRect.left`, `canvasRect.top - containerRect.top` to land in panel-local coords.
   - Behind-camera guard via `v.z > 1`.
   - Aim the line at the detail overlay's nearer vertical edge.
   - Cubic bezier with horizontal tangents: `M sx sy C sx+dx sy, bx-dx by, bx by`, with `dx = max(80, |bx-sx|*0.5)` so the curve reads as a leader line at any distance.
4. **Imperative writes.** `pathEl.setAttribute('d', d)`, `setAttribute('opacity', '0.85')`, etc. No setState per frame.
5. **`hideFolderPanels` on FileCityExplorer.** While a payload is active the elevated folder/scope panels (`elevatedScopePanels`) are forced to `undefined` so the leader line + sequence diagram are the only floating structure.

The SVG fades when no event is selected: a `useEffect` hides all three SVG elements as soon as `building` becomes `null`.

### `OnCameraFrame` plumbing

`@principal-ai/file-city-react` defines `OnCameraFrame` on `FileCity3D`'s props but doesn't re-export the type from the package's main index. `FileCityExplorer` and `SequenceLeaderLine` each declare a local mirror (`(camera: THREE.Camera, size: { width: number; height: number }) => void`) to avoid reaching into the package's deep paths.

## Path Reconciliation

External callers post repo-relative paths like `auth-server/src/middleware.ts`. City building paths are also repo-relative but may be prefixed by the city root (`rootPath = tree.metadata.id`). Use the existing `stripRootPath` / `toCityPath` helpers in `buildCityDataFromContext.ts` so callers don't need to know the panel's internal prefixing.

If a `sourcePath` doesn't resolve to any building, render the diagram normally but skip the highlight (no error).

## Multi-window Targeting

The bridge broadcasts to all windows; the renderer hook filters by `repositoryPath`. If `payload.repositoryPath` is omitted, every open File City panel will display the overlay. Call sites that know the target repo should always include it.

## Security

The bridge listens on `localhost` only (`PrincipalMCPBridge.ts:999`), so the surface is limited to processes on the user's machine. CORS is currently `*`, which means any local browser tab can post to it — acceptable for the existing `/theme/*` and `/api/bruno/*` routes, and acceptable here since the worst case is a benign UI overlay. If we later add destructive routes, revisit this with a shared-secret header.

## Lifecycle

- The bridge starts during app init (`initialization.ts:164`) and stops on shutdown (`initialization.ts:403`). The new routes inherit this lifecycle for free.
- The `GET_CURRENT` IPC handler is registered alongside the file-city image handlers in `initialization.ts` via `registerSequenceDiagramHandlers()`.
- Payloads are kept in memory only. Closing the app, or `DELETE /api/file-city/sequence`, drops the state.
- Re-opening the File City panel after a payload was set: the hook calls `mainProcess.fileCitySequence.getCurrent(repositoryPath)` on mount, which round-trips through IPC to the same store the HTTP routes write to.

## Open Questions

1. **Auth.** Localhost-only is the current bar across the bridge. Add a shared-secret header before exposing destructive routes (not blocking for this feature).
2. **Multi-payload.** Latest-wins is simplest. If we later want to compare flows, we'd add a stack/list and a selector in the drawer chrome.
3. **Panel-not-mounted handling.** If the payload arrives before the user opens the File City panel, we currently store it and rehydrate on mount. Confirm that's the desired UX vs. surfacing a notification that says "a sequence diagram is waiting."
4. **Building-not-found.** Decide whether to surface a subtle indicator on the diagram node when `sourcePath` doesn't resolve, or to silently skip the highlight.

## Status

Phase 1 (HTTP route → bottom drawer + city highlight):

- [x] Shared types + IPC event enum (`PAYLOAD_SET`, `PAYLOAD_CLEARED`, `GET_CURRENT`) and `FileCitySequenceAPI` interface in `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`.
- [x] `sequenceDiagramStore.ts` (Map-keyed store + broadcast + `registerSequenceDiagramHandlers`) and `sequenceDiagramRoutes.ts` (`POST/DELETE/GET`) under `src/main/file-city/`.
- [x] Routes mounted in `PrincipalMCPBridge.setupRoutes()`; `registerSequenceDiagramHandlers()` called from `initialization.ts` alongside `registerFileCityImageHandlers()`.
- [x] Renderer surface (`fileCitySequenceApi.ts`) exposed via both preloads as `mainProcess.fileCitySequence`; added to `MainProcessAPI` and `DevWorkspaceMainProcessAPI`.
- [x] `useSequenceDiagram` hook + `SequenceDiagramOverlay` component under `file-city-panel/`.
- [x] `FileCityExplorer` takes a `sequenceSelection` prop and appends a `sequence-selection` highlight layer; `FileCityPanel` mounts the overlay and threads selection down.

Phase 3 (diff snippets for review walkthroughs):

- [x] `PierreSnippetDiffView` renders a windowed diff of two strings via `parseDiffFromFile` + `<FileDiff>`, mirroring the `background` / window / focus-line API of `PierreSnippetView`.
- [ ] `SequenceEventSnippet` extended to a `SliceSnippet | DiffSnippet` discriminated union in `FileCitySequenceAPI.ts`; HTTP route `validateSnippet` updated to accept both shapes.
- [ ] `SequenceEventDetailOverlay` switches on `snippet.kind` and mounts the matching wrapper; for `kind: 'diff'` with no `newContents`, falls back to reading `event.sourcePath` for the new side.

Phase 2 (snippet drawer + leader line):

- [x] `SequenceEventSnippet` + `FileCitySequenceEventDef` added to the shared types; `validateSnippet` enforces shape + `sourcePath` requirement in `sequenceDiagramRoutes.ts`.
- [x] `PierreSnippetView` renders sliced file contents through `<File>` from `@pierre/diffs/react` with a "Lines X–Y" header and `selectedLines` for focus.
- [x] `SequenceEventDetailOverlay` mounts as a right-edge drawer with header, metadata strip, snippet body, Esc-to-close, and an Open-in-tab button that hands off to the existing `file:open` flow.
- [x] `SequenceLeaderLine` projects the building's footprint center through the live three.js camera each frame and writes SVG attributes imperatively. Anchors at `y = 0`, subtracts `cityCenter`, and adds the canvas-element inset offset.
- [x] `FileCityExplorer` accepts an `onCameraFrame` prop (forwarded to `FileCity3D`) and a `hideFolderPanels` prop (forces `elevatedScopePanels` to `undefined` so the diagram + leader line are the only floating structure).
- [x] `FileCityPanel` resolves the selected event, locates the matching `CityBuilding`, computes `cityCenter` from `cityData.bounds`, and threads the building + targets into `SequenceLeaderLine`.

### Manual test

```bash
# Confirm dev bridge is alive
curl -s http://localhost:3054/health

# Push a payload (events can include `snippet: { startLine, endLine, focusLine?, contextLines? }`)
curl -XPOST http://localhost:3054/api/file-city/sequence \
  -H 'content-type: application/json' \
  -d @sample-flow.json

# Open the File City panel for the matching repo, click events, confirm:
#   1. The cyan fill follows your selection on the matching building.
#   2. A right-edge drawer slides in with the Pierre snippet view.
#   3. A dashed leader line connects the building → drawer and tracks
#      pan/zoom/rotate.
#   4. Folder panels are hidden while the diagram is mounted.

# Clear
curl -XDELETE 'http://localhost:3054/api/file-city/sequence?repositoryPath=/path/to/repo'
```

#### Sample event with a slice snippet

```json
{
  "id": "click",
  "name": "interaction.building.click",
  "label": "User clicks building",
  "participant": "FileCityExplorer",
  "sourcePath": "packages/react/src/components/FileCityExplorer/FileCityExplorer.tsx",
  "snippet": { "startLine": 599, "endLine": 605, "focusLine": 600 }
}
```

#### Sample event with a diff snippet

```json
{
  "id": "review-1",
  "name": "review.useAuth.login",
  "label": "useAuth.login() — error handling",
  "participant": "auth",
  "sourcePath": "src/hooks/useAuth.ts",
  "snippet": {
    "kind": "diff",
    "oldContents": "export function login(email, password) {\n  return fetch('/api/login', ...);\n}\n",
    "newContents": "export async function login(email, password) {\n  const res = await fetch('/api/login', ...);\n  if (!res.ok) throw new Error('login failed');\n  return res.json();\n}\n",
    "diffStyle": "unified",
    "focusLine": 4
  }
}
```
