/**
 * CollectionProfilePanel
 *
 * Displays a collection's profile with its repositories and users.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, Users, GitFork, User, ExternalLink, RefreshCw } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { GithubService } from '../main-process-api/GithubService';
import { CollectionRepoCard } from './cards/CollectionRepoCard';

export interface CollectionProfilePanelProps {
  collection: StarredCollection;
  events: PanelEventEmitter;
}

const getIconComponent = (iconName?: string): React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }> => {
  if (!iconName) return FolderGit2;
  const pascalCase = iconName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[pascalCase];
  return IconComponent || FolderGit2;
};

interface RepoInfo {
  owner: string;
  repo: string;
  description?: string;
  language?: string;
  stars?: number;
  avatarUrl?: string;
}

interface UserInfo {
  login: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
}

export const CollectionProfilePanel: React.FC<CollectionProfilePanelProps> = ({
  collection: initialCollection,
  events,
}) => {
  const { theme } = useTheme();

  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [collection, setCollection] = useState<StarredCollection>(initialCollection);
  const [repoInfos, setRepoInfos] = useState<Map<string, RepoInfo>>(new Map());
  const [userInfos, setUserInfos] = useState<Map<string, UserInfo>>(new Map());
  const [fileTrees, setFileTrees] = useState<Map<string, FileTree | null>>(new Map());
  const [treesLoading, setTreesLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      // Refresh collection data
      const collections = await WebAdeService.getStarredCollections(true);
      const refreshed = collections.find(c => c.id === initialCollection.id);
      if (refreshed) setCollection(refreshed);

      const current = refreshed || initialCollection;

      // Load repo details in parallel
      const repoMap = new Map<string, RepoInfo>();
      await Promise.allSettled(
        (current.repos || []).map(async ({ owner, repo }) => {
          try {
            const data = await GithubService.getRepository(owner, repo);
            if (data) {
              repoMap.set(`${owner}/${repo}`, {
                owner,
                repo,
                description: data.description || undefined,
                language: data.language || undefined,
                stars: data.stargazers_count,
                avatarUrl: data.owner?.avatar_url,
              });
            } else {
              repoMap.set(`${owner}/${repo}`, { owner, repo });
            }
          } catch {
            repoMap.set(`${owner}/${repo}`, { owner, repo });
          }
        })
      );
      setRepoInfos(new Map(repoMap));

      // Load user details in parallel
      const userMap = new Map<string, UserInfo>();
      await Promise.allSettled(
        (current.users || []).map(async ({ login }) => {
          try {
            const data = await GithubService.getUser(login);
            if (data) {
              userMap.set(login, {
                login,
                name: data.name || undefined,
                avatarUrl: data.avatar_url,
                bio: data.bio || undefined,
              });
            } else {
              userMap.set(login, { login });
            }
          } catch {
            userMap.set(login, { login });
          }
        })
      );
      setUserInfos(new Map(userMap));
    } finally {
      setLoading(false);
    }
  }, [initialCollection]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    const repos = collection.repos || [];
    if (repos.length === 0) {
      setFileTrees(new Map());
      setTreesLoading(false);
      return;
    }

    let cancelled = false;
    setTreesLoading(true);

    (async () => {
      const next = new Map<string, FileTree | null>();
      await Promise.allSettled(
        repos.map(async ({ owner, repo }) => {
          const key = `${owner}/${repo}`;
          try {
            const treeResponse = await WebAdeService.getGithubTree(owner, repo, 'HEAD');
            const files = treeResponse.tree
              .filter((entry) => entry.type === 'blob')
              .map((entry) => entry.path);
            const builder = new PathsFileTreeBuilder();
            next.set(key, builder.build({ files, rootPath: repo }));
          } catch (err) {
            console.warn(`[CollectionProfilePanel] Failed to fetch tree for ${key}:`, err);
            next.set(key, null);
          }
        })
      );
      if (!cancelled) {
        setFileTrees(next);
        setTreesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collection.repos]);

  const handleRepoClick = useCallback(
    (owner: string, repo: string) => {
      events.emit({
        type: 'feed:repository-selected',
        source: 'collection-profile-panel',
        timestamp: Date.now(),
        payload: {
          repository: {
            name: repo,
            path: '',
            github: { owner, name: repo },
          },
        },
      });
    },
    [events]
  );

  const handleUserClick = useCallback(
    (login: string) => {
      events.emit({
        type: 'user:profile-selected',
        source: 'collection-profile-panel',
        timestamp: Date.now(),
        payload: { username: login },
      });
    },
    [events]
  );

  const Icon = getIconComponent(collection.icon);
  const hasRepos = (collection.repos?.length || 0) > 0;
  const hasUsers = (collection.users?.length || 0) > 0;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${spacing.lg}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radii?.[2] || 8,
              backgroundColor: `${theme.colors.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={28} color={theme.colors.primary} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[3],
                  fontWeight: 700,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {collection.name}
              </h2>
              {collection.ownerType === 'org' && collection.ownerLogin && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: `2px ${spacing.sm}px`,
                    backgroundColor: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    flexShrink: 0,
                  }}
                >
                  <Users size={11} />
                  {collection.ownerLogin}
                </span>
              )}
              <button
                onClick={loadDetails}
                disabled={loading}
                title="Refresh"
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.xs,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: theme.radii?.[1] || 4,
                  color: theme.colors.textSecondary,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <RefreshCw
                  size={14}
                  style={loading ? { animation: 'spin 1s linear infinite' } : undefined}
                />
              </button>
            </div>
            {collection.description && (
              <p
                style={{
                  margin: `${spacing.xs}px 0 0`,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                {collection.description}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                marginTop: spacing.sm,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              {hasRepos && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GitFork size={12} />
                  {collection.repos.length} {collection.repos.length === 1 ? 'repository' : 'repositories'}
                </span>
              )}
              {hasUsers && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} />
                  {collection.users.length} {collection.users.length === 1 ? 'user' : 'users'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: spacing.md }}>
        {/* Repositories section */}
        {hasRepos && (
          <div style={{ marginBottom: spacing.lg }}>
            {hasUsers && (
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  fontWeight: 600,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: spacing.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <GitFork size={12} />
                Repositories
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                gap: spacing.md,
              }}
            >
              {collection.repos.map(({ owner, repo }) => {
                const key = `${owner}/${repo}`;
                const info = repoInfos.get(key);
                const fileTree = fileTrees.get(key);
                const isTreeLoading = treesLoading && !fileTrees.has(key);
                return (
                  <CollectionRepoCard
                    key={key}
                    repo={{
                      owner,
                      repo,
                      ownerAvatarUrl: info?.avatarUrl,
                      language: info?.language,
                      stars: info?.stars,
                    }}
                    fileTree={fileTree}
                    treeLoading={isTreeLoading}
                    onClick={() => handleRepoClick(owner, repo)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Users section */}
        {hasUsers && (
          <div>
            <div
              style={{
                fontSize: theme.fontSizes[0],
                fontWeight: 600,
                color: theme.colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: spacing.sm,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <User size={12} />
              Users
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {collection.users.map(({ login }) => {
                const info = userInfos.get(login);
                return (
                  <div
                    key={login}
                    onClick={() => handleUserClick(login)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    {info?.avatarUrl ? (
                      <img
                        src={info.avatarUrl}
                        alt={login}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: `${theme.colors.primary}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <User size={16} color={theme.colors.primary} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontWeight: 600,
                          color: theme.colors.text,
                        }}
                      >
                        {info?.name || login}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                        }}
                      >
                        @{login}
                      </div>
                    </div>
                    {info?.bio && (
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                        }}
                      >
                        {info.bio}
                      </div>
                    )}
                    <ExternalLink size={12} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasRepos && !hasUsers && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: spacing.lg,
              color: theme.colors.textSecondary,
              textAlign: 'center',
            }}
          >
            <FolderGit2 size={48} style={{ opacity: 0.4 }} />
            <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[1], fontWeight: 600 }}>
              Empty collection
            </div>
            <div style={{ marginTop: spacing.xs, fontSize: theme.fontSizes[0] }}>
              Add repositories or users on app.principal-ade.com
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default CollectionProfilePanel;
