/**
 * FeedPanelFramework
 *
 * Panel framework for the FeedView, using ConfigurablePanelLayout
 * similar to DevWorkspacePanelFramework but simplified for the feed context.
 *
 * Layout:
 * - Left: ProjectsListPanel (repository list with filtering)
 * - Middle: TabbedTerminalPanel (terminal in HOME directory)
 * - Right: DetailsTabbedPanel (activity feed, profiles, etc.)
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitCommit, Users, Activity, FolderGit2, User } from 'lucide-react';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import type { PanelEventEmitter, RepositoryMetadata, PanelEvent } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../contexts/TerminalContext';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { FileCityImageService } from '../main-process-api/FileCityImageService';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
  type BaseTab,
} from '@industry-theme/xterm-terminal-panel';
import { ProjectsListPanel } from '../panels/ProjectsListPanel';
import { WatchedItemsPanel } from '../panels/WatchedItemsPanel';
import { ActivityFeedCardPanel } from '../panels/ActivityFeedCardPanel';
import { ReviewCommitPanel } from '../panels/ReviewCommitPanel';
import { ProjectInfoPanel } from '../panels/ProjectInfoPanel';
import { LiveActivityTabContent } from '../components/LiveActivityTabContent';
import { UserProfilePanel, type UserProfileData } from '../panels/UserProfilePanel';
import { useActivityFeed } from '../hooks/useActivityFeed';
import type { CommitTimestamp } from '../panels/ProjectsListPanel';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import { GithubService } from '../main-process-api/GithubService';
import { ApiProxyService } from '../main-process-api/ApiProxyService';
import { SecureAuthService } from '../services/SecureAuthService';

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

/**
 * Commit review tab - displays diff for a specific commit
 */
export interface CommitReviewTab extends BaseTab {
  contentType: 'commit-review';
  repoPath: string;
  repoName: string;
  commit: ActivityCommit;
}

/**
 * Live activity tab - displays real-time presence and repository activity
 */
export interface LiveActivityTab extends BaseTab {
  contentType: 'live-activity';
}

/**
 * Activity feed tab - displays the main activity feed with repository cards
 */
export interface ActivityFeedTab extends BaseTab {
  contentType: 'activity-feed';
}

/**
 * Project info tab - displays repository details with heatmap and file city
 */
export interface ProjectInfoTab extends BaseTab {
  contentType: 'project-info';
  repository: AlexandriaEntry;
}

/**
 * User profile tab - displays user activity and profile information
 */
export interface UserProfileTab extends BaseTab {
  contentType: 'user-profile';
  username: string;
  email?: string;
}

/**
 * Union type of all supported tab types in FeedView
 */
export type FeedTab = TerminalTab | CommitReviewTab | LiveActivityTab | ActivityFeedTab | ProjectInfoTab | UserProfileTab;

export interface FeedPanelFrameworkProps {
  /** List of repositories */
  repositories: AlexandriaEntry[];
  /** Collapsed state for left/right panels */
  collapsed: { left: boolean; right: boolean };
  /** Callback when collapsed state changes */
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  /** Panel layout configuration */
  layout: PanelLayout;
  /** Callback when layout changes */
  onLayoutChange: (layout: PanelLayout) => void;
  /** Optional panel sizes */
  panelSizes?: { left: number; middle: number; right: number };
  /** Callback when panel sizes change */
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Callback to open a repository */
  onOpenRepository?: (entry: AlexandriaEntry) => void;
  /** Feed mode */
  feedMode?: 'my-activity' | 'watched-activity';
}

interface FeedPanelFrameworkInnerProps {
  repositories: AlexandriaEntry[];
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  events: PanelEventEmitter;
  onOpenRepository?: (entry: AlexandriaEntry) => void;
  feedMode?: 'my-activity' | 'watched-activity';
}

/**
 * Inner component that uses TerminalProvider context
 */
