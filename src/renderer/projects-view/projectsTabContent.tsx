/**
 * projectsTabContent
 *
 * Tab-content rendering for the Projects surface, extracted from
 * ProjectsPanelFramework so the persistent WorkspaceShell can render Projects
 * tabs without the old framework.
 */

import React from 'react';
import {
  GitCommit,
  Users,
  Activity,
  FolderGit2,
  User,
  Building2,
  BookMarked,
  Radio,
  Wrench,
  Route,
  Footprints,
  FileText,
} from 'lucide-react';
import type { PanelEventEmitter, RepositoryMetadata } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  extractPurlFromRemoteUrl,
  type GithubRepository,
  type Purl,
} from '@principal-ai/alexandria-core-library';
import { AlexandriaEventType } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { findClonedGithubEntry, findEntriesByPurl, githubRepoPurl } from '../utils/alexandriaIdentity';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import type {
  SharedTrailTab,
  LocalTrailTab,
  MarkdownDocTab,
  CommitReviewTab,
  ProjectInfoTab,
  UserProfileTab,
  OrgProfileTab,
  CollectionProfileTab,
  OwnerActivityTab,
  RepoActivityTab,
  FeedTab,
} from '../events/portalTabs';
import { ActivityFeedCardPanel } from '../panels/ActivityFeedCardPanel';
import { ReviewCommitPanel } from '../panels/ReviewCommitPanel';
import { RepositoryProfilePanel, type RepositoryProfileData } from '../panels/RepositoryProfilePanel';
import { ActivityCitiesPanel } from '../panels/ActivityCitiesPanel';
import {
  UserProfilePanel,
  type UserProfilePanelContext,
  type UserProfilePanelActions,
} from '../panels/UserProfilePanel';
import {
  OrgProfilePanel,
  type OrgProfilePanelContext,
  type OrgProfilePanelActions,
} from '../panels/OrgProfilePanel';
import { useCommitHeatMap } from '../hooks/useCommitHeatMap';
import { GithubService } from '../main-process-api/GithubService';
import { GitService } from '../main-process-api/GitService';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { ApiProxyService } from '../main-process-api/ApiProxyService';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { SharedTrailTabContent } from './SharedTrailTabContent';
import { LocalTrailTabContent } from './LocalTrailTabContent';
import { SecureAuthService } from '../services/SecureAuthService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { CollectionProfilePanel } from '../panels/CollectionProfilePanel';
import { CommitActivityPanel } from '../panels/CommitActivityPanel';
import { commitActivityPanelActions } from '../panels/commitActivityPanelActions';
import { InProgressActivityPanel } from '../panels/InProgressActivityPanel';
import { inProgressActivityPanelActions } from '../panels/inProgressActivityPanelActions';
import { MarkdownDocTabContent } from './MarkdownDocTabContent';

/**
 * User activity response from Principal ADE API
 */
interface UserActivityResponse {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    followersCount: number;
  };
  activity: Array<{
    id: string;
    type: 'commit' | 'pr_merged' | 'pr_opened' | 'issue_opened';
    timestamp: string;
    repository: string;
    metadata?: {
      commitCount?: number;
      additions?: number;
      deletions?: number;
    };
  }>;
  contributions: Array<{
    date: string;
    count: number;
  }>;
  contributedRepos?: Array<{
    nameWithOwner: string;
    owner: string;
    name: string;
    commitCount: number;
    lastContributedAt: string;
  }>;
}

// `localClones` isn't on the formal AlexandriaEntry type — some entries
// carry it as a renderer-side extension. Falls back to a single-clone array
// derived from `path` when the entry has a path but no clones list.
function extractLocalClones(
  entry: AlexandriaEntry | undefined,
): Array<{ path: string; addedAt: number }> | undefined {
  if (!entry) return undefined;
  const maybeClones = (entry as { localClones?: unknown }).localClones;
  if (Array.isArray(maybeClones)) {
    return maybeClones as Array<{ path: string; addedAt: number }>;
  }
  return entry.path ? [{ path: entry.path, addedAt: Date.now() }] : undefined;
}

