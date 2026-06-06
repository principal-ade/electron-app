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
  type TrailBriefLayout,
  type TrailBriefLayoutState,
} from '@industry-theme/file-city-panel';

export type { TrailBriefLayout, TrailBriefLayoutState };

import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';
import type { TrailNote, TrailPayload } from '@industry-theme/file-city-panel';
import type { HighlightLayer } from '@principal-ai/file-city-react';

import { TrailNotesService } from '../../services/TrailNotesService';

interface FileCityTrailPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  lineCounts?: DataSlice<LineCountsSliceData | null>;
  trail?: DataSlice<TrailPayload | null>;
  highlightLayers?: DataSlice<HighlightLayer[] | null>;
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
  /**
   * Wire the upstream `FileCityTrailExplorerPanelActions.shareTrail`. When
   * provided, the brief card grows a Share button in its footer; the host
   * runs the actual share flow (modal, API call, etc.). The returned
   * promise drives the button's in-flight + result animation.
   */
  onShareTrail?: () => void | Promise<void>;
  /**
   * Layout for the brief modal alongside the city. Forwarded to the upstream
   * `FileCityTrailExplorerPanel`'s `briefLayout` prop. Despite the upstream
   * d.ts describing the defaults block as one-shot useState seeds, this
   * particular value is consumed inline on every render — flipping it from
   * the host swaps layouts smoothly without a remount. Defaults to the
   * upstream default (`'three-zone'`) when omitted.
   */
  briefLayout?: TrailBriefLayout;
  /**
   * Which side the brief card claims in the landscape `split` layout — the
   * map / graph zone takes the opposite side. `'leading'` puts the brief on
   * the left, `'trailing'` (upstream default) on the right. No effect in the
   * `diagram` layout or portrait split. Forwarded to the upstream panel's
   * `briefSide` prop.
   */
  briefSide?: 'leading' | 'trailing';
  /**
   * Initial value for the hide-map toggle on the brief-layout switch.
   * Forwarded to the upstream panel's `defaultHideMap` prop. Like
   * `briefLayout`, hosts that persist reader preferences feed the
   * remembered value back here on mount.
   */
  defaultHideMap?: boolean;
  /**
   * Fires when the reader toggles either the layout or the hide-map
   * switch inside the brief. The payload is the combined new state —
   * persist it however you like (per-trail, per-repo, workspace-
   * global) and feed it back via `briefLayout` / `defaultHideMap`.
   */
  onBriefLayoutChange?: (state: TrailBriefLayoutState) => void;
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
  onShareTrail,
  briefLayout,
  briefSide,
  defaultHideMap,
  onBriefLayoutChange,
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

  // Optimistic notes override. The upstream panel renders notes purely from
  // `trail.notes` — it does no local merging — and our IPC note handlers
  // persist to disk without re-broadcasting PAYLOAD_SET, so a freshly added
  // note never makes it back into the slice until the trail is reloaded from
  // disk. We mirror the writes here so create/update/delete are visible
  // immediately. Keyed by trail id so a different trail loading clears the
  // override; null means "no overrides, use the slice's notes as-is". This
  // mirrors the Alexandria mount (FileCityTrailTabContent.tsx).
  const baseTrail = context.trail?.data ?? null;
  const trailId = baseTrail?.id ?? null;

  const [notesOverride, setNotesOverride] = React.useState<{
    trailId: string;
    notes: TrailNote[];
  } | null>(null);

  React.useEffect(() => {
    setNotesOverride((prev) =>
      prev && prev.trailId === trailId ? prev : null,
    );
  }, [trailId]);

  const effectiveTrail = React.useMemo<TrailPayload | null>(() => {
    if (!baseTrail) return null;
    if (!notesOverride || notesOverride.trailId !== baseTrail.id) {
      return baseTrail;
    }
    return { ...baseTrail, notes: notesOverride.notes };
  }, [baseTrail, notesOverride]);

  const trailSlice = React.useMemo<DataSlice<TrailPayload | null>>(() => {
    const baseSlice = context.trail ?? emptySlice('repository', 'trail', null);
    return { ...baseSlice, data: effectiveTrail };
  }, [context.trail, effectiveTrail]);

  // Host-supplied idle-state highlight layers. Only honored by the
  // upstream panel when `trail.data` is null — once a trail is active
  // the panel derives its own marker-based layers and ignores this.
  const highlightLayersSlice = React.useMemo<
    DataSlice<HighlightLayer[] | null>
  >(
    () =>
      context.highlightLayers ??
      emptySlice('repository', 'highlightLayers', null),
    [context.highlightLayers],
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
      highlightLayers: highlightLayersSlice,
      repository,
    }) as PanelContextValue & FileCityTrailExplorerPanelContext,
    [
      context,
      fileTreeSlice,
      lineCountsSlice,
      trailSlice,
      highlightLayersSlice,
      repository,
    ],
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
      createTrailNote: async (payloadId, draft) => {
        const note = await TrailNotesService.create(payloadId, draft);
        if (note) {
          setNotesOverride((prev) => {
            const base =
              prev && prev.trailId === payloadId
                ? prev.notes
                : (baseTrail?.notes ?? []);
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
                : (baseTrail?.notes ?? []);
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
              : (baseTrail?.notes ?? []);
          return {
            trailId: payloadId,
            notes: base.filter((n) => n.id !== noteId),
          };
        });
      },
      // Sign-off persistence is not yet implemented in the Electron host —
      // the multi-reviewer workflow targets the web version. These stubs
      // satisfy the action contract so the panel mounts; the LGTM button
      // animates optimistically but the stamp won't persist across reloads.
      createTrailSignOff: async () => null,
      deleteTrailSignOff: async () => {},
      closeTrail: onCloseTrail,
      shareTrail: onShareTrail,
    }),
    [repositoryPath, events, onCloseTrail, onShareTrail, baseTrail],
  );

  return (
    <FileCityTrailExplorerPanel
      context={trailContext}
      actions={trailActions}
      events={events}
      briefLayout={briefLayout}
      briefSide={briefSide}
      defaultHideMap={defaultHideMap}
      onBriefLayoutChange={onBriefLayoutChange}
      // Single local user: notes are authored 'You', so the panel's note
      // Edit/Delete (gated on note.author === currentAuthor since 0.5.152)
      // need a matching currentAuthor. Harmless on 0.5.151 (its old default).
      currentAuthor="You"
    />
  );
};