const FeedPanelFrameworkInner: React.FC<FeedPanelFrameworkInnerProps> = ({
  repositories,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange: _onLayoutChange,
  panelSizes,
  onPanelSizesChange,
  events,
  onOpenRepository,
  feedMode = 'my-activity',
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  // Terminal context
  const { context: terminalCtx, actions: terminalActions, activityActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local collapsed state tracking
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);

  // Base directory from user preferences
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  // Time filter state for heatmap selection
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  // Tab management - Initialize with activity feed tab
  const [tabs, setTabs] = useState<FeedTab[]>([
    {
      id: 'activity-feed',
      contentType: 'activity-feed',
      label: 'Recent Activity',
    } as ActivityFeedTab,
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('activity-feed');

  // Activity feed data
  const activityFeed = useActivityFeed(repositories, 20, 10, 100);

  // Create a set of Alexandria repository paths for efficient lookup
  const alexandriaRepoPaths = useMemo(
    () => new Set(repositories.filter(r => r.path).map(r => String(r.path))),
    [repositories]
  );

  // Store refresh function in ref to avoid recreating callback
  const refreshFnRef = useRef(activityFeed.refresh);
  useEffect(() => {
    refreshFnRef.current = activityFeed.refresh;
  }, [activityFeed.refresh]);

  // Debounced refresh for git status changes
  // Longer delay (2000ms) to give git time to finalize commits and make them queryable
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshFnRef.current();
    }, 2000); // Increased to 2000ms to ensure git has finalized the commit
  }, []); // No dependencies - uses ref

  // Store Alexandria paths in ref to avoid recreating subscription
  const alexandriaRepoPathsRef = useRef(alexandriaRepoPaths);
  useEffect(() => {
    alexandriaRepoPathsRef.current = alexandriaRepoPaths;
  }, [alexandriaRepoPaths]);

  // Subscribe to git status changes across all repositories (passive - no watch acquisition)
  // We only receive events for repositories that are already being watched by other windows
  useEffect(() => {
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      (status) => {
        const repoPathStr = String(status.repoPath);
        const isAlexandria = alexandriaRepoPathsRef.current.has(repoPathStr);

        // Only refresh if this repo is in Alexandria registry
        if (isAlexandria) {
          debouncedRefresh();
          // Emit event to notify all panels that activity should refresh
          events.emit({
            type: 'feed:activity-refresh-requested',
            source: 'feed-panel-framework',
            timestamp: Date.now(),
            payload: { repoPath: repoPathStr },
          });
        }
      }
    );

    return () => {
      unsubscribe();
      // Don't clear timeout here - let it complete
    };
  }, [debouncedRefresh, events]); // Only debouncedRefresh and events

  // Load base directory from user preferences
  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    loadBaseDirectory();

    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
      },
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Transform commits for heatmap
  const heatmapCommits = useMemo<CommitTimestamp[]>(() => {
    const transformed = activityFeed.commits.map((commit) => ({
      timestamp: new Date(commit.date),
      repoId: commit.repoPath,
    }));
    return transformed;
  }, [activityFeed.commits]);

  // Listen for time filter events to update selected block
  useEffect(() => {
    const handleTimeFilter = (event: { type: string; payload: { start: Date; end: Date } | null }) => {
      if (event.type === 'feed:time-filter-changed') {
        setSelectedBlock(event.payload?.start.toISOString() ?? null);
      }
    };

    events.on('feed:time-filter-changed', handleTimeFilter);
    return () => {
      events.off('feed:time-filter-changed', handleTimeFilter);
    };
  }, [events]);

  // Listen for commit review events to open review tabs
  useEffect(() => {
    const handleCommitReview = (event: {
      type: string;
      payload: { repoPath: string; repoName: string; commit: ActivityCommit }
    }) => {
      if (event.type === 'commit:review-selected') {
        const { repoPath, repoName, commit } = event.payload;
        const tabId = `commit-review-${repoPath}-${commit.hash}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new commit review tab
        const newTab: CommitReviewTab = {
          id: tabId,
          label: `${commit.hash.substring(0, 7)} - ${repoName}`,
          contentType: 'commit-review',
          closable: true,
          repoPath,
          repoName,
          commit,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('commit:review-selected', handleCommitReview);
    return () => {
      events.off('commit:review-selected', handleCommitReview);
    };
  }, [events, tabs]);

  // Listen for live activity events to open live activity tab
  useEffect(() => {
    const handleLiveActivity = (event: { type: string }) => {
      if (event.type === 'live-activity:open') {
        const tabId = 'live-activity';

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new live activity tab
        const newTab: LiveActivityTab = {
          id: tabId,
          label: 'Live Activity',
          contentType: 'live-activity',
          closable: true,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('live-activity:open', handleLiveActivity);
    return () => {
      events.off('live-activity:open', handleLiveActivity);
    };
  }, [events, tabs]);

  // Listen for repository selection events to open project info tab
  useEffect(() => {
    const handleRepositorySelected = (event: {
      type: string;
      payload: { repository: AlexandriaEntry }
    }) => {
      if (event.type === 'feed:repository-selected') {
        const { repository } = event.payload;
        const tabId = `project-info-${repository.name}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new project info tab
        const newTab: ProjectInfoTab = {
          id: tabId,
          label: repository.name,
          contentType: 'project-info',
          closable: true,
          repository,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('feed:repository-selected', handleRepositorySelected);
    return () => {
      events.off('feed:repository-selected', handleRepositorySelected);
    };
  }, [events, tabs]);

  // Listen for user profile selection events to open user profile tab
  useEffect(() => {
    const handleUserSelected = (event: {
      type: string;
      payload: { username: string; email?: string }
    }) => {
      if (event.type === 'user:profile-selected') {
        const { username, email } = event.payload;
        const tabId = `user-profile-${username}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new user profile tab
        const newTab: UserProfileTab = {
          id: tabId,
          label: `@${username}`,
          contentType: 'user-profile',
          closable: true,
          username,
          email,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('user:profile-selected', handleUserSelected);
    return () => {
      events.off('user:profile-selected', handleUserSelected);
    };
  }, [events, tabs]);

  // Convert terminal activities to workingStates record
  const workingStates = useMemo(() => {
    const states: Record<string, TerminalWorkingState> = {};
    for (const activity of terminalActivities) {
      states[activity.sessionId] = {
        isWorking: activity.isWorking,
        message: activity.workingMessage,
        subtitle: activity.workingSubtitle,
      };
    }
    return states;
  }, [terminalActivities]);

  // Terminal context for the panel
  const terminalPanelContext = useMemo(
    () => ({
      currentScope: { type: 'workspace' as const },
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
      refresh: async () => {},
      // Terminal slice for TerminalPanelContext
      terminal: {
        scope: 'workspace' as const,
        name: 'terminal',
        data: terminalCtx.terminalSessions.map((session) => ({
          id: session.id,
          pid: 0,
          cwd: session.directory || '',
          shell: '',
          createdAt: session.createdAt || Date.now(),
          lastActivity: Date.now(),
        })),
        loading: false,
        error: null,
        refresh: async () => {},
      },
    }),
    [terminalCtx.terminalSessions, terminalCtx.terminalContext]
  );

  // Terminal directory - use baseDefaultDirectory from preferences, fallback to HOME
  const terminalDirectory = baseDefaultDirectory || process.env.HOME || '/';

  // Tab rendering callbacks
  const renderTabIcon = useCallback((tab: FeedTab) => {
    switch (tab.contentType) {
      case 'commit-review':
        return <GitCommit size={14} />;
      case 'live-activity':
        return <Users size={14} />;
      case 'activity-feed':
        return <Activity size={14} />;
      case 'project-info':
        return <FolderGit2 size={14} />;
      case 'user-profile':
        return <User size={14} />;
      default:
        return null;
    }
  }, []);

  const renderTabContent = useCallback(
    (tab: FeedTab, _isActive: boolean) => {
      switch (tab.contentType) {
        case 'commit-review': {
          const reviewTab = tab as CommitReviewTab;
          return (
            <ReviewCommitPanel
              repoPath={reviewTab.repoPath}
              repoName={reviewTab.repoName}
              commit={reviewTab.commit}
            />
          );
        }
        case 'live-activity': {
          return <LiveActivityTabContent />;
        }
        case 'activity-feed': {
          return (
            <ActivityFeedCardPanel
              repositories={repositories}
              events={events}
              onOpenRepository={onOpenRepository}
              feedMode={feedMode}
            />
          );
        }
        case 'project-info': {
          const projectTab = tab as ProjectInfoTab;
          // Wrapper component that fetches git status
          const ProjectInfoTabContent = () => {
            const [gitStatus, setGitStatus] = React.useState<GitStatusWithFiles | null>(null);
            const [gitLoading, setGitLoading] = React.useState(true);
            const repoPath = projectTab.repository.path;

            React.useEffect(() => {
              if (repoPath) {
                setGitLoading(true);
                RepositoryMonitoringService.getGitStatusWithFiles(repoPath)
                  .then(setGitStatus)
                  .catch((err) => {
                    console.error('[ProjectInfoTab] Failed to fetch git status:', err);
                    setGitStatus(null);
                  })
                  .finally(() => setGitLoading(false));
              } else {
                setGitLoading(false);
              }
            }, [repoPath]);

            // Create context with git status slice
            // AlexandriaEntry is compatible with RepositoryMetadata (has name, path, and index signature allows extras)
            const projectContext = {
              currentScope: { type: 'repository' as const, repository: projectTab.repository as unknown as RepositoryMetadata },
              slices: new Map(),
              adapters: {},
              isSliceLoading: () => false,
              refresh: async () => {
                if (repoPath) {
                  setGitLoading(true);
                  const status = await RepositoryMonitoringService.getGitStatusWithFiles(repoPath);
                  setGitStatus(status);
                  setGitLoading(false);
                }
              },
              gitStatusWithFiles: {
                scope: 'repository' as const,
                name: 'gitStatusWithFiles',
                data: gitStatus,
                loading: gitLoading,
                error: null,
                refresh: async () => {
                  if (repoPath) {
                    const status = await RepositoryMonitoringService.getGitStatusWithFiles(repoPath);
                    setGitStatus(status);
                  }
                },
              },
            };

            // Create minimal actions with getFileCityImage
            const projectActions = {
              openFile: () => {},
              openGitDiff: () => {},
              navigateToPanel: () => {},
              notifyPanels: (event: PanelEvent) => events.emit(event),
              getFileCityImage: async (repoPath: string) => {
                return FileCityImageService.getImage(repoPath);
              },
            };

            return (
              <ProjectInfoPanel
                context={projectContext}
                actions={projectActions}
                events={events}
              />
            );
          };

          return <ProjectInfoTabContent />;
        }
        case 'user-profile': {
          const userTab = tab as UserProfileTab;
          // Wrapper component for user profile
          const UserProfileTabContent = () => {
            const [userData, setUserData] = React.useState<UserProfileData | undefined>(undefined);
            const [loading, setLoading] = React.useState(true);
            const [error, setError] = React.useState<string | undefined>(undefined);

            React.useEffect(() => {
              let cancelled = false;

              const fetchUserData = async () => {
                setLoading(true);
                setError(undefined);

                try {
                  // Fetch GitHub user profile and activity data in parallel
                  const [githubUser, activityResult] = await Promise.all([
                    GithubService.getUser(userTab.username),
                    (async () => {
                      try {
                        const authService = SecureAuthService.getInstance();
                        const authResult = await authService.checkAuth();

                        if (!authResult.authenticated || !authResult.token) {
                          return null;
                        }

                        return await ApiProxyService.call<UserActivityResponse>({
                          endpoint: `https://app.principal-ade.com/api/github/user/${userTab.username}/activity?contributionDays=365&activityDays=1`,
                          method: 'GET',
                          headers: {
                            Authorization: `Bearer ${authResult.token}`,
                          },
                        });
                      } catch (err) {
                        console.error('Failed to fetch user activity:', err);
                        return null;
                      }
                    })(),
                  ]);

                  if (cancelled) return;

                  if (!githubUser) {
                    setError('User not found');
                    setLoading(false);
                    return;
                  }

                  // Extract activity data from API proxy result
                  const activityResponse = activityResult?.data;

                  // Transform contributions to activity data Map
                  const activityData = new Map<string, number>();
                  if (activityResponse?.contributions) {
                    activityResponse.contributions.forEach((contrib: { date: string; count: number }) => {
                      activityData.set(contrib.date, contrib.count);
                    });
                  }

                  // Calculate total commits from activity data
                  let totalCommits = 0;
                  activityData.forEach((count) => {
                    totalCommits += count;
                  });

                  // Cast to access fields not in GitHubUser type but present in API response
                  const githubUserExtended = githubUser as typeof githubUser & {
                    twitter_username?: string | null;
                    blog?: string | null;
                  };

                  const profileData: UserProfileData = {
                    username: githubUser.login,
                    name: githubUser.name || undefined,
                    email: githubUser.email || userTab.email,
                    avatarUrl: githubUser.avatar_url,
                    bio: githubUser.bio || undefined,
                    location: githubUser.location || undefined,
                    company: githubUser.company || undefined,
                    twitterHandle: githubUserExtended.twitter_username || undefined,
                    websiteUrl: githubUserExtended.blog || undefined,
                    activityData,
                    totalCommits,
                    totalRepos: githubUser.public_repos || 0,
                    followers: githubUser.followers || 0,
                    following: githubUser.following || 0,
                    joinedDate: githubUser.created_at || new Date().toISOString(),
                  };

                  setUserData(profileData);
                } catch (err) {
                  if (!cancelled) {
                    console.error('Failed to fetch user profile:', err);
                    setError(err instanceof Error ? err.message : 'Failed to load user profile');
                  }
                } finally {
                  if (!cancelled) {
                    setLoading(false);
                  }
                }
              };

              fetchUserData();

              return () => {
                cancelled = true;
              };
            }, []); // userTab is from outer scope and stable for this component instance

            const mockContext = {
              currentScope: { type: 'workspace' as const },
              slices: new Map(),
              adapters: {},
              isSliceLoading: () => loading,
              refresh: async () => {},
            };

            const mockActions = {
              openFile: () => {},
              openGitDiff: () => {},
              navigateToPanel: () => {},
              notifyPanels: (event: PanelEvent<unknown>) => events.emit(event),
            };

            return (
              <UserProfilePanel
                context={mockContext}
                actions={mockActions}
                events={events}
                userData={userData}
                loading={loading}
                error={error}
              />
            );
          };

          return <UserProfileTabContent />;
        }
        default:
          return null;
      }
    },
    [repositories, events, onOpenRepository, feedMode]
  );

  // Handle panel resize
  const handlePanelResize = useCallback(
    (sizes: { left: number; middle: number; right: number }) => {
      // Detect collapse via resize (only left panel now)
      const leftCollapsed = sizes.left < 5;

      if (leftCollapsed !== isLeftCollapsed) {
        setIsLeftCollapsed(leftCollapsed);
        onCollapsedChange({ left: leftCollapsed, right: false });
      }

      onPanelSizesChange?.(sizes);
    },
    [isLeftCollapsed, onCollapsedChange, onPanelSizesChange]
  );

  // Listen for terminal activity events
  useEffect(() => {
    const handleActivityChanged = (event: { type: string; payload: { sessionId: string; isWorking: boolean } }) => {
      if (event.type === 'terminal:activity-changed') {
        activityActions.updateActivity({
          sessionId: event.payload.sessionId,
          isWorking: event.payload.isWorking,
        });
      }
    };

    events.on('terminal:activity-changed', handleActivityChanged);
    return () => {
      events.off('terminal:activity-changed', handleActivityChanged);
    };
  }, [events, activityActions]);

  // Define all panels (must have 3 to position terminal in middle)
  const allPanels = useMemo(
    () => [
      {
        id: 'heatmap',
        label: feedMode === 'watched-activity' ? 'Watched' : 'Activity',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {feedMode === 'watched-activity' ? (
              <WatchedItemsPanel events={events} />
            ) : (
              <ProjectsListPanel
                commits={heatmapCommits}
                repositories={repositories}
                events={events}
                selectedBlock={selectedBlock}
              />
            )}
          </div>
        ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TabbedTerminalPanel<FeedTab>
              context={terminalPanelContext}
              actions={terminalActions as TerminalPanelActions}
              events={events}
              terminalContext={terminalCtx.terminalContext}
              directory={terminalDirectory}
              defaultScrollLocked={false}
              workingStates={workingStates}
              initialTabs={tabs}
              onTabsChange={setTabs}
              activeTabId={activeTabId}
              onActiveTabChange={setActiveTabId}
              renderTabContent={renderTabContent}
              renderTabIcon={renderTabIcon}
            />
          </div>
        ),
      },
      {
        id: 'placeholder',
        label: 'Details',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: theme.colors.background,
            }}
          />
        ),
      },
    ],
    [
      heatmapCommits,
      events,
      selectedBlock,
      terminalPanelContext,
      terminalActions,
      terminalCtx.terminalContext,
      terminalDirectory,
      workingStates,
      repositories,
      tabs,
      activeTabId,
      renderTabContent, // includes onOpenRepository
      renderTabIcon,
      feedMode,
      theme,
    ]
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <ConfigurablePanelLayout
        ref={panelLayoutRef}
        panels={allPanels}
        layout={layout}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={panelSizes || { left: 25, middle: 75, right: 0 }}
        collapsed={{ left: collapsed.left, right: true }}
        showCollapseButtons={false}
        theme={theme}
        onPanelResize={handlePanelResize}
      />
    </div>
  );
};

/**
 * FeedPanelFramework - Main component with TerminalProvider wrapper
 */
export const FeedPanelFramework: React.FC<FeedPanelFrameworkProps> = ({
  repositories,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
  panelSizes,
  onPanelSizesChange,
  events,
  onOpenRepository,
  feedMode,
}) => {
  return (
    <TerminalProvider
      repositoryPath=""
      terminalContext="terminal:feed"
      repoName="Feed"
    >
      <FeedPanelFrameworkInner
        repositories={repositories}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        layout={layout}
        onLayoutChange={onLayoutChange}
        panelSizes={panelSizes}
        onPanelSizesChange={onPanelSizesChange}
        events={events}
        onOpenRepository={onOpenRepository}
        feedMode={feedMode}
      />
    </TerminalProvider>
  );
};

export default FeedPanelFramework;
