/**
 * Alexandria-side mount of the trail explorer panel.
 *
 * Receives a `trailPayload` + `repositoryPath` from the layout, fetches the
 * fileTree + lineCounts for that repo, and hands the upstream
 * `FileCityTrailExplorerPanel` everything it needs. Designed for the
 * singleton 'file-city-trail' tab: when the user clicks a different trail,
 * the same tab re-renders with the new payload and re-fetches slices.
 *
 * Diverges from the dev-workspace wrapper (`FileCityTrailPanel`) by not
 * depending on `RepositoryPanelProvider` — Alexandria isn't repo-scoped,
 * so slices are fetched here per active trail.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCityTrailExplorerPanel,
  type BaseTrailIndexEntry,
  type FileCityTrailExplorerPanelActions,
  type FileCityTrailExplorerPanelContext,
  type FileCityTrailExplorerRepository,
  type LineCountsSliceData,
  type TrailNote,
  type TrailPayload,
} from '@industry-theme/file-city-panel';
import type {
  DataSlice,
  PanelContextValue,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';

import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { TrailNotesService } from '../../services/TrailNotesService';
import { ShareTrailModal } from '../../dev-workspace/trails-panel/ShareTrailModal';

interface FileCityTrailTabContentProps {
  trailPayload: TrailPayload | null;
  repositoryPath?: string;
  /** Renderer event bus from PanelProvider — used for `file:open` emits. */
  events: PanelEventEmitter;
  /**
   * Called when the user clicks "close trail" inside the explorer's brief.
   * The layout flips `trailPayload` to null so the tab re-enters its idle
   * state (the upstream panel falls back to host-supplied highlight layers,
   * none of which we provide — so the panel shows its empty/idle UI).
   */
  onCloseTrail?: () => void;
  /**
   * Forwarded to the underlying `FileCityTrailExplorerPanel`. When true and
   * the panel is at mobile width (<768px), the city map stays pinned beneath
   * the brief instead of letting the brief cover the whole panel. Useful for
   * narrow desktop sidepanel mounts (e.g. Alexandria's right panel).
   */
  mobileShowMap?: boolean;
}

const EMPTY_FILE_TREE_ROOT = {
  path: '',
  name: '',
  children: [],
  fileCount: 0,
  totalSize: 0,
  depth: 0,
  relativePath: '',
};

const EMPTY_FILE_TREE: RepoFileTree = {
  sha: '__empty__',
  root: EMPTY_FILE_TREE_ROOT,
  allFiles: [],
  allDirectories: [EMPTY_FILE_TREE_ROOT],
  stats: {
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    maxDepth: 0,
  },
  metadata: {
    id: '__empty__',
    timestamp: new Date(0),
    sourceType: 'empty',
    sourceInfo: {},
  },
};

// Stable noop so every slice's `refresh` shares one function identity across
// renders. Without this, each call to makeSlice minted a fresh closure and any
// upstream effect keyed on slice identity (or on `slice.refresh`) re-ran on
// every fetch tick.
const noopRefresh = async () => {};

const makeSlice = <T,>(name: string, data: T, loading = false): DataSlice<T> => ({
  scope: 'repository',
  name,
  data,
  loading,
  error: null,
  refresh: noopRefresh,
});

