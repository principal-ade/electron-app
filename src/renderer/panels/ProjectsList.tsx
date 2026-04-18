/**
 * ProjectsList
 *
 * Component showing a list of repositories sorted by recent activity.
 * Used in the FeedView panel layout.
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, User, ChevronDown, ChevronRight } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { SegmentedControl } from '../components/SegmentedControl';
import { GithubService } from '../main-process-api/GithubService';

export interface CommitTimestamp {
  timestamp: Date | string;
  repoId?: string;
}

export interface ProjectsListProps {
  /** Commit timestamps to aggregate by repository */
  commits: CommitTimestamp[];
  /** Repository data with GitHub information */
  repositories?: AlexandriaEntry[];
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Currently selected time block (not used in repository list) */
  selectedBlock?: string | null;
}

type ProjectsViewMode = 'timeline' | 'by-org';

interface RepoSummaryWithEntry extends RepoSummary {
  entry?: AlexandriaEntry;
}

interface RepoSummary {
  repoId: string;
  repoName: string;
  commitCount: number;
  lastCommitTime: Date;
  githubOwner?: string;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
  commits,
  repositories = [],
  events,
  selectedBlock: _selectedBlock = null,
}) => {
  const { theme } = useTheme();

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  // View mode state
  const [viewMode, setViewMode] = useState<ProjectsViewMode>('timeline');

  // User's GitHub username and organizations
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userOrgs, setUserOrgs] = useState<string[]>([]);

  // Collapsed state for org sections
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(new Set());

  // Fetch user's GitHub username and organizations
  useEffect(() => {
    const fetchGitHubData = async () => {
      try {
        const [user, orgs] = await Promise.all([
          GithubService.getCurrentUser(),
          GithubService.getUserOrganizations(),
        ]);

        if (user) {
          setCurrentUser(user.login);
        }
        setUserOrgs(orgs.map(org => org.login));
      } catch (error) {
        console.error('[ProjectsList] Failed to fetch GitHub data:', error);
        setCurrentUser(null);
        setUserOrgs([]);
      }
    };

    fetchGitHubData();
  }, []);

  // Format relative time
  const formatRelativeTime = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return `${diffYears}y ago`;
  }, []);

  // Handle repository click - open profile
  const handleRepoClick = useCallback(
    (entry: AlexandriaEntry) => {
      events.emit({
        type: 'feed:repository-selected',
        source: 'projects-list-panel',
        timestamp: Date.now(),
        payload: { repository: entry },
      });
    },
    [events]
  );

  // Create a map of repo paths to github owner info
  const repoGithubMap = useMemo(() => {
    const map = new Map<string, { owner: string; name: string }>();
    for (const repo of repositories) {
      if (repo.path && repo.github?.owner && repo.github?.name) {
        map.set(repo.path, { owner: repo.github.owner, name: repo.github.name });
      }
    }
    return map;
  }, [repositories]);

  // Aggregate commits by repository (for timeline view)
  const repoSummaries = useMemo<RepoSummaryWithEntry[]>(() => {
    const repoMap = new Map<string, RepoSummaryWithEntry>();

    for (const commit of commits) {
      // Skip commits without repoId
      if (!commit.repoId) continue;

      const repoId = commit.repoId;
      const timestamp = typeof commit.timestamp === 'string'
        ? new Date(commit.timestamp)
        : commit.timestamp;

      let summary = repoMap.get(repoId);
      if (!summary) {
        // Extract repo name from path (last part after /)
        const repoName = repoId.split('/').pop() || repoId;
        const githubInfo = repoGithubMap.get(repoId);
        const entry = repositories.find(r => r.path === repoId);
        summary = {
          repoId,
          repoName,
          commitCount: 0,
          lastCommitTime: timestamp,
          githubOwner: githubInfo?.owner,
          entry,
        };
        repoMap.set(repoId, summary);
      }
      summary.commitCount++;
      if (timestamp > summary.lastCommitTime) {
        summary.lastCommitTime = timestamp;
      }
    }

    // Sort by most recent commit first
    return Array.from(repoMap.values()).sort(
      (a, b) => b.lastCommitTime.getTime() - a.lastCommitTime.getTime()
    );
  }, [commits, repoGithubMap, repositories]);

  // Group repositories by organization (for by-org view)
  const groupedRepos = useMemo(() => {
    const groups = new Map<string, AlexandriaEntry[]>();

    for (const repo of repositories) {
      const orgName = repo.github?.owner || 'Untracked';
      const existing = groups.get(orgName) || [];
      existing.push(repo);
      groups.set(orgName, existing);
    }

    // Sort repos within each group alphabetically
    for (const [orgName, repos] of groups.entries()) {
      repos.sort((a, b) => a.name.localeCompare(b.name));
      groups.set(orgName, repos);
    }

    // Create sorted array of org names
    const orgNames = Array.from(groups.keys());

    // Separate into user's own, member orgs, other orgs, and untracked
    const userOwn = currentUser && orgNames.includes(currentUser) ? [currentUser] : [];
    const memberOrgs = orgNames.filter(org =>
      org !== 'Untracked' &&
      org !== currentUser &&
      userOrgs.includes(org)
    );
    const otherOrgs = orgNames.filter(org =>
      org !== 'Untracked' &&
      org !== currentUser &&
      !userOrgs.includes(org)
    );
    const untracked = orgNames.includes('Untracked') ? ['Untracked'] : [];

    // Sort member orgs and other orgs alphabetically
    memberOrgs.sort((a, b) => a.localeCompare(b));
    otherOrgs.sort((a, b) => a.localeCompare(b));

    // Combine in order: user's own, member orgs, other orgs, untracked
    const sortedOrgNames = [...userOwn, ...memberOrgs, ...otherOrgs, ...untracked];

    return {
      groups,
      sortedOrgNames,
    };
  }, [repositories, currentUser, userOrgs]);

  // Toggle org collapsed state
  const toggleOrgCollapsed = useCallback((orgName: string) => {
    setCollapsedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgName)) {
        next.delete(orgName);
      } else {
        next.add(orgName);
      }
      return next;
    });
  }, []);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Subtab Control */}
      <div
        style={{
          padding: spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <SegmentedControl
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'by-org', label: 'By Organization' },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as ProjectsViewMode)}
          theme={theme}
        />
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
            padding: spacing.md,
          }}
        >
        {repoSummaries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              textAlign: 'center',
            }}
          >
            <FolderGit2 size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
            <span>No repositories</span>
          </div>
        ) : (
          repoSummaries.map((summary) => {
            return (
              <div
                key={summary.repoId}
                onClick={() => summary.entry && handleRepoClick(summary.entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  width: '100%',
                  padding: spacing.sm,
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii?.[1] || 4,
                  cursor: summary.entry ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  opacity: summary.entry ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (summary.entry) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (summary.entry) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
              {/* Avatar */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {summary.githubOwner ? (
                  <img
                    src={`https://github.com/${summary.githubOwner}.png?size=120`}
                    alt={summary.githubOwner}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                {!summary.githubOwner && (
                  <User size={36} color={theme.colors.textSecondary} />
                )}
              </div>

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontWeight: 600,
                    color: theme.colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 2,
                  }}
                >
                  {summary.repoName}
                </div>
                {summary.githubOwner && (
                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: 4,
                    }}
                  >
                    {summary.githubOwner}
                  </div>
                )}
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textTertiary,
                  }}
                >
                  {formatRelativeTime(summary.lastCommitTime)}
                </div>
              </div>
              </div>
            );
          })
        )}
        </div>
      )}

      {/* By Organization View */}
      {viewMode === 'by-org' && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: spacing.md,
          }}
        >
          {groupedRepos.sortedOrgNames.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
                textAlign: 'center',
              }}
            >
              <FolderGit2 size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
              <span>No repositories</span>
            </div>
          ) : (
            groupedRepos.sortedOrgNames.map((orgName) => {
              const repos = groupedRepos.groups.get(orgName) || [];
              const isCollapsed = collapsedOrgs.has(orgName);
              const isUserOwn = currentUser === orgName;
              const isMemberOrg = userOrgs.includes(orgName);

              return (
                <div key={orgName} style={{ marginBottom: spacing.md }}>
                  {/* Org Header */}
                  <div
                    onClick={() => toggleOrgCollapsed(orgName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      cursor: 'pointer',
                      marginBottom: spacing.xs,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    {/* Chevron */}
                    {isCollapsed ? (
                      <ChevronRight size={16} color={theme.colors.textSecondary} />
                    ) : (
                      <ChevronDown size={16} color={theme.colors.textSecondary} />
                    )}

                    {/* Org Avatar */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {orgName !== 'Untracked' ? (
                        <img
                          src={`https://github.com/${orgName}.png?size=64`}
                          alt={orgName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <FolderGit2 size={16} color={theme.colors.textSecondary} />
                      )}
                    </div>

                    {/* Org Name */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontWeight: 600,
                          color: theme.colors.text,
                        }}
                      >
                        {orgName}
                        {isUserOwn && (
                          <span
                            style={{
                              marginLeft: spacing.xs,
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.primary,
                              fontWeight: 400,
                            }}
                          >
                            (you)
                          </span>
                        )}
                        {!isUserOwn && isMemberOrg && (
                          <span
                            style={{
                              marginLeft: spacing.xs,
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.primary,
                              fontWeight: 400,
                            }}
                          >
                            (member)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Repo Count */}
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        fontFamily: theme.fonts.monospace,
                      }}
                    >
                      {repos.length} {repos.length === 1 ? 'repo' : 'repos'}
                    </div>
                  </div>

                  {/* Repos in Org */}
                  {!isCollapsed && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: spacing.xs,
                        paddingLeft: spacing.md + spacing.sm,
                      }}
                    >
                      {repos.map((repo) => (
                        <div
                          key={repo.name}
                          onClick={() => handleRepoClick(repo)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm,
                            padding: spacing.sm,
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.radii?.[1] || 4,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                            e.currentTarget.style.borderColor = theme.colors.primary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = theme.colors.border;
                          }}
                        >
                          <FolderGit2 size={16} color={theme.colors.textSecondary} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {repo.name}
                            </div>
                            {repo.github?.description && (
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  color: theme.colors.textSecondary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: 2,
                                }}
                              >
                                {repo.github.description}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectsList;
