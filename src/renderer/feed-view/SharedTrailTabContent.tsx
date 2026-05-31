/**
 * SharedTrailTabContent
 *
 * Renders a trail published to web-ade, opened from a bare trail id (an inbox
 * row, a recently-visited row, or a pasted `…/trail/{id}` URL). Self-fetches the
 * payload via `TrailShareService.fetchSharedById`, resolves a local clone for the
 * on-disk file tree (or falls back to the GitHub tree when uncloned), and mounts
 * `FileCityTrailPanel` with the same context shape TrailsView's preview pane uses.
 * A banner marks it as remote so it never reads as one of your local trails.
 *
 * Extracted from FeedPanelFramework so both the Projects (feed) view and the
 * Inbox view can reuse it.
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
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { findClonedGithubEntry } from '../utils/alexandriaIdentity';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { GithubService } from '../main-process-api/GithubService';
import { FileCityTrailPanel } from '../dev-workspace/file-city-trail-panel';
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

export const SharedTrailTabContent: React.FC<{
  trailId: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}> = ({ trailId, events, repositories }) => {
  const { theme } = useTheme();
  const [payload, setPayload] = React.useState<TrailPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState<{
    owner: string;
    repo: string;
  } | null>(null);
  const [repositoryPath, setRepositoryPath] = React.useState<string | null>(
    null,
  );
  const [fileTree, setFileTree] = React.useState<FileTree | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await TrailShareService.fetchSharedById(trailId);
        if (cancelled) return;
        setPayload(result.payload);
        setOrigin({ owner: result.owner, repo: result.repo });

        // Render the city against on-disk files when the repo is cloned;
        // otherwise build the tree from GitHub so an uncloned shared trail
        // still gets a city (the deferred "open in browser" affordance sits
        // in the banner regardless).
        const localPath = findClonedGithubEntry(
          repositories,
          result.owner,
          result.repo,
        )?.path;
        if (cancelled) return;
        setRepositoryPath(localPath ?? null);

        let tree: FileTree | null = null;
        if (localPath) {
          tree = await RepositoryMonitoringService.getFileTree(localPath);
        }
        if (!tree) {
          tree = await fetchRemoteFileTree(result.owner, result.repo);
        }
        if (cancelled) return;
        setFileTree(tree);
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
  }, [trailId, repositories]);

  const repoName = origin?.repo ?? null;
  const panelContext = React.useMemo(
    () => ({
      currentScope: {
        type: 'repository' as const,
        ...(repositoryPath
          ? { repository: { path: repositoryPath, name: repoName ?? '' } }
          : {}),
      },
      refresh: async () => {},
      adapters: {},
      repository: repositoryPath
        ? { path: repositoryPath, name: repoName, owner: origin?.owner ?? null }
        : null,
      fileTree: {
        scope: 'repository' as const,
        name: 'fileTree',
        data: fileTree,
        loading: false,
        error: null,
        refresh: async () => {},
      } as DataSlice<FileTree | null>,
      trail: {
        scope: 'repository' as const,
        name: 'trail',
        data: payload,
        loading,
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
    [repositoryPath, repoName, origin, fileTree, payload, loading],
  );

  const browserUrl = `https://app.principal-ade.com/trail/${trailId}`;

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
        {origin && (
          <span>
            · {origin.owner}/{origin.repo}
          </span>
        )}
        {origin && !repositoryPath && (
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
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {error ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
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
        ) : (
          <FileCityTrailPanel
            key={`shared-trail:${trailId}`}
            context={panelContext}
            actions={{}}
            events={events}
          />
        )}
        {!error && loading && !payload && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              backgroundColor: `color-mix(in srgb, ${theme.colors.background} 70%, transparent)`,
              pointerEvents: 'none',
            }}
          >
            Loading shared trail…
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedTrailTabContent;
