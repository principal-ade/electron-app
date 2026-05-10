/**
 * ProjectsList
 *
 * Component showing a list of repositories sorted by recent activity.
 * Used in the FeedView panel layout.
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, Search } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { payloadFromLocalEntry } from '../events/feedRepositorySelected';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { SegmentedControl } from '../components/SegmentedControl';
import { GithubService } from '../main-process-api/GithubService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { ProjectRepoCard } from './cards/ProjectRepoCard';
import { OrgSectionHeaderCard } from './cards/OrgSectionHeaderCard';
import { OrgRepoItemCard } from './cards/OrgRepoItemCard';

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

type ProjectsViewMode = 'in-progress' | 'recent' | 'by-org';

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
  const [viewMode, setViewMode] = useState<ProjectsViewMode>('in-progress');

  // Git status map for repositories
  const [gitStatusMap, setGitStatusMap] = useState<Map<string, GitStatusWithFiles>>(new Map());

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

  // Fetch git status for all repositories with local paths
  useEffect(() => {
    let cancelled = false;

    const fetchGitStatuses = async () => {
      const newStatusMap = new Map<string, GitStatusWithFiles>();

      await Promise.all(
        repositories
          .filter(repo => repo.path) // Only check repos with local paths
          .map(async (repo) => {
            if (!repo.path) return; // Type guard, should never happen due to filter
            try {
              const status = await RepositoryMonitoringService.getGitStatusWithFiles(repo.path);
              if (!cancelled && status) {
                newStatusMap.set(repo.path, status);
              }
            } catch (error) {
              console.error(`[ProjectsList] Failed to fetch git status for ${repo.path}:`, error);
            }
          })
      );

      if (!cancelled) {
        setGitStatusMap(newStatusMap);
      }
    };

    fetchGitStatuses();

    return () => {
      cancelled = true;
    };
  }, [repositories]);

  // Subscribe to git status changes for real-time updates
  useEffect(() => {
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
      // Update the status map when any repository's git status changes
      setGitStatusMap(prev => {
        const updated = new Map(prev);
        updated.set(status.repoPath, status);
        return updated;
      });
    });

    return unsubscribe;
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
        payload: payloadFromLocalEntry(entry),
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

    // Get all summaries and sort by most recent commit first
    let summaries = Array.from(repoMap.values()).sort(
      (a, b) => b.lastCommitTime.getTime() - a.lastCommitTime.getTime()
    );

    // Apply filter based on view mode (only for timeline views)
    if (viewMode === 'in-progress' || viewMode === 'recent') {
      summaries = summaries.filter(summary => {
        if (!summary.repoId) return false;
        const gitStatus = gitStatusMap.get(summary.repoId);

        if (viewMode === 'in-progress') {
          // Show only dirty repos
          return gitStatus && gitStatus.isDirty;
        } else if (viewMode === 'recent') {
          // Show only clean repos
          return !gitStatus || !gitStatus.isDirty;
        }

        return true;
      });
    }

    return summaries;
  }, [commits, repoGithubMap, repositories, viewMode, gitStatusMap]);

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

  // Search query for the by-org (Cloned Projects) view
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered grouped repos based on search query
  const filteredGroupedRepos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupedRepos;

    const filteredGroups = new Map<string, AlexandriaEntry[]>();
    for (const [orgName, repos] of groupedRepos.groups.entries()) {
      const matched = repos.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.github?.description?.toLowerCase().includes(q)
      );
      if (matched.length > 0) filteredGroups.set(orgName, matched);
    }

    const filteredOrgNames = groupedRepos.sortedOrgNames.filter(o =>
      filteredGroups.has(o)
    );

    return { groups: filteredGroups, sortedOrgNames: filteredOrgNames };
  }, [groupedRepos, searchQuery]);

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
      {/* View Mode Control */}
      <div
        style={{
          padding: spacing.sm,
          flexShrink: 0,
        }}
      >
        <SegmentedControl
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'by-org', label: 'Cloned Projects' },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as ProjectsViewMode)}
          theme={theme}
          variant="pill-flat"
        />
      </div>

      {/* Timeline View (for In Progress and Recent modes) */}
      {(viewMode === 'in-progress' || viewMode === 'recent') && (
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
            const gitStatus = summary.repoId ? gitStatusMap.get(summary.repoId) : null;
            return (
              <div
                key={summary.repoId}
                style={{ opacity: summary.entry ? 1 : 0.5 }}
              >
                <ProjectRepoCard
                  repo={{
                    repoName: summary.repoName,
                    ownerLogin: summary.githubOwner,
                    timeLabel: formatRelativeTime(summary.lastCommitTime),
                    isDirty: gitStatus?.isDirty ?? false,
                  }}
                  onClick={summary.entry ? () => handleRepoClick(summary.entry!) : undefined}
                />
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
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderBottom: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii?.[1] || 4,
                padding: `${spacing.xs}px ${spacing.sm}px`,
              }}
            >
              <Search size={13} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Filter repositories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.text,
                  caretColor: theme.colors.primary,
                }}
              />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: spacing.md,
            }}
          >
          {filteredGroupedRepos.sortedOrgNames.length === 0 ? (
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
            filteredGroupedRepos.sortedOrgNames.map((orgName) => {
              const repos = filteredGroupedRepos.groups.get(orgName) || [];
              const isCollapsed = collapsedOrgs.has(orgName);
              const isUserOwn = currentUser === orgName;
              const isMemberOrg = userOrgs.includes(orgName);
              const badge: 'you' | 'member' | undefined = isUserOwn
                ? 'you'
                : isMemberOrg
                  ? 'member'
                  : undefined;

              return (
                <div key={orgName} style={{ marginBottom: spacing.md }}>
                  <div style={{ marginBottom: spacing.xs }}>
                    <OrgSectionHeaderCard
                      header={{
                        orgName,
                        badge,
                        repoCount: repos.length,
                        isUntracked: orgName === 'Untracked',
                      }}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleOrgCollapsed(orgName)}
                    />
                  </div>

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
                        <OrgRepoItemCard
                          key={repo.name}
                          repo={{ name: repo.name, description: repo.github?.description }}
                          onClick={() => handleRepoClick(repo)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsList;
