# Excalidraw drawings storage

Summary

Excalidraw drawings created in the Planning view are saved to the application's Electron user data directory under a dedicated storage folder.

Storage location

- Base directory: [`path.join(app.getPath('userData'), 'excalidraw-files')`](src/main/drawings/excalidrawHandlers.ts:16)
- Index file: [`index.json`](src/main/drawings/excalidrawHandlers.ts:17) at the base directory; used to track metadata for all diagrams.

Layout and filenames

- Repo-agnostic diagrams: saved as `repo-agnostic/<diagramId>.excalidraw` (`.excalidraw` is JSON) — see [`src/main/drawings/excalidrawHandlers.ts:164`](src/main/drawings/excalidrawHandlers.ts:164).
- Project-specific diagrams: saved in a folder named by the MD5 hash of the project's path (computed by `getProjectHash`) as `<projectHash>/<diagramId>.excalidraw` — see [`src/main/drawings/excalidrawHandlers.ts:160`](src/main/drawings/excalidrawHandlers.ts:160) and [`src/main/drawings/excalidrawHandlers.ts:172`](src/main/drawings/excalidrawHandlers.ts:172).

How diagrams are written

- The main process handler `saveDiagram` serializes the diagram object to disk using `fs.writeJson(...)` to write the `<diagramId>.excalidraw` file — see [`src/main/drawings/excalidrawHandlers.ts:183`](src/main/drawings/excalidrawHandlers.ts:183) and [`src/main/drawings/excalidrawHandlers.ts:188`](src/main/drawings/excalidrawHandlers.ts:188).
- After writing the file, the handler updates the in-memory index and persists it to `index.json` via `saveIndex()` — see [`src/main/drawings/excalidrawHandlers.ts:192`](src/main/drawings/excalidrawHandlers.ts:192) and [`src/main/drawings/excalidrawHandlers.ts:148`](src/main/drawings/excalidrawHandlers.ts:148).

Index and recovery

- `index.json` stores a serializable mapping of diagrams and metadata; it is written with `fs.writeJson` — see [`src/main/drawings/excalidrawHandlers.ts:148`](src/main/drawings/excalidrawHandlers.ts:148).
- If `index.json` is missing or corrupted, the handler attempts to recover by scanning the storage directory for `.excalidraw` files (both repo-agnostic and project folders) and rebuilding the index — see [`src/main/drawings/excalidrawHandlers.ts:32`](src/main/drawings/excalidrawHandlers.ts:32) and [`src/main/drawings/excalidrawHandlers.ts:68`](src/main/drawings/excalidrawHandlers.ts:68).

IPC and renderer integration

- The renderer uses the Excalidraw IPC API (`excalidrawAPI`) to call into the main process for save/load/list/delete/export operations — defined in [`src/window/main-process-api-implementations/excalidrawApi.ts:7`](src/window/main-process-api-implementations/excalidrawApi.ts:7).
- The main process registers handlers for those events via `ipcMain.handle(...)` in [`src/main/drawings/excalidrawHandlers.ts:310`](src/main/drawings/excalidrawHandlers.ts:310).
- The TypeScript interface describing diagrams and the API surface is in [`src/shared/main-process-api-interfaces/ExcalidrawAPI.ts:18`](src/shared/main-process-api-interfaces/ExcalidrawAPI.ts:18).

Export notes

- JSON exports are returned directly by the main process (`exportDiagram` with `format === 'json'`) — see [`src/main/drawings/excalidrawHandlers.ts:282`](src/main/drawings/excalidrawHandlers.ts:282) and [`src/main/drawings/excalidrawHandlers.ts:294`](src/main/drawings/excalidrawHandlers.ts:294).
- PNG/SVG exports are expected to be produced on the renderer side using Excalidraw's export functionality; the main process returns an error for PNG/SVG export attempts — see [`src/main/drawings/excalidrawHandlers.ts:298`](src/main/drawings/excalidrawHandlers.ts:298).

Example (macOS)

- On macOS the effective path is usually: `~/Library/Application Support/<YourApp>/excalidraw-files/` with subfolders `repo-agnostic/` and `<projectHash>/`.

References

- [`src/main/drawings/excalidrawHandlers.ts:16`](src/main/drawings/excalidrawHandlers.ts:16) — storageDir definition.
- [`src/main/drawings/excalidrawHandlers.ts:17`](src/main/drawings/excalidrawHandlers.ts:17) — indexPath definition.
- [`src/main/drawings/excalidrawHandlers.ts:160`](src/main/drawings/excalidrawHandlers.ts:160) — getProjectHash.
- [`src/main/drawings/excalidrawHandlers.ts:164`](src/main/drawings/excalidrawHandlers.ts:164) — repo-agnostic path logic.
- [`src/main/drawings/excalidrawHandlers.ts:172`](src/main/drawings/excalidrawHandlers.ts:172) — project-specific path logic.
- [`src/main/drawings/excalidrawHandlers.ts:183`](src/main/drawings/excalidrawHandlers.ts:183) — saveDiagram signature.
- [`src/main/drawings/excalidrawHandlers.ts:188`](src/main/drawings/excalidrawHandlers.ts:188) — fs.writeJson call.
- [`src/main/drawings/excalidrawHandlers.ts:148`](src/main/drawings/excalidrawHandlers.ts:148) — saveIndex implementation.
- [`src/main/drawings/excalidrawHandlers.ts:68`](src/main/drawings/excalidrawHandlers.ts:68) — recoverIndexFromFiles.
- [`src/window/main-process-api-implementations/excalidrawApi.ts:7`](src/window/main-process-api-implementations/excalidrawApi.ts:7) — IPC event names.
- [`src/main/drawings/excalidrawHandlers.ts:310`](src/main/drawings/excalidrawHandlers.ts:310) — IPC handler registration.
- [`src/shared/main-process-api-interfaces/ExcalidrawAPI.ts:18`](src/shared/main-process-api-interfaces/ExcalidrawAPI.ts:18) — ExcalidrawDiagram type.