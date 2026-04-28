import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
  type CityData,
  createFileColorHighlightLayers,
} from '@principal-ai/file-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';

export interface CollectionRepoCardData {
  owner: string;
  repo: string;
  ownerAvatarUrl?: string;
  description?: string;
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

  const hasFooter = repo.description !== undefined || repo.language !== undefined || repo.stars !== undefined;

  const [cityData, setCityData] = useState<CityData | null>(null);

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

  const highlightLayers = useMemo(() => {
    if (!cityData?.buildings) return [];
    return createFileColorHighlightLayers(cityData.buildings);
  }, [cityData]);

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
            maxCanvasSize={4096}
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

      {/* Footer: description */}
      {hasFooter && repo.description && (
        <div
          style={{
            padding: spacing.sm,
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            fontFamily: theme.fonts?.body,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {repo.description}
        </div>
      )}
    </div>
  );
};

export default CollectionRepoCard;
