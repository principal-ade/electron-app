import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExcalidrawWrapper } from '@industry-theme/excalidraw-panels';
// Excalidraw's own styles (not auto-injected by the panel package).
import '@excalidraw/excalidraw/index.css';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { useFileWatch } from '../../hooks/useFileWatch';
import { getDrawingSummary } from '../../drawings-view/drawingsStorage';

type WrapperData = React.ComponentProps<
  typeof ExcalidrawWrapper
>['initialData'];

type WrapperElements = Parameters<
  NonNullable<React.ComponentProps<typeof ExcalidrawWrapper>['onChange']>
>[0];

type WrapperElement = WrapperElements[number];

/** A drawing element the user clicked, reduced to what a chat reference needs. */
export interface DrawingSelectedElement {
  id: string;
  type: string;
  text?: string;
}

export interface DrawingElementSelection {
  elements: DrawingSelectedElement[];
}

/** Resolve an element's readable text, following bound text on containers. */
function elementText(
  element: WrapperElement,
  byId: Map<string, WrapperElement>,
): string | undefined {
  if (
    'text' in element &&
    typeof element.text === 'string' &&
    element.text.trim()
  ) {
    return element.text.trim();
  }
  const bound =
    'boundElements' in element && Array.isArray(element.boundElements)
      ? element.boundElements
      : undefined;
  for (const ref of bound ?? []) {
    if (!ref || ref.type !== 'text') continue;
    const child = byId.get(ref.id);
    if (
      child &&
      'text' in child &&
      typeof child.text === 'string' &&
      child.text.trim()
    ) {
      return child.text.trim();
    }
  }
  return undefined;
}

interface LoadedDrawing {
  name: string;
  path: string;
  data: WrapperData;
}

/**
 * Read-only Excalidraw preview for the ACP Artifacts view. Loads the drawing
 * by id (like `getDrawingSummary` for topic attachments) and reloads when the
 * file changes on disk, so an agent editing the drawing is visible live.
 *
 * The canvas is interactive (not view-mode) so pieces are clickable: the
 * selection is reported via `onElementSelect` for chat references. Nothing
 * persists — no save handler is wired, the Drawings tab owns edits, and a
 * remount restores the file scene.
 */
export function ACPDrawingPreview({
  drawingId,
  onElementSelect,
}: {
  drawingId: string;
  onElementSelect?: (selection: DrawingElementSelection | null) => void;
}) {
  const { theme } = useTheme();
  const [scene, setScene] = useState<LoadedDrawing | null>(null);
  // Bumped when the file changes on disk; part of the wrapper key so
  // Excalidraw remounts with the new scene (it only reads initialData on mount).
  const [diskRevision, setDiskRevision] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const summary = await getDrawingSummary(drawingId);
      if (!summary) {
        setFailed(true);
        return;
      }
      const res = await FileSystemService.readFile(summary.path);
      const data = res?.content
        ? (JSON.parse(res.content) as WrapperData)
        : undefined;
      setScene({ name: summary.name, path: summary.path, data });
    } catch {
      setFailed(true);
    }
  }, [drawingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadFromDisk = useCallback(() => {
    void load().then(() => setDiskRevision((revision) => revision + 1));
  }, [load]);
  useFileWatch(scene?.path ?? null, reloadFromDisk, {
    enabled: scene?.path !== undefined,
  });

  // Report the clicked pieces for chat references. Excalidraw fires onChange
  // on selection changes; clearing the canvas selection reports null (the view
  // keeps the last attached reference, like model trail focus).
  const selectionKeyRef = useRef<string | null>(null);
  const handleChange = useCallback(
    (
      _elements: WrapperElements,
      appState?: { selectedElementIds?: Record<string, boolean> },
    ) => {
      if (!onElementSelect) return;
      const selected = appState?.selectedElementIds ?? {};
      const ids = Object.keys(selected).filter((id) => selected[id]);
      const key = `${drawingId}:${ids.join(',')}`;
      if (selectionKeyRef.current === key) return;
      selectionKeyRef.current = key;
      if (ids.length === 0) {
        onElementSelect(null);
        return;
      }
      const byId = new Map<string, WrapperElement>();
      for (const element of _elements) byId.set(element.id, element);
      onElementSelect({
        elements: ids.flatMap((id) => {
          const element = byId.get(id);
          if (!element) return [];
          const text = elementText(element, byId);
          return [
            {
              id: element.id,
              type: element.type,
              ...(text ? { text } : {}),
            },
          ];
        }),
      });
    },
    [drawingId, onElementSelect],
  );

  if (failed || (scene && !scene.data)) {
    return (
      <div
        role="alert"
        style={{
          display: 'grid',
          height: '100%',
          placeItems: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        Couldn’t load this drawing.
      </div>
    );
  }

  if (!scene) {
    return (
      <div
        role="status"
        style={{
          display: 'grid',
          height: '100%',
          placeItems: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        Loading drawing…
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <ExcalidrawWrapper
        key={`${scene.path}:${diskRevision}`}
        diagramName={scene.name}
        initialData={scene.data}
        onChange={handleChange}
      />
    </div>
  );
}
