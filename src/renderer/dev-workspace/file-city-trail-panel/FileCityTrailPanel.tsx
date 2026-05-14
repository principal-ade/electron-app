/**
 * Panel mount for the trail medium. Wraps the upstream
 * `FileCityTrailExplorerPanel` from `@industry-theme/file-city-panel` and
 * supplies the required context (fileTree, lineCounts, trail, repository)
 * + actions (openFile, readFile, trail-note CRUD).
 *
 * The trail explorer renders sequence-view trails today; non-sequence
 * views are scaffolded in the schema but not yet implemented.
 */

import React from 'react';
import {
  FileCityTrailExplorerPanel,
  type FileCityTrailExplorerPanelActions,
  type FileCityTrailExplorerPanelContext,
  type FileCityTrailExplorerRepository,
  type LineCountsSliceData,
} from '@industry-theme/file-city-panel';
import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';
import type { TrailPayload } from '@industry-theme/file-city-panel';

import { TrailNotesService } from '../../services/TrailNotesService';

interface FileCityTrailPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  lineCounts?: DataSlice<LineCountsSliceData | null>;
  trail?: DataSlice<TrailPayload | null>;
  repository?: {
    path?: string | null;
    name?: string | null;
    owner?: string | null;
  } | null;
}

export interface FileCityTrailPanelProps {
  context: FileCityTrailPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
  /**
   * Wire the upstream `FileCityTrailExplorerPanelActions.closeTrail` to a
   * host-side "deselect the active trail" handler. When provided, the
   * trail footer renders a close button that calls this; the host is
   * expected to flip `context.trail.data` to `null` in response.
   */
  onCloseTrail?: () => void;
}

const emptyRoot = {
  path: '',
  name: '',
  children: [],
  fileCount: 0,
  totalSize: 0,
  depth: 0,
  relativePath: '',
};

const emptyFileTree: RepoFileTree = {
  sha: '__empty__',
  root: emptyRoot,
  allFiles: [],
  allDirectories: [emptyRoot],
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

const emptySlice = <T,>(scope: 'repository', name: string, data: T): DataSlice<T> => ({
  scope,
  name,
  data,
  loading: false,
  error: null,
  refresh: async () => {},
});

export const FileCityTrailPanel: React.FC<FileCityTrailPanelProps> = ({
  context,
  events,
  onCloseTrail,
}) => {
  const repositoryPath = context.repository?.path ?? null;
  const repoOwner = context.repository?.owner ?? null;
  const repoName = context.repository?.name ?? null;

  // ---- repository identifier (trail panel-private) ------------------------
  const repository = React.useMemo<FileCityTrailExplorerRepository | null>(() => {
    if (!repositoryPath && !repoName) return null;
    const id = repoName || repositoryPath || 'unknown';
    return {
      id,
      path: repositoryPath ?? null,
      owner: repoOwner ?? null,
      name: repoName ?? null,
    };
  }, [repositoryPath, repoOwner, repoName]);

  // ---- slices -------------------------------------------------------------
  const fileTreeSlice = React.useMemo<DataSlice<RepoFileTree>>(() => {
    const tree = context.fileTree?.data ?? null;
    return emptySlice('repository', 'fileTree', tree ?? emptyFileTree);
  }, [context.fileTree]);

  const lineCountsSlice = React.useMemo<DataSlice<LineCountsSliceData | null>>(
    () =>
      context.lineCounts ??
      emptySlice('repository', 'lineCounts', null),
    [context.lineCounts],
  );

  const trailSlice = React.useMemo<DataSlice<TrailPayload | null>>(
    () => context.trail ?? emptySlice('repository', 'trail', null),
    [context.trail],
  );

  // ---- actions ------------------------------------------------------------
  // The upstream panel expects a `PanelContextValue<FileCityTrailExplorerPanelContext>`
  // — the host's `currentScope` + `refresh` plus the typed slices. We spread
  // the host context (which already carries those baseline fields) and
  // overlay the typed slice/repository fields the trail panel reads.
  const trailContext = React.useMemo(
    () => ({
      ...(context as PanelContextValue),
      fileTree: fileTreeSlice,
      lineCounts: lineCountsSlice,
      trail: trailSlice,
      repository,
    }) as PanelContextValue & FileCityTrailExplorerPanelContext,
    [context, fileTreeSlice, lineCountsSlice, trailSlice, repository],
  );

  const trailActions = React.useMemo<FileCityTrailExplorerPanelActions>(
    () => ({
      openFile: (filePath, line) => {
        const absolute =
          filePath.startsWith('/')
            ? filePath
            : repositoryPath
              ? `${repositoryPath}/${filePath}`
              : filePath;
        events.emit({
          type: 'file:open',
          source: 'file-city-trail-panel',
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
      createTrailNote: (payloadId, draft) =>
        TrailNotesService.create(payloadId, draft),
      updateTrailNote: (payloadId, noteId, body) =>
        TrailNotesService.update(payloadId, noteId, body),
      deleteTrailNote: async (payloadId, noteId) => {
        await TrailNotesService.remove(payloadId, noteId);
      },
      // Sign-off persistence is not yet implemented in the Electron host —
      // the multi-reviewer workflow targets the web version. These stubs
      // satisfy the action contract so the panel mounts; the LGTM button
      // animates optimistically but the stamp won't persist across reloads.
      createTrailSignOff: async () => null,
      deleteTrailSignOff: async () => {},
      closeTrail: onCloseTrail,
    }),
    [repositoryPath, events, onCloseTrail],
  );

  return (
    <FileCityTrailExplorerPanel
      context={trailContext}
      actions={trailActions}
      events={events}
    />
  );
};
