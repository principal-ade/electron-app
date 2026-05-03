import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
  type CityData,
  type HighlightLayer,
  createFileColorHighlightLayers,
} from '@principal-ai/file-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { GithubService } from '../../main-process-api/GithubService';
import type {
  GitHubCommit,
  ChangedFileInfo,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';

export interface CollectionRepoCardData {
  owner: string;
  repo: string;
  ownerAvatarUrl?: string;
  language?: string;
  stars?: number;
}

export interface CollectionRepoCardProps {
  repo: CollectionRepoCardData;
  onClick?: () => void;
  /** File tree for the repo. Used to render a File City visualization. */
  fileTree?: FileTree | null;
  /** Indicates the file tree is still being fetched. */
  treeLoading?: boolean;
}

interface LatestCommitSummary {
  sha: string;
  subject: string;
  author: string;
  authoredAt: Date;
  filesChanged: number;
  additions: number;
  deletions: number;
  files: { path: string; status: ChangedFileInfo['status'] }[];
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const CollectionRepoCard: React.FC<CollectionRepoCardProps> = ({
  repo,
  onClick,
  fileTree,
  treeLoading,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };
  const radius = theme.radii?.[2] || 8;
  const avatarSrc = repo.ownerAvatarUrl ?? `https://github.com/${repo.owner}.png?size=120`;

  const [cityData, setCityData] = useState<CityData | null>(null);
  const [latestCommit, setLatestCommit] = useState<LatestCommitSummary | null>(null);

  useEffect(() => {
    if (!fileTree) {
      setCityData(null);
      return;
    }
    try {
      const versionMap = new Map([['main', fileTree]]);
      const { unionCity } = MultiVersionCityBuilder.build(versionMap);
      setCityData(unionCity);
    } catch (err) {
      console.warn(`[CollectionRepoCard] Failed to build city for ${repo.owner}/${repo.repo}:`, err);
      setCityData(null);
    }
  }, [fileTree, repo.owner, repo.repo]);

  useEffect(() => {
    let cancelled = false;
    setLatestCommit(null);
    (async () => {
      try {
        const commit: GitHubCommit | null = await GithubService.getLatestCommit(
          repo.owner,
          repo.repo,
        );
        if (cancelled || !commit) return;
        const changed = await GithubService.getChangedFilesForCommit(
          repo.owner,
          repo.repo,
          commit.sha,
        );
        if (cancelled) return;
        let additions = 0;
        let deletions = 0;
        const files: LatestCommitSummary['files'] = [];
        for (const [path, info] of changed.entries()) {
          additions += info.additions;
          deletions += info.deletions;
          files.push({ path, status: info.status });
        }
        const subject = commit.commit.message.split('\n')[0];
        setLatestCommit({
          sha: commit.sha,
          subject,
          author:
            commit.author?.login ?? commit.commit.author?.name ?? 'unknown',
          authoredAt: new Date(commit.commit.author?.date ?? Date.now()),
          filesChanged: files.length,
          additions,
          deletions,
          files,
        });
      } catch (err) {
        if (!cancelled) {
          console.warn(
            `[CollectionRepoCard] Failed to fetch latest commit for ${repo.owner}/${repo.repo}:`,
            err,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo.owner, repo.repo]);

  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    if (!cityData?.buildings) return [];
    const base = createFileColorHighlightLayers(cityData.buildings);
    if (!latestCommit || latestCommit.files.length === 0) return base;
    // City paths are prefixed with the repo name (PathsFileTreeBuilder uses
    // `rootPath: repo`). GitHub returns paths relative to the repo root, so
    // re-anchor them before matching.
    const buildingPaths = new Set(cityData.buildings.map((b) => b.path));
    const added: string[] = [];
    const modified: string[] = [];
    for (const file of latestCommit.files) {
      if (file.status === 'deleted') continue;
      const cityPath = `${repo.repo}/${file.path}`;
      if (!buildingPaths.has(cityPath)) continue;
      if (file.status === 'added') added.push(cityPath);
      else modified.push(cityPath);
    }
    const overlays: HighlightLayer[] = [];
    if (modified.length > 0) {
      overlays.push({
        id: 'recent-commit-modified',
        name: 'Modified in latest commit',
        enabled: true,
        color: theme.colors.warning,
        priority: 850,
        opacity: 0.9,
        items: modified.map((path) => ({
          path,
          type: 'file',
          renderStrategy: 'fill',
        })),
      });
    }
    if (added.length > 0) {
      overlays.push({
        id: 'recent-commit-added',
        name: 'Added in latest commit',
        enabled: true,
        color: theme.colors.success,
        priority: 860,
        opacity: 0.9,
        items: added.map((path) => ({
          path,
          type: 'file',
          renderStrategy: 'fill',
        })),
      });
    }
    return [...base, ...overlays];
  }, [cityData, latestCommit, repo.repo, theme]);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: radius,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      {/* Header: avatar + repo/owner + language/stars */}
      <div
        style={{
          padding: spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <img
          src={avatarSrc}
          alt={repo.owner}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `2px solid ${theme.colors.border}`,
            flexShrink: 0,
            display: 'block',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts?.monospace ?? theme.fonts?.body,
              fontSize: theme.fontSizes[1],
              fontWeight: 600,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={repo.repo}
          >
            {repo.repo}
          </div>
          <div
            style={{
              fontFamily: theme.fonts?.monospace ?? theme.fonts?.body,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={repo.owner}
          >
            {repo.owner}
          </div>
        </div>

        {(repo.language || repo.stars !== undefined) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              flexShrink: 0,
            }}
          >
            {repo.language && (
              <span
                style={{
                  padding: `1px ${spacing.xs}px`,
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: theme.radii?.[0] || 2,
                }}
              >
                {repo.language}
              </span>
            )}
            {repo.stars !== undefined && <span>★ {repo.stars.toLocaleString()}</span>}
          </div>
        )}
      </div>

      {/* City visualization */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: 320,
          backgroundColor: theme.colors.background,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {cityData ? (
          <ArchitectureMapHighlightLayers
            cityData={cityData}
            highlightLayers={highlightLayers}
            fullSize
            showFileNames={false}
            showDirectoryLabels={false}
            showLayerControls={false}
            canvasBackgroundColor={theme.colors.background}
            defaultBuildingColor={theme.colors.backgroundSecondary}
            defaultDirectoryColor={theme.colors.background}
            maxCanvasSize={1024}
          />
        ) : treeLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.xs,
              color: theme.colors.textSecondary,
            }}
          >
            <FolderGit2 size={28} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: theme.fontSizes[0] }}>Loading…</span>
          </div>
        ) : (
          <FolderGit2 size={40} color={theme.colors.textSecondary} style={{ opacity: 0.3 }} />
        )}
      </div>

      {/* Footer: latest commit */}
      {latestCommit && (
        <div
          style={{
            padding: spacing.sm,
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            fontFamily: theme.fonts?.body,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: spacing.xs,
            }}
          >
            <code
              style={{
                fontFamily: theme.fonts?.monospace,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                flexShrink: 0,
              }}
              title={latestCommit.sha}
            >
              {latestCommit.sha.slice(0, 7)}
            </code>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.text,
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
              title={latestCommit.subject}
            >
              {latestCommit.subject}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts?.monospace,
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
              title={latestCommit.author}
            >
              {latestCommit.author}
            </span>
            <span style={{ flexShrink: 0 }}>
              {formatRelativeTime(latestCommit.authoredAt)}
            </span>
            <span style={{ color: theme.colors.success, flexShrink: 0 }}>
              +{latestCommit.additions}
            </span>
            <span style={{ color: theme.colors.error, flexShrink: 0 }}>
              −{latestCommit.deletions}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionRepoCard;