// Aggregates local clones across every AlexandriaEntry that shares a repo's
// purl, deduped by path. Each clone is its own path-keyed entry, so a repo with
// N clones surfaces as N entries here — flatten them into one clone list and
// keep the earliest `addedAt` per path. Returns undefined when nothing is local.
function collectLocalClones(
  entries: readonly AlexandriaEntry[],
): Array<{ path: string; addedAt: number }> | undefined {
  const byPath = new Map<string, { path: string; addedAt: number }>();
  for (const entry of entries) {
    const clones = extractLocalClones(entry);
    if (!clones) continue;
    for (const clone of clones) {
      const existing = byPath.get(clone.path);
      if (!existing || clone.addedAt < existing.addedAt) {
        byPath.set(clone.path, clone);
      }
    }
  }
  if (byPath.size === 0) return undefined;
  return Array.from(byPath.values()).sort(
    (a, b) => a.addedAt - b.addedAt || a.path.localeCompare(b.path),
  );
}

/**
 * Wrapper component for repository profile tab content
 * Extracted to prevent remounting when switching tabs
 */
const RepositoryProfileTabContent: React.FC<{
  purl: Purl;
  github?: GithubRepository;
  localEntry?: AlexandriaEntry;
  events: PanelEventEmitter;
}> = ({ purl, github, localEntry, events }) => {
  const [repositoryData, setRepositoryData] = React.useState<RepositoryProfileData | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  // Tracks the AlexandriaEntry we should render from. Seeded by the prop, but
  // upgraded in-place when an ADDED/UPDATED event arrives for this purl — so
  // a clone started from a not-yet-local profile can flip `isLocal` true
  // without the parent re-mounting us with a new prop.
  const [resolvedEntry, setResolvedEntry] = React.useState<AlexandriaEntry | undefined>(localEntry);
  React.useEffect(() => { setResolvedEntry(localEntry); }, [localEntry]);
  // Every registered clone sharing this repo's purl, aggregated from the registry.
  // The tab is seeded with a single `localEntry`, but clones are stored as
  // separate path-keyed entries — gather the siblings so all clones are listed.
  const [aggregatedClones, setAggregatedClones] = React.useState<
    Array<{ path: string; addedAt: number }> | undefined
  >(undefined);
  // Mirror of `aggregatedClones` for the change subscription: REMOVED events
  // carry only a path (no purl), so the handler matches the deleted path against
  // the clones currently shown without resubscribing on every aggregation.
  const aggregatedClonesRef = React.useRef(aggregatedClones);
  React.useEffect(() => {
    aggregatedClonesRef.current = aggregatedClones;
  }, [aggregatedClones]);

  const heatMapData = useCommitHeatMap(resolvedEntry?.path ?? null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchRepositoryData = async () => {
      setLoading(true);

      try {
        let entry: AlexandriaEntry | undefined = resolvedEntry;
        let gh: GithubRepository | undefined = github;

        // Read the whole registry and match by purl. Clones live as separate
        // path-keyed entries, so a single entry only knows about its own path —
        // matching by purl is what surfaces every clone of this repo.
        const allEntries = await AlexandriaService.getRepositories();
        if (cancelled) return;
        const matchingEntries = findEntriesByPurl(allEntries, purl);

        // On refresh (a clone was added or removed), re-resolve the entry we
        // render from against the live registry: keep the same path if it still
        // exists, otherwise fall back to any surviving clone, or drop to
        // remote-only when the last local clone is gone. Without this, deleting
        // the rendered clone would leave a stale entry pointing at a dead path.
        if (refreshTrigger > 0) {
          const survivor =
            matchingEntries.find((e) => e.path === entry?.path) ?? matchingEntries[0];
          entry = survivor;
          gh = survivor?.github ?? gh;
          if (survivor?.path !== resolvedEntry?.path) {
            setResolvedEntry(survivor);
          }
        }

        const localClones = collectLocalClones(matchingEntries);
        setAggregatedClones(localClones);

        const displayName = gh ? `${gh.owner}/${gh.name}` : (entry?.name ?? purl);

        if (gh?.owner) {
          setRepositoryData((prev) => ({
            name: entry?.name ?? gh.name,
            fullName: `${gh.owner}/${gh.name}`,
            owner: gh.owner,
            ownerAvatarUrl: `https://github.com/${gh.owner}.png`,
            description: gh.description || undefined,
            stars: 0,
            forks: 0,
            watchers: 0,
            openIssues: 0,
            size: 0,
            activityData: prev?.activityData ?? new Map(),
            totalCommits: prev?.totalCommits ?? 0,
            defaultBranch: gh.defaultBranch || 'main',
            createdAt: entry?.registeredAt || new Date().toISOString(),
            updatedAt: entry?.lastOpenedAt || new Date().toISOString(),
            htmlUrl: `https://github.com/${gh.owner}/${gh.name}`,
            isPrivate: undefined,
            isLocal: !!entry?.path,
            localClones,
            github: { ...gh },
          }));
        }

        // Fetch activity data - local or remote
        const activityData = new Map<string, number>();
        let totalCommits = 0;

        if (entry?.path) {
          heatMapData.commits.forEach((commit) => {
            activityData.set(commit.date, commit.count);
          });
          activityData.forEach((count) => {
            totalCommits += count;
          });
        } else if (gh?.owner && gh?.name) {
          try {
            const contributions = await WebAdeService.getRepoContributions(gh.owner, gh.name);
            contributions.contributions.forEach((day) => {
              activityData.set(day.date, day.count);
            });
            totalCommits = contributions.totalCommits;
            console.info('[RepositoryProfileTab] Fetched remote contributions:', contributions);
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch remote contributions:', err);
          }
        }

        let ownerType: 'User' | 'Organization' | undefined = undefined;
        let githubCreatedAt: string | undefined = undefined;
        let githubUpdatedAt: string | undefined = undefined;
        let githubDefaultBranch: string | undefined = undefined;
        let githubIsPrivate: boolean | undefined = undefined;

        if (gh?.owner && gh?.name) {
          try {
            const githubRepo = await GithubService.getRepository(gh.owner, gh.name);
            console.info('[RepositoryProfileTab] Fetched GitHub repository:', githubRepo);
            ownerType = githubRepo?.owner.type;
            githubCreatedAt = githubRepo?.created_at;
            githubUpdatedAt = githubRepo?.updated_at;
            githubDefaultBranch = githubRepo?.default_branch || undefined;
            githubIsPrivate = githubRepo?.private;
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch GitHub repository:', err);
          }
        }

        let contributors: number | undefined = undefined;
        if (entry?.path) {
          try {
            contributors = await GitService.getContributorCount(entry.path);
            console.info('[RepositoryProfileTab] Contributor count (local):', contributors);
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch contributor count:', err);
          }
        } else if (gh?.owner && gh?.name) {
          try {
            const githubContributors = await GithubService.getRepositoryContributors(gh.owner, gh.name);
            contributors = githubContributors.length;
            console.info('[RepositoryProfileTab] Contributor count (GitHub):', contributors);
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch GitHub contributors:', err);
          }
        }

        const profileData: RepositoryProfileData = {
          name: entry?.name ?? gh?.name ?? displayName,
          fullName: gh ? `${gh.owner}/${gh.name}` : displayName,
          owner: gh?.owner || 'local',
          ownerAvatarUrl: gh?.owner ? `https://github.com/${gh.owner}.png` : undefined,
          ownerType,
          description: gh?.description || undefined,
          language: undefined,
          stars: 0,
          forks: 0,
          watchers: 0,
          openIssues: 0,
          size: 0,
          activityData,
          totalCommits: totalCommits || 0,
          contributors,
          defaultBranch: githubDefaultBranch || gh?.defaultBranch || 'main',
          createdAt: githubCreatedAt || entry?.registeredAt || new Date().toISOString(),
          updatedAt: githubUpdatedAt || entry?.lastOpenedAt || new Date().toISOString(),
          htmlUrl: gh ? `https://github.com/${gh.owner}/${gh.name}` : undefined,
          isPrivate: githubIsPrivate,
          isLocal: !!entry?.path,
          localClones,
          github: gh ? {
            ...gh,
            defaultBranch: githubDefaultBranch || gh.defaultBranch || undefined,
          } : undefined,
        };

        console.info('[RepositoryProfileTab] Final profile data with ownerType:', profileData.ownerType);

        if (!cancelled) {
          setRepositoryData(profileData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[RepositoryProfileTab] Failed to fetch repository data:', err);
          setLoading(false);
        }
      }
    };

    fetchRepositoryData();

    return () => {
      cancelled = true;
    };
  }, [heatMapData.commits, purl, github, resolvedEntry, refreshTrigger]);

  // Subscribe to Alexandria repository changes to update profile in real-time
  React.useEffect(() => {
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      // A clone was deleted. REMOVED events carry only the path, so re-aggregate
      // when the removed path is one of the clones this profile is showing.
      if (event.type === AlexandriaEventType.REMOVED) {
        const removedPath = event.path;
        if (removedPath && aggregatedClonesRef.current?.some((c) => c.path === removedPath)) {
          console.info('[RepositoryProfileTab] Clone removed, refreshing profile data:', removedPath);
          setRefreshTrigger((prev) => prev + 1);
        }
        return;
      }

      if ((event.type !== AlexandriaEventType.UPDATED && event.type !== AlexandriaEventType.ADDED) || !event.repository) {
        return;
      }

      const eventEntry = event.repository;
      const eventPurl =
        eventEntry.purl ??
        eventEntry.github?.purl ??
        (eventEntry.remoteUrl ? extractPurlFromRemoteUrl(eventEntry.remoteUrl) : null) ??
        (eventEntry.github
          ? githubRepoPurl(eventEntry.github.owner, eventEntry.github.name)
          : null);

      if (eventPurl === purl) {
        console.info('[RepositoryProfileTab] Repository updated, refreshing profile data:', eventEntry.name);
        setResolvedEntry(eventEntry);
        setRefreshTrigger(prev => prev + 1);
      }
    });

    return unsubscribe;
  }, [purl]);

  // Refresh when a clone is added from the profile panel
  React.useEffect(() => {
    const handleCloneCompleted = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    events.on('repository-profile:clone-completed', handleCloneCompleted);
    return () => {
      events.off('repository-profile:clone-completed', handleCloneCompleted);
    };
  }, [events]);

  // Synchronous placeholder so projectContext.repository is never undefined
  // before the async fetch in the effect above completes.
  const placeholderProfileData = React.useMemo<RepositoryProfileData>(() => ({
    name: resolvedEntry?.name ?? github?.name ?? purl,
    fullName: github ? `${github.owner}/${github.name}` : (resolvedEntry?.name ?? purl),
    owner: github?.owner ?? 'local',
    ownerAvatarUrl: github?.owner ? `https://github.com/${github.owner}.png` : undefined,
    description: github?.description || undefined,
    stars: 0,
    forks: 0,
    watchers: 0,
    openIssues: 0,
    size: 0,
    activityData: new Map(),
    totalCommits: 0,
    defaultBranch: github?.defaultBranch || 'main',
    createdAt: resolvedEntry?.registeredAt || new Date().toISOString(),
    updatedAt: resolvedEntry?.lastOpenedAt || new Date().toISOString(),
    htmlUrl: github ? `https://github.com/${github.owner}/${github.name}` : undefined,
    isLocal: !!resolvedEntry?.path,
    localClones: aggregatedClones ?? extractLocalClones(resolvedEntry),
    github,
  }), [purl, github, resolvedEntry, aggregatedClones]);

  const projectContext = React.useMemo(() => ({
    currentScope: {
      type: 'repository' as const,
      repository: (repositoryData ?? placeholderProfileData) as unknown as RepositoryMetadata,
    },
    slices: new Map(),
    adapters: {},
    isSliceLoading: () => loading,
    refresh: async () => {},
    clearSlice: () => {},
  }), [repositoryData, placeholderProfileData, loading]);

  const projectActions = React.useMemo(() => ({
    openFile: async () => {},
    openRepository: async (path: string, remoteUrl?: string) => {
      if (!path) return;
      const existing = await AlexandriaService.getRepositoryByPath(path);
      const entry = existing ?? await AlexandriaService.registerRepository(path, remoteUrl);
      await WindowService.openDevWorkspace({
        alexandriaEntry: entry,
      });
    },
    getLocalFileTree: (repoPath: string) => {
      return RepositoryMonitoringService.getFileTree(repoPath);
    },
    getRemoteFileTree: async (owner: string, name: string) => {
      try {
        // Get latest commit
        const latestCommit = await GithubService.getLatestCommit(owner, name);
        if (!latestCommit) {
          console.warn('[projectsTabContent] No commits found for', owner, name);
          return null;
        }

        // Get file tree at that commit
        const filePaths = await GithubService.getFileTreeAtCommit(owner, name, latestCommit.sha);

        // Build file tree from paths
        const builder = new PathsFileTreeBuilder();
        const fileTree = builder.build({
          files: filePaths,
          rootPath: name,
        });

        return fileTree;
      } catch (error) {
        console.error('[projectsTabContent] Failed to fetch remote file tree:', error);
        return null;
      }
    },
    getLineCounts: async (repoPath: string) => {
      // Use main process to get line counts
      if (window.mainProcess?.fileCityImage?.countLines) {
        return await window.mainProcess.fileCityImage.countLines(repoPath);
      }
      return {};
    },

    isRepositoryStarred: async (owner: string, repo: string) => {
      return GithubService.isRepositoryStarred(owner, repo);
    },

    starRepository: async (owner: string, repo: string) => {
      await GithubService.starRepository(owner, repo);
    },

    unstarRepository: async (owner: string, repo: string) => {
      await GithubService.unstarRepository(owner, repo);
    },

    registerRepository: async (path: string, remoteUrl?: string) => {
      return AlexandriaService.registerRepository(path, remoteUrl);
    },

    getContributors: async (owner: string, repo: string) => {
      return GithubService.getRepositoryContributors(owner, repo);
    },
  }), []);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <RepositoryProfilePanel
        context={projectContext}
        actions={projectActions}
        events={events}
      />
    </div>
  );
};

