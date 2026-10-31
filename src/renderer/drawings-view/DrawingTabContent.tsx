/**
 * DrawingTabContent
 *
 * The Excalidraw canvas for one drawing, rendered as a tab in `WorkspaceShell`.
 * Self-loads its `.excalidraw` file by path (once, on mount) and owns save —
 * mirroring the editor half of the former `DrawingsView` overlay, including the
 * deliberate use of the lower-level `ExcalidrawWrapper` (the package's
 * `ExcalidrawPanel` infinite-renders; `ExcalidrawWrapper` is loop-free).
 *
 * On save it writes the file and emits `drawing:saved` on the local bus so the
 * host can rewrite this tab's `drawingId`/`path`/label (a brand-new drawing's
 * `new-<uuid>` id becomes the real file id) and the list can rescan.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExcalidrawWrapper } from '@industry-theme/excalidraw-panels';
// Excalidraw's own styles (not auto-injected by the panel package).
import '@excalidraw/excalidraw/index.css';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { useFileWatch } from '../hooks/useFileWatch';
import {
  DRAWING_EVENTS,
  diagramPath,
  nextDraftNumber,
  resolveDrawingsDir,
  type DrawingSavedPayload,
} from './drawingsStorage';

type WrapperData = React.ComponentProps<
  typeof ExcalidrawWrapper
>['initialData'];

/** What's loaded into the editor. `id: null` is an unsaved new drawing. */
interface ActiveDrawing {
  id: string | null;
  name: string;
  initialData: unknown | null;
}

export interface DrawingTabContentProps {
  /** The owning tab's id (echoed back in `drawing:saved` so the host finds it). */
  tabId: string;
  /** File id, or a `new-<uuid>` sentinel for an unsaved new drawing. */
  drawingId: string;
  /** Absolute `.excalidraw` path; undefined for an unsaved new drawing. */
  path?: string;
  name: string;
  /** Shell-local event bus. */
  events: PanelEventEmitter;
}

export const DrawingTabContent: React.FC<DrawingTabContentProps> = ({
  tabId,
  drawingId,
  path,
  name,
  events,
}) => {
  const { theme } = useTheme();

  const [dir, setDir] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveDrawing | null>(null);
  // Bumped when the file changes on disk behind us; part of the wrapper key so
  // Excalidraw remounts with the new scene (it only reads initialData on mount).
  const [diskRevision, setDiskRevision] = useState(0);
  // Serialized payload of our own last save, so the watcher can tell an
  // external edit from the echo of a write we just made.
  const lastWrittenRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  // Capture the initial identity so the load effect runs exactly once — the
  // host rewrites our `drawingId`/`path` props after a new drawing's first save,
  // and we must NOT reload (it would clobber the live canvas).
  const initialRef = useRef({ drawingId, path, name });

  useEffect(() => {
    let cancelled = false;
    void resolveDrawingsDir().then((d) => {
      if (!cancelled) setDir(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { drawingId: id0, path: path0, name: name0 } = initialRef.current;
    (async () => {
      if (path0) {
        try {
          const res = await FileSystemService.readFile(path0);
          const data = res?.content ? JSON.parse(res.content) : null;
          if (!cancelled)
            setActive({ id: id0, name: name0, initialData: data });
        } catch (err) {
          console.error('[DrawingTabContent] Failed to load drawing:', err);
          if (!cancelled)
            setActive({ id: id0, name: name0, initialData: null });
        }
      } else {
        // Unsaved new drawing — blank canvas, no persisted id yet.
        if (!cancelled) setActive({ id: null, name: name0, initialData: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(
    async (
      saveName: string,
      data: unknown,
      existingId?: string,
    ): Promise<string> => {
      if (!dir) throw new Error('Drawings directory not ready');
      const id = existingId || (crypto.randomUUID?.() ?? `${Date.now()}`);
      const payload = {
        ...(data as Record<string, unknown>),
        appState: {
          ...((data as { appState?: Record<string, unknown> })?.appState ?? {}),
          name: saveName,
        },
      };
      const serialized = JSON.stringify(payload, null, 2);
      savingRef.current = true;
      let res: Awaited<ReturnType<typeof FileSystemService.writeFile>>;
      try {
        res = await FileSystemService.writeFile(
          diagramPath(dir, id),
          serialized,
        );
      } finally {
        savingRef.current = false;
      }
      if (!res || !res.success) {
        throw new Error(res?.error || `Failed to save drawing: ${id}`);
      }
      lastWrittenRef.current = serialized;
      setActive((prev) => (prev ? { ...prev, id, name: saveName } : prev));
      events.emit<DrawingSavedPayload>({
        type: DRAWING_EVENTS.saved,
        source: 'drawing-tab',
        timestamp: Date.now(),
        payload: {
          tabId,
          drawingId: id,
          path: diagramPath(dir, id),
          name: saveName,
        },
      });
      return id;
    },
    [dir, events, tabId],
  );

  // Watch the saved file (a new drawing has none until its first save). An
  // external edit replaces the scene outright, discarding unsaved strokes; the
  // tab owns writes, so this is the rough "agent rewrote the drawing" path.
  const watchPath =
    dir && active?.id
      ? diagramPath(dir, active.id)
      : (initialRef.current.path ?? null);
  const reloadFromDisk = useCallback(async () => {
    if (!watchPath) return;
    try {
      const res = await FileSystemService.readFile(watchPath);
      if (!res?.content || res.content === lastWrittenRef.current) return;
      const data = JSON.parse(res.content);
      setActive((prev) => (prev ? { ...prev, initialData: data } : prev));
      setDiskRevision((r) => r + 1);
    } catch (err) {
      console.error('[DrawingTabContent] Failed to reload drawing:', err);
    }
  }, [watchPath]);
  const skipReloadWhen = useCallback(() => savingRef.current, []);
  useFileWatch(watchPath, reloadFromDisk, {
    enabled: !!watchPath,
    skipReloadWhen,
  });

  const getNextDraftNumber = useCallback(
    () => (dir ? nextDraftNumber(dir) : Promise.resolve(1)),
    [dir],
  );

  if (!active) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
        }}
      >
        Loading drawing…
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <ExcalidrawWrapper
        key={`${active.id ?? 'new'}:${diskRevision}`}
        diagramId={active.id ?? undefined}
        diagramName={active.name}
        initialData={(active.initialData as WrapperData) ?? undefined}
        onSave={handleSave}
        onDiagramCreated={(id) =>
          setActive((prev) => (prev ? { ...prev, id } : prev))
        }
        onDiagramNameChange={(name) =>
          setActive((prev) => (prev ? { ...prev, name } : prev))
        }
        getNextDraftNumber={getNextDraftNumber}
        showSaveButton
      />
    </div>
  );
};

export default DrawingTabContent;
