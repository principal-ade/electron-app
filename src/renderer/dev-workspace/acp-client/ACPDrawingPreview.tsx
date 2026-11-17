import React, { useCallback, useEffect, useState } from 'react';
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

interface LoadedDrawing {
  name: string;
  path: string;
  data: WrapperData;
}

/**
 * Read-only Excalidraw preview for the ACP Artifacts view. Loads the drawing
 * by id (like `getDrawingSummary` for topic attachments) and reloads when the
 * file changes on disk, so an agent editing the drawing is visible live. Never
 * writes: the Drawings tab owns edits.
 */
export function ACPDrawingPreview({ drawingId }: { drawingId: string }) {
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
        readOnly
      />
    </div>
  );
}
