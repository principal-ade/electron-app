/**
 * drawingsStorage — shared filesystem helpers for the Drawings workspace surface.
 *
 * Drawings are repo-free `.excalidraw` (JSON) files under one global directory
 * (`~/.alexandria/drawings`). Both the left-panel list (`DrawingsLeftPanel`) and
 * the canvas tab (`DrawingTabContent`) read/write through here so the scan +
 * path conventions live in one place. Extracted from the former `DrawingsView`
 * overlay when Drawings folded into the persistent `WorkspaceShell`.
 */
import { FileSystemService } from '../main-process-api/FileSystemService';

/** Sub-path under the home directory where drawings live. */
export const DRAWINGS_SUBDIR = '.alexandria/drawings';

/**
 * Drawings list↔canvas↔host events. All flow on the shell's LOCAL bus (the
 * surface is self-contained — no external openers, and the canvas/list need to
 * stay in sync). The host (`useDrawingsHost`) is the only writer to the tab
 * bucket.
 */
export const DRAWING_EVENTS = {
  /** Left-panel row / New → open (or focus) a drawing tab. */
  open: 'drawing:open',
  /** Canvas → a drawing was persisted (update the tab + rescan the list). */
  saved: 'drawing:saved',
  /** Left-panel trash → delete the file + close the tab. */
  deleteRequested: 'drawing:delete-requested',
  /** Host → a drawing was deleted (rescan the list). */
  deleted: 'drawing:deleted',
} as const;

export interface DrawingOpenPayload {
  drawingId: string;
  path?: string;
  name: string;
}
export interface DrawingSavedPayload {
  tabId: string;
  drawingId: string;
  path: string;
  name: string;
}
export interface DrawingDeleteRequestedPayload {
  drawingId: string;
  path: string;
  name: string;
}
export interface DrawingDeletedPayload {
  drawingId: string;
}

/** A drawing on disk, as shown in the list. */
export interface DrawingItem {
  /** File name without extension. */
  id: string;
  /** Human name from `appState.name`, falling back to the id. */
  name: string;
  /** Absolute path to the `.excalidraw` file. */
  path: string;
  lastModified?: Date;
}

/** Resolve the global drawings root (`~/.alexandria/drawings`), or null. */
export async function resolveDrawingsDir(): Promise<string | null> {
  try {
    const home = await FileSystemService.getHomePath();
    return home ? `${home}/${DRAWINGS_SUBDIR}` : null;
  } catch (err) {
    console.error('[drawingsStorage] Failed to resolve home path:', err);
    return null;
  }
}

/** Absolute `.excalidraw` path for a drawing id under `dir`. */
export function diagramPath(dir: string, id: string): string {
  return `${dir}/${id}.excalidraw`;
}

/** Scan the drawings directory and read each file's display name + mtime. */
export async function scanDrawings(dir: string): Promise<DrawingItem[]> {
  const names = await FileSystemService.readDirectory(dir);
  const files = names.filter((n) => n.endsWith('.excalidraw'));
  const items = await Promise.all(
    files.map(async (fileName): Promise<DrawingItem> => {
      const id = fileName.replace(/\.excalidraw$/, '');
      const path = `${dir}/${fileName}`;
      let name = id;
      let lastModified: Date | undefined;
      try {
        const res = await FileSystemService.readFile(path);
        if (res?.content) {
          const parsed = JSON.parse(res.content);
          if (parsed?.appState?.name) name = parsed.appState.name;
        }
      } catch {
        // unreadable/corrupt file — fall back to the id as the name
      }
      try {
        const stats = await FileSystemService.getFileStats(path);
        if (stats?.lastModified) lastModified = new Date(stats.lastModified);
      } catch {
        // best-effort mtime
      }
      return { id, name, path, lastModified };
    }),
  );
  items.sort(
    (a, b) =>
      (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
  );
  return items;
}

/** Next "Draft #N" number for unnamed new drawings. */
export async function nextDraftNumber(dir: string): Promise<number> {
  try {
    const items = await scanDrawings(dir);
    const nums = items
      .map((d) => /^Draft #(\d+)$/.exec(d.name)?.[1])
      .filter(Boolean)
      .map((n) => parseInt(n as string, 10));
    return nums.length ? Math.max(...nums) + 1 : 1;
  } catch {
    return 1;
  }
}
