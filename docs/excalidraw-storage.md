# Excalidraw drawings storage

Drawings created in the Drawings view are plain Excalidraw scene files in one
global, repo-free folder:

```
~/.alexandria/drawings/<id>.excalidraw
```

- `<id>` is the file name without the extension. New drawings get a
  `crypto.randomUUID()` id on first save; older drawings may use a timestamp.
  Unsaved drawings use a temporary `new-<uuid>` id that is replaced on save.
- The display name is `appState.name` inside the file, not the file name.
- There is no index file; the Drawings list scans the folder and sorts by
  modification time.

## Code

- Path conventions, folder scan, and single-drawing lookup:
  [`src/renderer/drawings-view/drawingsStorage.ts`](../src/renderer/drawings-view/drawingsStorage.ts)
  (`resolveDrawingsDir`, `diagramPath`, `scanDrawings`, `getDrawingSummary`).
- List panel: [`DrawingsLeftPanel.tsx`](../src/renderer/drawings-view/DrawingsLeftPanel.tsx).
- Canvas tab and saving: [`DrawingTabContent.tsx`](../src/renderer/drawings-view/DrawingTabContent.tsx).
- Open/save/delete tab glue: [`useDrawingsHost.tsx`](../src/renderer/drawings-view/useDrawingsHost.tsx).

Reads and writes go through the renderer's `FileSystemService`; there is no
drawings-specific IPC API.

## Topic references

Topics can attach a drawing with `{ kind: "drawing", drawingId: "<id>" }` in
`references` (type from `@principal-ai/subsystems-core`). The topic stores only
the id. `TopicReferencesRail` resolves the file and name when shown, marks a
deleted drawing as not found, and opens it in a drawing tab where the host
supports drawing tabs. `POST /api/topics` rejects drawing ids that are not a
single file-name segment.