export const FileCityTrailTabContent: React.FC<FileCityTrailTabContentProps> = ({
  trailPayload,
  repositoryPath,
  events,
  onCloseTrail,
  mobileShowMap,
}) => {
  const [fileTree, setFileTree] = useState<RepoFileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [lineCounts, setLineCounts] = useState<LineCountsSliceData | null>(null);
  const [lineCountsLoading, setLineCountsLoading] = useState(false);
  // Share-modal state. Opened from the brief card's title-row share icon —
  // the modal owns the actual API call (TrailShareService) and the
  // sharing → success (copy link / open in browser) UX.
  const [shareModalTrail, setShareModalTrail] =
    useState<BaseTrailIndexEntry | null>(null);

  // Optimistic notes override. The upstream panel renders notes purely from
  // `trail.notes` — it does no local merging — and our IPC note handlers
  // persist to disk without re-broadcasting PAYLOAD_SET, so a freshly added
  // note never makes it back into the prop. We mirror the writes here so
  // create/update/delete are visible immediately. Keyed by trail id so a
  // different trail loading clears the override; null means "no overrides,
  // use prop's notes as-is".
  const [notesOverride, setNotesOverride] = useState<{
    trailId: string;
    notes: TrailNote[];
  } | null>(null);

  useEffect(() => {
    setNotesOverride((prev) =>
      prev && prev.trailId === trailPayload?.id ? prev : null,
    );
  }, [trailPayload?.id]);

  // Re-fetch fileTree + lineCounts when the active trail's repo changes.
  // Repo-agnostic trails (no repositoryPath) skip the fetch and render with
  // empty slices — the explorer still shows the brief + markers, just
  // without file-tree navigation context.
  useEffect(() => {
    let cancelled = false;

    if (!repositoryPath) {
      setFileTree(null);
      setLineCounts(null);
      return;
    }

    setFileTreeLoading(true);
    RepositoryMonitoringService.getFileTree(repositoryPath)
      .then((tree) => {
        if (cancelled) return;
        setFileTree(tree ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(
          '[FileCityTrailTabContent] getFileTree failed',
          err,
        );
        setFileTree(null);
      })
      .finally(() => {
        if (!cancelled) setFileTreeLoading(false);
      });

    setLineCountsLoading(true);
    const fileCityApi = window.mainProcess?.fileCityImage;
    const lineCountsPromise = fileCityApi
      ? fileCityApi.countLines(repositoryPath)
      : Promise.resolve(null);
    lineCountsPromise
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setLineCounts(null);
          return;
        }
        // Mirror RepositoryPanelContext: strip the repo-name prefix so paths
        // are relative to the repo root (the panel keys file metrics by
        // relative path).
        const repoName = repositoryPath.split('/').pop() || '';
        const normalized: Record<string, number> = {};
        for (const [filePath, count] of Object.entries(raw)) {
          if (typeof count !== 'number' || count < 0) continue;
          if (filePath.startsWith(`${repoName}/`)) {
            normalized[filePath.slice(repoName.length + 1)] = count;
          } else {
            normalized[filePath] = count;
          }
        }
        setLineCounts({ lineCounts: normalized, status: 'available' });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(
          '[FileCityTrailTabContent] countLines failed',
          err,
        );
        setLineCounts(null);
      })
      .finally(() => {
        if (!cancelled) setLineCountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repositoryPath]);

  const repository = useMemo<FileCityTrailExplorerRepository | null>(() => {
    if (!repositoryPath) return null;
    const name = repositoryPath.split('/').pop() || repositoryPath;
    return {
      id: name,
      path: repositoryPath,
      owner: null,
      name,
    };
  }, [repositoryPath]);

  // Per-slice memos so unrelated state changes don't churn every slice's
  // identity. The dev-workspace wrapper (FileCityTrailPanel.tsx) is structured
  // this way for the same reason — co-mingling all slices inside one memo was
  // causing the snippet drawer to remount whenever fileTree/lineCounts loaded.
  const fileTreeSlice = useMemo(
    () => makeSlice('fileTree', fileTree ?? EMPTY_FILE_TREE, fileTreeLoading),
    [fileTree, fileTreeLoading],
  );
  const lineCountsSlice = useMemo(
    () => makeSlice('lineCounts', lineCounts, lineCountsLoading),
    [lineCounts, lineCountsLoading],
  );
  const effectiveTrail = useMemo<TrailPayload | null>(() => {
    if (!trailPayload) return null;
    if (!notesOverride || notesOverride.trailId !== trailPayload.id) {
      return trailPayload;
    }
    return { ...trailPayload, notes: notesOverride.notes };
  }, [trailPayload, notesOverride]);

  const trailSlice = useMemo(
    () => makeSlice('trail', effectiveTrail),
    [effectiveTrail],
  );
  const highlightLayersSlice = useMemo(
    () => makeSlice('highlightLayers', null),
    [],
  );

  const baseContext = useMemo<PanelContextValue>(() => {
    const repoMeta = repositoryPath
      ? { name: repositoryPath.split('/').pop() || repositoryPath, path: repositoryPath }
      : undefined;
    return {
      currentScope: repoMeta
        ? { type: 'repository', repository: repoMeta }
        : { type: 'workspace' },
      refresh: noopRefresh,
    };
  }, [repositoryPath]);

  const trailContext = useMemo(
    () =>
      ({
        ...baseContext,
        fileTree: fileTreeSlice,
        lineCounts: lineCountsSlice,
        trail: trailSlice,
        highlightLayers: highlightLayersSlice,
        repository,
      }) as PanelContextValue & FileCityTrailExplorerPanelContext,
    [
      baseContext,
      fileTreeSlice,
      lineCountsSlice,
      trailSlice,
      highlightLayersSlice,
      repository,
    ],
  );

  const trailActions = useMemo<FileCityTrailExplorerPanelActions>(
    () => ({
      openFile: (filePath, line) => {
        const absolute = filePath.startsWith('/')
          ? filePath
          : repositoryPath
            ? `${repositoryPath}/${filePath}`
            : filePath;
        events.emit({
          type: 'file:open',
          source: 'alexandria-file-city-trail-tab',
          timestamp: Date.now(),
          payload: { path: absolute, line },
        });
      },
      readFile: async (path: string): Promise<string> => {
        const absolute = path.startsWith('/')
          ? path
          : repositoryPath
            ? `${repositoryPath}/${path}`
            : path;
        const api = window.mainProcess?.fileSystem;
        if (!api) throw new Error('FileSystem API unavailable');
        const result = await api.readFile(absolute);
        if (!result) throw new Error(`File not found: ${path}`);
        return result.content;
      },
      createTrailNote: async (payloadId, draft) => {
        const note = await TrailNotesService.create(payloadId, draft);
        if (note) {
          setNotesOverride((prev) => {
            const base =
              prev && prev.trailId === payloadId
                ? prev.notes
                : (trailPayload?.notes ?? []);
            return { trailId: payloadId, notes: [...base, note] };
          });
        }
        return note;
      },
      updateTrailNote: async (payloadId, noteId, body) => {
        const note = await TrailNotesService.update(payloadId, noteId, body);
        if (note) {
          setNotesOverride((prev) => {
            const base =
              prev && prev.trailId === payloadId
                ? prev.notes
                : (trailPayload?.notes ?? []);
            return {
              trailId: payloadId,
              notes: base.map((n) => (n.id === noteId ? note : n)),
            };
          });
        }
        return note;
      },
      deleteTrailNote: async (payloadId, noteId) => {
        await TrailNotesService.remove(payloadId, noteId);
        setNotesOverride((prev) => {
          const base =
            prev && prev.trailId === payloadId
              ? prev.notes
              : (trailPayload?.notes ?? []);
          return {
            trailId: payloadId,
            notes: base.filter((n) => n.id !== noteId),
          };
        });
      },
      // Sign-off persistence isn't wired in the Electron host (matches the
      // dev-workspace wrapper). The LGTM button animates optimistically but
      // the stamp won't round-trip.
      createTrailSignOff: async () => null,
      deleteTrailSignOff: async () => {},
      closeTrail: onCloseTrail,
      // The brief card's share icon calls this; we synthesize a minimal
      // `BaseTrailIndexEntry` from the live payload (the modal only reads
      // id/title/markerCount/hasDiffSnippets) so we can open the modal
      // without a `TrailLibraryService.list` round trip. The modal then
      // runs `TrailShareService.share` and handles the copy/open-in-
      // browser UX itself.
      shareTrail: () => {
        if (!trailPayload) return;
        const entry: BaseTrailIndexEntry = {
          id: trailPayload.id,
          title: trailPayload.title || 'Untitled trail',
          summaryPreview: (trailPayload.summary ?? '').slice(0, 200),
          markerCount: trailPayload.markers?.length ?? 0,
          repoNames: trailPayload.repos?.map((r) => r.name) ?? [],
          hasDiffSnippets:
            trailPayload.markers?.some(
              (m) => m.snippet?.kind === 'diff',
            ) ?? false,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          sizeBytes: 0,
        };
        setShareModalTrail(entry);
      },
    }),
    [repositoryPath, events, onCloseTrail, trailPayload],
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FileCityTrailExplorerPanel
        context={trailContext}
        actions={trailActions}
        events={events}
        briefLayout="split"
        mobileShowMap={mobileShowMap}
        // Single local user: notes are authored 'You', so the panel's note
        // Edit/Delete (gated on note.author === currentAuthor since 0.5.152)
        // need a matching currentAuthor. Harmless on 0.5.151 (its old default).
        currentAuthor="You"
      />
      {shareModalTrail && repositoryPath && (
        <ShareTrailModal
          trail={shareModalTrail}
          repositoryPath={repositoryPath}
          onClose={() => setShareModalTrail(null)}
        />
      )}
    </div>
  );
};