/**
 * Wrapper component for user profile tab content
 * Extracted to prevent remounting when switching tabs
 */
const UserProfileTabContent: React.FC<{
  username: string;
  email?: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}> = ({ username, email, events, repositories }) => {
  const [authenticatedUser, setAuthenticatedUser] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    GithubService.getCurrentUser()
      .then((u) => {
        if (!cancelled && u?.login) setAuthenticatedUser(u.login);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Memoize context to prevent unnecessary re-renders
  const userContext: UserProfilePanelContext = React.useMemo(() => ({
    currentScope: {
      type: 'workspace' as const,
      user: {
        username,
      },
    },
    githubSyncState: {
      authenticatedUser,
      following: [],
      followers: [],
    },
    refresh: async () => {},
  }), [username, authenticatedUser]);

  // Memoize actions to prevent re-fetching on every render
  const userActions: UserProfilePanelActions = React.useMemo(() => ({
    getUserProfile: async (username: string) => {
      const githubUser = await GithubService.getUser(username);

      if (!githubUser) {
        throw new Error('User not found');
      }

      const githubUserExtended = githubUser as typeof githubUser & {
        twitter_username?: string | null;
        blog?: string | null;
      };

      return {
        username: githubUser.login,
        name: githubUser.name || undefined,
        email: githubUser.email || email,
        avatarUrl: githubUser.avatar_url,
        bio: githubUser.bio || undefined,
        location: githubUser.location || undefined,
        company: githubUser.company || undefined,
        twitterHandle: githubUserExtended.twitter_username || undefined,
        websiteUrl: githubUserExtended.blog || undefined,
        activityData: new Map(),
        totalCommits: 0,
        totalRepos: githubUser.public_repos || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        joinedDate: githubUser.created_at || new Date().toISOString(),
      };
    },

    getUserActivity: async (username: string) => {
      try {
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();

        if (!authResult.authenticated || !authResult.token) {
          return { recentCommits: [], contributions: [], contributedRepos: [] };
        }

        const activityResult = await ApiProxyService.call<UserActivityResponse>({
          endpoint: `https://app.principal-ade.com/api/github/user/${username}/activity?contributionDays=365&activityDays=1`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authResult.token}`,
          },
        });

        const activityResponse = activityResult?.data;

        // Extract contributions for heatmap
        const contributions: Array<{ date: string; count: number }> = [];
        if (activityResponse?.contributions) {
          activityResponse.contributions.forEach((contrib: { date: string; count: number }) => {
            contributions.push({ date: contrib.date, count: contrib.count });
          });
        }

        // Extract recent commits (filter activity to only commits)
        const recentCommits: Array<{
          id: string;
          timestamp: string;
          repository: string;
          repositoryUrl?: string;
          ownerType?: 'User' | 'Organization';
          isPrivate?: boolean;
          commitCount: number;
          additions?: number;
          deletions?: number;
        }> = [];

        if (activityResponse?.activity) {
          activityResponse.activity
            .filter((event) => event.type === 'commit')
            .forEach((event) => {
              recentCommits.push({
                id: event.id,
                timestamp: event.timestamp,
                repository: event.repository,
                // These fields may not be in the current interface but are optional
                repositoryUrl: undefined,
                ownerType: undefined,
                isPrivate: undefined,
                commitCount: event.metadata?.commitCount || 1,
                additions: event.metadata?.additions,
                deletions: event.metadata?.deletions,
              });
            });
        }

        // Extract contributed repos and add missing fields
        const contributedRepos: Array<{
          nameWithOwner: string;
          owner: string;
          name: string;
          url: string;
          commitCount: number;
          lastContributedAt: string;
          isPrivate: boolean;
          ownerType: 'User' | 'Organization';
        }> = (activityResponse?.contributedRepos || []).map((repo) => ({
          nameWithOwner: repo.nameWithOwner,
          owner: repo.owner,
          name: repo.name,
          url: `https://github.com/${repo.owner}/${repo.name}`,
          commitCount: repo.commitCount,
          lastContributedAt: repo.lastContributedAt,
          isPrivate: false, // API doesn't provide this, default to false
          ownerType: 'User', // API doesn't provide this, default to User
        }));

        return { recentCommits, contributions, contributedRepos };
      } catch (err) {
        console.error('Failed to fetch user activity:', err);
        return { recentCommits: [], contributions: [], contributedRepos: [] };
      }
    },

    getUserRepositories: async (username: string) => {
      try {
        const result = await GithubService.searchRepos(
          `user:${username} sort:updated`,
          { perPage: 100 }
        );

        return result.repos.map((repo) => {
          const alexandriaEntry = findClonedGithubEntry(repositories, repo.owner.login, repo.name);

          return {
            repoName: repo.name,
            repoPath: alexandriaEntry?.path,
            githubOwner: repo.owner.login,
            githubRepoName: repo.name,
            description: repo.description ?? undefined,
            language: repo.language ?? undefined,
            stars: repo.stargazers_count,
            isPrivate: repo.private,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            isOwnerOrg: false,
            topContributors: [],
            alexandriaEntry,
          };
        });
      } catch (err) {
        console.error('Failed to fetch user repositories:', err);
        return [];
      }
    },

    getRepositoryFileTree: async (owner: string, repoName: string) => {
      try {
        const treeResponse = await WebAdeService.getGithubTree(owner, repoName, 'HEAD');
        const files = treeResponse.tree
          .filter((entry) => entry.type === 'blob')
          .map((entry) => entry.path);

        const builder = new PathsFileTreeBuilder();
        return builder.build({ files, rootPath: repoName });
      } catch (err) {
        console.error(`Failed to fetch file tree for ${owner}/${repoName}:`, err);
        return null;
      }
    },

    isFollowingUser: async (username: string) => {
      return GithubService.isFollowingUser(username);
    },

    followUser: async (username: string) => {
      return GithubService.followUser(username);
    },

    unfollowUser: async (username: string) => {
      return GithubService.unfollowUser(username);
    },

    getUserOrgs: async (username: string) => {
      return GithubService.getUserOrganizationsForUser(username);
    },

    getPinnedRepositories: async (username: string) => {
      return WebAdeService.getPinnedRepositories(username);
    },

    openFile: async () => {},
  }), [email, repositories]);

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <UserProfilePanel context={userContext} actions={userActions} events={events} commitActivityActions={commitActivityPanelActions} />
    </div>
  );
};

