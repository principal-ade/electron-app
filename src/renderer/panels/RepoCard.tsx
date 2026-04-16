/**
 * RepoCard
 *
 * Compact repository card component for profile panels.
 * Displays repository name and File City visualization.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
  type CityData,
  createFileColorHighlightLayers,
  getFileColorMapping,
} from '@principal-ai/file-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';

/**
 * Contributor information
 */
export interface Contributor {
  username: string;
  avatarUrl: string;
  contributions: number;
}

/**
 * Repository information for the card
 */
export interface RepoCardData {
  repoName: string;
  repoPath?: string; // Local path (if available)
  githubOwner?: string;
  githubRepoName?: string;
  description?: string;
  language?: string;
  stars?: number;
  isOwnerOrg?: boolean;
  createdAt?: string; // ISO date string
  topContributors?: Contributor[]; // Top contributors (max 5)
}

interface RepoCardProps {
  repo: RepoCardData;
  onClick?: () => void;
  onDoubleClick?: () => void;
  /** Optional file tree for testing/stories - if provided, skips fetching */
  fileTree?: FileTree | null;
}


/**
 * Format number with k suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(num);
}

/**
 * Format project age from creation date
 */
function formatProjectAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    return `Created ${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  }
  if (diffMonths > 0) {
    return `Created ${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  }
  if (diffDays > 0) {
    return `Created ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
  return 'Created recently';
}

export const RepoCard: React.FC<RepoCardProps> = ({
  repo,
  onClick,
  onDoubleClick,
  fileTree: providedFileTree,
}) => {
  const { theme } = useTheme();

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  // File City state
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(false);

  // Create highlight layers for file colors based on extensions
  const highlightLayers = useMemo(() => {
    if (!cityData?.buildings) return [];
    return createFileColorHighlightLayers(cityData.buildings);
  }, [cityData]);

  // Get language color for the indicator dot
  const languageColor = useMemo(() => {
    if (!repo.language) return theme.colors.primary;

    const colorMapping = getFileColorMapping();
    const languageToExtension: Record<string, string> = {
      'TypeScript': '.ts',
      'JavaScript': '.js',
      'Python': '.py',
      'Rust': '.rs',
      'Go': '.go',
      'Java': '.java',
      'C++': '.cpp',
      'C': '.c',
      'Ruby': '.rb',
      'PHP': '.php',
      'Swift': '.swift',
      'Kotlin': '.kt',
      'Dart': '.dart',
      'CSS': '.css',
      'HTML': '.html',
      'Markdown': '.md',
    };

    const extension = languageToExtension[repo.language];
    if (extension && colorMapping[extension]) {
      return colorMapping[extension];
    }

    return theme.colors.primary;
  }, [repo.language, theme.colors.primary]);

  // Build File City data from provided file tree
  useEffect(() => {
    if (!providedFileTree) {
      setCityData(null);
      setCityLoading(false);
      return;
    }

    try {
      const versionMap = new Map([['main', providedFileTree]]);
      const { unionCity } = MultiVersionCityBuilder.build(versionMap);
      setCityData(unionCity);
      setCityLoading(false);
    } catch (err) {
      console.warn(`[RepoCard] Failed to build city for ${repo.repoName}:`, err);
      setCityData(null);
      setCityLoading(false);
    }
  }, [providedFileTree, repo.repoName]);

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        cursor: onClick || onDoubleClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick || onDoubleClick) {
          e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.border}`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick || onDoubleClick) {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Horizontal layout: File City left, content right */}
      <div
        style={{
          display: 'flex',
          minHeight: 200,
        }}
      >
        {/* File City - left side */}
        <div
          style={{
            width: 200,
            height: 200,
            backgroundColor: theme.colors.background,
            borderRight: `1px solid ${theme.colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {cityLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing.sm,
                color: theme.colors.textMuted,
              }}
            >
              <FolderGit2 size={32} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: theme.fontSizes[0] }}>Loading...</span>
            </div>
          ) : cityData ? (
            <ArchitectureMapHighlightLayers
              cityData={cityData}
              highlightLayers={highlightLayers}
              fullSize
              showFileNames={false}
              canvasBackgroundColor={theme.colors.background}
              maxCanvasSize={4096}
            />
          ) : (
            <FolderGit2 size={48} color={theme.colors.textMuted} style={{ opacity: 0.3 }} />
          )}
        </div>

        {/* Repository info - right side */}
        <div
          style={{
            flex: 1,
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
          }}
        >
          {/* Repository name */}
          <h4
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.repoName}
          </h4>

          {/* Project age (if available) */}
          {repo.createdAt && (
            <div
              style={{
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
                color: theme.colors.textSecondary,
              }}
            >
              {formatProjectAge(repo.createdAt)}
            </div>
          )}

          {/* Description */}
          {repo.description && (
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
                lineHeight: theme.lineHeights?.body ?? 1.5,
                color: theme.colors.textSecondary,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {repo.description}
            </p>
          )}

          {/* Top Contributors - Fan Layout */}
          {repo.topContributors && repo.topContributors.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: spacing.sm,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  position: 'relative',
                  height: 32,
                }}
              >
                {repo.topContributors.slice(0, 5).map((contributor, index) => (
                  <div
                    key={contributor.username}
                    title={`${contributor.username} - ${contributor.contributions} contributions`}
                    style={{
                      position: 'relative',
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: `2px solid ${theme.colors.surface}`,
                      overflow: 'hidden',
                      marginLeft: index === 0 ? 0 : -12,
                      zIndex: 5 - index,
                      transition: 'transform 0.15s ease, z-index 0s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.zIndex = '10';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.zIndex = String(5 - index);
                    }}
                  >
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.username}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacer to push metadata to bottom */}
          <div style={{ flex: 1 }} />

          {/* Bottom metadata */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textMuted,
              fontFamily: theme.fonts?.body,
            }}
          >
            {/* Language */}
            {repo.language && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: languageColor,
                  }}
                />
                <span>{repo.language}</span>
              </div>
            )}

            {/* Stars */}
            {repo.stars !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <span>⭐</span>
                <span>{formatNumber(repo.stars)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepoCard;
