/**
 * SharedTrailTabContent
 *
 * Renders a trail published to web-ade, opened from a bare trail id (an inbox
 * row, a recently-visited row, or a pasted `…/trail/{id}` URL). Self-fetches the
 * payload via `TrailShareService.fetchSharedById`, then hands it to
 * `SharedTrailViewer`, which resolves a local clone for the on-disk file tree
 * (or falls back to the GitHub tree when uncloned) and mounts
 * `FileCityTrailPanel` with the same context shape TrailsView's preview pane uses.
 * A banner marks it as remote so it never reads as one of your local trails.
 *
 * Extracted from ProjectsPanelFramework so both the Projects (feed) view and the
 * Inbox view can reuse it. The presentational half (`SharedTrailViewer`) is
 * split out so callers that already hold a payload can render the city without
 * re-fetching.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Route, ExternalLink } from 'lucide-react';
import type {
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  PathsFileTreeBuilder,
  type FileTree,
} from '@principal-ai/repository-abstraction';
import type { HighlightLayer } from '@principal-ai/file-city-react';
import type {
  TrailPayload,
  BaseTrailIndexEntry,
} from '@industry-theme/file-city-panel';
import { findClonedGithubEntry } from '../utils/alexandriaIdentity';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { GithubService } from '../main-process-api/GithubService';
import { FileCityTrailPanel } from '../dev-workspace/file-city-trail-panel';
import { ShareTrailModal } from '../dev-workspace/trails-panel/ShareTrailModal';
import { TrailShareService } from '../services/TrailShareService';
import { TrailShareError } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

/**
 * Build a File City `FileTree` from a repo's latest GitHub commit. Used when
 * a shared trail's repo isn't cloned locally — mirrors the `getRemoteFileTree`
 * action RepositoryProfilePanel uses for uncloned profiles.
 */
export async function fetchRemoteFileTree(
  owner: string,
  name: string,
): Promise<FileTree | null> {
  try {
    const latestCommit = await GithubService.getLatestCommit(owner, name);
    if (!latestCommit) return null;
    const filePaths = await GithubService.getFileTreeAtCommit(
      owner,
      name,
      latestCommit.sha,
    );
    return new PathsFileTreeBuilder().build({
      files: filePaths,
      rootPath: name,
    });
  } catch (error) {
    console.error('[SharedTrailTab] Failed to fetch remote file tree:', error);
    return null;
  }
}

/**
 * Presentational half of the shared-trail tab: given an already-fetched
 * payload and its origin `{owner, repo}`, resolve the file tree (local clone
 * first, GitHub fallback) and mount `FileCityTrailPanel`. Stateless about
 * *fetching* the trail — the caller owns that — so it can be reused by any
 * surface that already holds a payload.
 */
