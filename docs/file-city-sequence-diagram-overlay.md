# File City Sequence Diagram Overlay

This document describes how to expose an HTTP route on the electron-app that accepts a sequence-diagram payload and renders it as an overlay on top of the File City panel, with click-to-highlight wired to the corresponding building.

The design ports the working prototype at `web-ade/file-city/packages/react/src/stories/SequenceDiagramOverlay.stories.tsx` into the electron-app's `file-city-panel`, driven by an HTTP route on the existing Principal MCP Bridge.

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
- On node click, highlight the corresponding building in the city.
- Allow the overlay to be cleared.

## Non-goals

- Persisting payloads across app restarts.
- Authoring sequence diagrams inside the app.
- Multi-payload stacking (only the latest payload is shown).

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
│  - On node click → derives a HighlightLayer from sourcePath         │
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
| `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts` | Shared types (`SequenceDiagramPayload`, `FileCitySequenceEvent`, `FileCitySequenceAPI`) |
| `src/window/main-process-api-implementations/fileCitySequenceApi.ts` | Renderer-facing API surface (exposed via `mainProcess.fileCitySequence`) |
| `src/renderer/dev-workspace/file-city-panel/SequenceDiagramOverlay.tsx` | The drawer + `<SequenceDiagramRenderer>` mount |
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
  /** Required — events in display order */
  events: SequenceEvent[];   // from @principal-ai/principal-view-react
  /** Required — edges between events */
  edges: SequenceEdge[];
}
```

`SequenceEvent` and `SequenceEdge` are imported verbatim from `@principal-ai/principal-view-react` (defined in `node_modules/@principal-ai/principal-view-react/dist/hooks/useSequenceLayout.d.ts`):

```ts
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
```

**Response:**

```json
{ "success": true, "broadcastTo": 1 }
```

`broadcastTo` is the count of windows that received the IPC message.

**Validation:**

- `events` must be a non-empty array; each must have `id` and `name`.
- `edges[*].fromEvent` and `edges[*].toEvent` must reference event IDs from the payload.
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

### Overlay component

`SequenceDiagramOverlay.tsx` is the prototype's bottom-drawer JSX, prop-driven (`payload`, `selectedEventId`, `onNodeClick`, `onClose`) and absolutely positioned at 50% height of the panel.

Mount inside `FileCityPanel.tsx`, sibling to `<FileCityExplorer>`. The panel resolves `selectedEventId` → `sourcePath` once and passes only that down to the explorer:

```tsx
const sequenceSelection = useMemo(() => {
  if (!sequencePayload || !sequenceSelectedEventId) return null;
  const event = sequencePayload.events.find((e) => e.id === sequenceSelectedEventId);
  if (!event?.sourcePath) return null;
  return { sourcePath: event.sourcePath };
}, [sequencePayload, sequenceSelectedEventId]);

<FileCityExplorer ... sequenceSelection={sequenceSelection} />
{sequencePayload && (
  <SequenceDiagramOverlay
    payload={sequencePayload}
    selectedEventId={sequenceSelectedEventId}
    onNodeClick={setSequenceSelectedEventId}
    onClose={clearSequence}
  />
)}
```

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

Implementation completed in a single pass.

- [x] Shared types + IPC event enum (`PAYLOAD_SET`, `PAYLOAD_CLEARED`, `GET_CURRENT`) and `FileCitySequenceAPI` interface in `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`.
- [x] `sequenceDiagramStore.ts` (Map-keyed store + broadcast + `registerSequenceDiagramHandlers`) and `sequenceDiagramRoutes.ts` (`POST/DELETE/GET`) under `src/main/file-city/`.
- [x] Routes mounted in `PrincipalMCPBridge.setupRoutes()`; `registerSequenceDiagramHandlers()` called from `initialization.ts` alongside `registerFileCityImageHandlers()`.
- [x] Renderer surface (`fileCitySequenceApi.ts`) exposed via both preloads as `mainProcess.fileCitySequence`; added to `MainProcessAPI` and `DevWorkspaceMainProcessAPI`.
- [x] `useSequenceDiagram` hook + `SequenceDiagramOverlay` component under `file-city-panel/`.
- [x] `FileCityExplorer` takes a `sequenceSelection` prop and appends a `sequence-selection` highlight layer; `FileCityPanel` mounts the overlay and threads selection down.

### Manual test

```bash
# Confirm dev bridge is alive
curl -s http://localhost:3054/health

# Push a payload
curl -XPOST http://localhost:3054/api/file-city/sequence \
  -H 'content-type: application/json' \
  -d @sample-flow.json

# Open the File City panel for the matching repo, click events, confirm
# the cyan fill follows your selection.

# Clear
curl -XDELETE 'http://localhost:3054/api/file-city/sequence?repositoryPath=/path/to/repo'
```