/**
 * Wrapper component for org profile tab content
 * Extracted to prevent remounting when switching tabs
 */
const OrgProfileTabContent: React.FC<{
  orgName: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}> = ({ orgName, events, repositories }) => {
  // Memoize context to prevent unnecessary re-renders
  const orgContext: OrgProfilePanelContext = React.useMemo(() => ({
    currentScope: {
      type: 'workspace' as const,
      org: {
        orgName,
      },
    },
    refresh: async () => {},
  }), [orgName]);

  // Memoize actions to prevent re-fetching on every render
  const orgActions: OrgProfilePanelActions = React.useMemo(() => ({
    getOrgProfile: async (orgName: string) => {
      const githubOrg = await GithubService.getUser(orgName);

      if (!githubOrg) {
        throw new Error('Organization not found');
      }

      const githubOrgExtended = githubOrg as typeof githubOrg & {
        twitter_username?: string | null;
        blog?: string | null;
      };

      let memberCount = 0;
      try {
        const members = await GithubService.getOrgMembers(orgName);
        memberCount = members.length;
      } catch (error) {
        console.warn(`Failed to fetch org members for ${orgName}:`, error);
      }

      return {
        orgName: githubOrg.login,
        name: githubOrg.name || undefined,
        email: githubOrg.email || undefined,
        avatarUrl: githubOrg.avatar_url,
        description: githubOrg.bio || undefined,
        location: githubOrg.location || undefined,
        twitterHandle: githubOrgExtended.twitter_username || undefined,
        websiteUrl: githubOrgExtended.blog || undefined,
        activityData: new Map(),
        totalCommits: 0,
        publicRepos: githubOrg.public_repos || 0,
        members: memberCount,
        createdDate: githubOrg.created_at || new Date().toISOString(),
      };
    },

    getOrgActivity: async (orgName: string) => {
      try {
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();

        if (!authResult.authenticated || !authResult.token) {
          return new Map<string, number>();
        }

        const activityResult = await ApiProxyService.call<UserActivityResponse>({
          endpoint: `https://app.principal-ade.com/api/github/org/${orgName}/activity?contributionDays=365&activityDays=1`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authResult.token}`,
          },
        });

        const activityResponse = activityResult?.data;
        const activityData = new Map<string, number>();
        if (activityResponse?.contributions) {
          activityResponse.contributions.forEach((contrib: { date: string; count: number }) => {
            activityData.set(contrib.date, contrib.count);
          });
        }

        return activityData;
      } catch (err) {
        console.error('Failed to fetch org activity:', err);
        return new Map<string, number>();
      }
    },

    getOrgRepositories: async (orgName: string) => {
      try {
        const repos = await GithubService.getOrgRepositories(orgName, { perPage: 100 });

        return repos.map((repo) => {
          const alexandriaEntry = findClonedGithubEntry(repositories, repo.owner.login, repo.name);

          return {
            repoName: repo.name,
            repoPath: alexandriaEntry?.path,
            githubOwner: repo.owner.login,
            githubRepoName: repo.name,
            description: repo.description ?? undefined,
            language: repo.language ?? undefined,
            stars: repo.stargazers_count,
            isPrivate: repo.private,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            isOwnerOrg: true,
            topContributors: [],
            alexandriaEntry,
          };
        });
      } catch (err) {
        console.error('Failed to fetch org repositories:', err);
        return [];
      }
    },

    getRepositoryFileTree: async (owner: string, repoName: string) => {
      try {
        const treeResponse = await WebAdeService.getGithubTree(owner, repoName, 'HEAD');
        const files = treeResponse.tree
          .filter((entry) => entry.type === 'blob')
          .map((entry) => entry.path);

        const builder = new PathsFileTreeBuilder();
        return builder.build({ files, rootPath: repoName });
      } catch (err) {
        console.error(`Failed to fetch file tree for ${owner}/${repoName}:`, err);
        return null;
      }
    },

    getOrgMembers: async (orgName: string) => {
      return GithubService.getOrgMembers(orgName);
    },

    getPinnedRepositories: async (username: string) => {
      return WebAdeService.getPinnedRepositories(username);
    },

    openFile: async () => {},
  }), [repositories]);

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <OrgProfilePanel context={orgContext} actions={orgActions} events={events} />
    </div>
  );
};

export function renderProjectsTabIcon(tab: FeedTab): React.ReactNode {
  switch (tab.contentType) {
    case 'commit-review':
      return <GitCommit size={14} />;
    case 'live-activity':
      return <Users size={14} />;
    case 'activity-feed':
      return <Activity size={14} />;
    case 'in-progress-activity':
      return <Wrench size={14} />;
    case 'project-info':
      return <FolderGit2 size={14} />;
    case 'user-profile':
      return <User size={14} />;
    case 'org-profile':
      return <Building2 size={14} />;
    case 'collection-profile':
      return <BookMarked size={14} />;
    case 'owner-activity':
    case 'repo-activity':
      return <Radio size={14} />;
    case 'shared-trail':
      return <Route size={14} />;
    case 'local-trail':
      return <Footprints size={14} />;
    case 'markdown-doc':
      return <FileText size={14} />;
    default:
      return null;
  }
}

export function renderProjectsTabContent(
  tab: FeedTab,
  deps: {
    events: PanelEventEmitter;
    repositories: AlexandriaEntry[];
    onOpenRepository?: (entry: AlexandriaEntry) => void;
  },
): React.ReactNode {
  const { events, repositories, onOpenRepository } = deps;
  switch (tab.contentType) {
    case 'commit-review': {
      const reviewTab = tab as CommitReviewTab;
      return (
        <ReviewCommitPanel
          repoPath={reviewTab.repoPath}
          repoName={reviewTab.repoName}
          githubOwner={reviewTab.githubOwner}
          githubRepoName={reviewTab.githubRepoName}
          commit={reviewTab.commit}
        />
      );
    }
    case 'live-activity': {
      return <ActivityCitiesPanel />;
    }
    case 'activity-feed': {
      return (
        <ActivityFeedCardPanel
          key={`activity-feed-${repositories.length}`}
          repositories={repositories}
          events={events}
          onOpenRepository={onOpenRepository}
        />
      );
    }
    case 'in-progress-activity': {
      return (
        <InProgressActivityPanel
          key={`in-progress-${repositories.length}`}
          repositories={repositories}
          events={events}
          onOpenRepository={onOpenRepository}
          actions={inProgressActivityPanelActions}
        />
      );
    }
    case 'project-info': {
      const projectTab = tab as ProjectInfoTab;
      return (
        <RepositoryProfileTabContent
          key={projectTab.localEntry?.path ?? tab.id}
          purl={projectTab.purl}
          github={projectTab.github}
          localEntry={projectTab.localEntry}
          events={events}
        />
      );
    }
    case 'user-profile': {
      const userTab = tab as UserProfileTab;
      return (
        <UserProfileTabContent
          key={userTab.username}
          username={userTab.username}
          email={userTab.email}
          events={events}
          repositories={repositories}
        />
      );
    }
    case 'org-profile': {
      const orgTab = tab as OrgProfileTab;
      return (
        <OrgProfileTabContent
          key={orgTab.orgName}
          orgName={orgTab.orgName}
          events={events}
          repositories={repositories}
        />
      );
    }
    case 'collection-profile': {
      const collectionTab = tab as CollectionProfileTab;
      return (
        <CollectionProfilePanel
          key={collectionTab.collection.id}
          collection={collectionTab.collection}
          events={events}
        />
      );
    }
    case 'owner-activity': {
      const ownerTab = tab as OwnerActivityTab;
      return (
        <CommitActivityPanel
          key={ownerTab.id}
          source={{ kind: 'owner', login: ownerTab.login, accountType: ownerTab.accountType }}
          events={events}
          actions={commitActivityPanelActions}
        />
      );
    }
    case 'repo-activity': {
      const repoTab = tab as RepoActivityTab;
      return (
        <CommitActivityPanel
          key={repoTab.id}
          source={{ kind: 'repo', owner: repoTab.owner, repo: repoTab.repo }}
          events={events}
          actions={commitActivityPanelActions}
        />
      );
    }
    case 'shared-trail': {
      const trailTab = tab as SharedTrailTab;
      return (
        <SharedTrailTabContent
          key={trailTab.id}
          trailId={trailTab.trailId}
          events={events}
          repositories={repositories}
          briefSide="leading"
        />
      );
    }
    case 'local-trail': {
      const trailTab = tab as LocalTrailTab;
      return (
        <LocalTrailTabContent
          key={trailTab.id}
          trailId={trailTab.trailId}
          events={events}
        />
      );
    }
    case 'markdown-doc': {
      const docTab = tab as MarkdownDocTab;
      return (
        <MarkdownDocTabContent
          key={docTab.id}
          filePath={docTab.filePath}
          repositoryPath={docTab.repositoryPath}
          events={events}
        />
      );
    }
    default:
      return null;
  }
}