export const SharedTrailViewer: React.FC<{
  trailId: string;
  payload: TrailPayload;
  owner: string;
  repo: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
  /** Render the "Shared trail · owner/repo" banner. Default true. */
  showBanner?: boolean;
  /**
   * Which side the brief card claims in the landscape split layout.
   * Forwarded to `FileCityTrailPanel`; defaults to the upstream
   * `'trailing'` (brief on the right). The inbox passes `'leading'`.
   */
  briefSide?: 'leading' | 'trailing';
}> = ({
  trailId,
  payload,
  owner,
  repo,
  events,
  repositories,
  showBanner = true,
  briefSide,
}) => {
  const { theme } = useTheme();
  const [repositoryPath, setRepositoryPath] = React.useState<string | null>(
    null,
  );
  const [fileTree, setFileTree] = React.useState<FileTree | null>(null);
  const [treeLoading, setTreeLoading] = React.useState(true);
  // Whether the share modal is open. This trail is already published to
  // web-ade (we fetched it by share id), so the modal opens directly in
  // its success state via `initialUrl` — copy link / open in browser /
  // send to people — rather than re-running the share IPC.
  const [shareModalOpen, setShareModalOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setTreeLoading(true);
    void (async () => {
      try {
        // Render the city against on-disk files when the repo is cloned;
        // otherwise build the tree from GitHub so an uncloned shared trail
        // still gets a city (the deferred "open in browser" affordance sits
        // in the banner regardless).
        const localPath =
          findClonedGithubEntry(repositories, owner, repo)?.path ?? null;
        if (cancelled) return;
        setRepositoryPath(localPath);

        let tree: FileTree | null = null;
        if (localPath) {
          tree = await RepositoryMonitoringService.getFileTree(localPath);
        }
        if (!tree) {
          tree = await fetchRemoteFileTree(owner, repo);
        }
        if (cancelled) return;
        setFileTree(tree);
      } finally {
        if (!cancelled) setTreeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, repositories]);

  const panelContext = React.useMemo(
    () => ({
      currentScope: {
        type: 'repository' as const,
        ...(repositoryPath
          ? { repository: { path: repositoryPath, name: repo } }
          : {}),
      },
      refresh: async () => {},
      adapters: {},
      repository: repositoryPath
        ? { path: repositoryPath, name: repo, owner }
        : null,
      fileTree: {
        scope: 'repository' as const,
        name: 'fileTree',
        data: fileTree,
        loading: treeLoading,
        error: null,
        refresh: async () => {},
      } as DataSlice<FileTree | null>,
      trail: {
        scope: 'repository' as const,
        name: 'trail',
        data: payload,
        loading: false,
        error: null,
        refresh: async () => {},
      } as DataSlice<TrailPayload | null>,
      highlightLayers: {
        scope: 'repository' as const,
        name: 'highlightLayers',
        data: null,
        loading: false,
        error: null,
        refresh: async () => {},
      } as DataSlice<HighlightLayer[] | null>,
    }),
    [repositoryPath, repo, owner, fileTree, treeLoading, payload],
  );

  const browserUrl = `https://app.principal-ade.com/trail/${trailId}`;

  // Minimal index-entry shape for the share modal. With `initialUrl` set the
  // modal renders in success state and never runs the share IPC, so only
  // `title`/`id` are ever read — the rest are filled to satisfy the type.
  const shareTrailEntry = React.useMemo<BaseTrailIndexEntry>(
    () => ({
      id: payload.id,
      title: payload.title || 'Untitled trail',
      summaryPreview: '',
      markerCount: 0,
      repoNames: [repo],
      hasDiffSnippets: false,
      createdAt: '',
      updatedAt: '',
      sizeBytes: 0,
    }),
    [payload.id, payload.title, repo],
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Remote/shared banner — this is the load-bearing cue that the trail
          is published on web-ade, not one of your local library trails. */}
      {showBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            flexShrink: 0,
          }}
        >
          <Route size={13} />
          <span style={{ fontWeight: 600, color: theme.colors.text }}>
            Shared trail
          </span>
          <span>
            · {owner}/{repo}
          </span>
          {/* Debug: surface the exact id fed to fetchSharedById and the note
              count it resolved, so the inbox vs titlebar open can be compared
              side by side. */}
          <span style={{ opacity: 0.8, fontFamily: theme.fonts.monospace }}>
            · id {trailId} · {payload.notes?.length ?? 0} notes
          </span>
          {!repositoryPath && (
            <span style={{ opacity: 0.8 }}>· not cloned locally</span>
          )}
          <a
            href={browserUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: 'auto',
              color: theme.colors.primary,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Open in browser <ExternalLink size={12} />
          </a>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <FileCityTrailPanel
          key={`shared-trail:${trailId}`}
          context={panelContext}
          actions={{}}
          events={events}
          briefSide={briefSide}
          onShareTrail={() => setShareModalOpen(true)}
          // This is a published trail fetched from web-ade; its payload isn't
          // in the local disk store, so notes must be created against web-ade.
          remoteNotes
        />
      </div>
      {shareModalOpen && (
        <ShareTrailModal
          trail={shareTrailEntry}
          // Already published — open directly in success state so the modal
          // surfaces copy-link / open-in-browser / send-to-people instead of
          // re-sharing. `repositoryPath` (when cloned) lets the send picker
          // enumerate the repo's collaborators.
          initialUrl={browserUrl}
          repositoryPath={repositoryPath ?? undefined}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
};

export const SharedTrailTabContent: React.FC<{
  trailId: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
  /** Forwarded to `SharedTrailViewer` → `FileCityTrailPanel`. */
  briefSide?: 'leading' | 'trailing';
}> = ({ trailId, events, repositories, briefSide }) => {
  const { theme } = useTheme();
  const [result, setResult] = React.useState<{
    payload: TrailPayload;
    owner: string;
    repo: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const fetched = await TrailShareService.fetchSharedById(trailId);
        if (cancelled) return;
        setResult({
          payload: fetched.payload,
          owner: fetched.owner,
          repo: fetched.repo,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof TrailShareError
            ? err.message
            : 'Could not load this shared trail.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trailId]);

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
        }}
      >
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
        }}
      >
        {loading ? 'Loading shared trail…' : null}
      </div>
    );
  }

  return (
    <SharedTrailViewer
      trailId={trailId}
      payload={result.payload}
      owner={result.owner}
      repo={result.repo}
      events={events}
      repositories={repositories}
      briefSide={briefSide}
    />
  );
};

export default SharedTrailTabContent;
