import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelLayout } from '@principal-ade/panel-layouts';
import type { Workspace, AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AlexandriaWorkspaceTitlebar } from '../components/Titlebar';
import { AlexandriaWorkspaceLayout } from './AlexandriaWorkspaceLayout';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';

/**
 * Alexandria Workspace Window Content
 *
 * This component handles the workspace data loading and rendering.
 */
/** Git status info for a repository */
interface RepoGitStatus {
  branch?: string;
  ahead?: number;
  behind?: number;
  staged?: number;
  unstaged?: number;
}

const AlexandriaWorkspaceContent: React.FC = () => {
  const { theme } = useTheme();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceRepositories, setWorkspaceRepositories] = useState<AlexandriaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(false);
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'workspace-repos',
    middle: 'terminal',
    right: 'code-city',
  });

  // Track the currently selected repository
  const [selectedRepository, setSelectedRepository] = useState<{
    name: string;
    path: string;
  } | undefined>(undefined);

  // Track git status for each repository by path
  const [repoGitStatuses, setRepoGitStatuses] = useState<Map<string, RepoGitStatus>>(new Map());

  // Track which repositories have been registered for monitoring
  const registeredReposRef = useRef<Set<string>>(new Set());

  // Switch handlers for panel swapping
  const handleSwitchLeftMiddle = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      left: prev.middle,
      middle: prev.left,
    }));
  }, []);

  const handleSwitchRightMiddle = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      right: prev.middle,
      middle: prev.right,
    }));
  }, []);

  useEffect(() => {
    // Get workspace ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspaceId');

    if (!workspaceId) {
      setError('No workspace ID provided');
      setLoading(false);
      return;
    }

    // Load workspace data
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const workspaces = await WorkspaceService.getWorkspaces();
        const foundWorkspace = workspaces.find((w) => w.id === workspaceId);

        if (!foundWorkspace) {
          setError('Workspace not found');
        } else {
          setWorkspace(foundWorkspace);

          // Load workspace repositories
          try {
            const repos = await WorkspaceService.getRepositoriesInWorkspace(foundWorkspace.id);
            setWorkspaceRepositories(repos);
          } catch (repoErr) {
            console.error('[AlexandriaWorkspaceApp] Error loading repositories:', repoErr);
            setWorkspaceRepositories([]);
          }
        }
      } catch (err) {
        console.error('[AlexandriaWorkspaceApp] Error loading workspace:', err);
        setError('Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();

    // Subscribe to workspace changes
    const unsubscribeWorkspace = WorkspaceService.onWorkspaceChange((event) => {
      console.info('[AlexandriaWorkspaceApp] Workspace change event received:', event);

      if (event.workspaceId === workspaceId) {
        if (event.type === 'updated') {
          // Reload workspace metadata for 'updated' events
          console.info('[AlexandriaWorkspaceApp] Workspace metadata updated, reloading');
          loadWorkspace();
        } else if (event.type === 'membership-changed') {
          // Reload repositories when membership changes
          console.info('[AlexandriaWorkspaceApp] Workspace membership changed, reloading repositories');
          WorkspaceService.getRepositoriesInWorkspace(workspaceId)
            .then((repos) => {
              setWorkspaceRepositories(repos);
            })
            .catch((err) => {
              console.error('[AlexandriaWorkspaceApp] Error reloading repositories:', err);
            });
        }
      }
    });

    // Subscribe to Alexandria repository changes to handle stale references
    // This catches cases where a repository is moved/updated from another workspace window
    const unsubscribeAlexandria = AlexandriaService.onRepositoryChange((event) => {
      if (event.type === 'updated' && event.repository) {
        // Check if this repository is in our workspace and update it if so
        setWorkspaceRepositories((prevRepos) => {
          const repoIndex = prevRepos.findIndex(
            (r) => r.name === event.repository?.name || r.github?.id === event.repository?.github?.id
          );
          if (repoIndex !== -1) {
            console.info('[AlexandriaWorkspaceApp] Repository updated, refreshing local state:', event.repository?.name);
            const newRepos = [...prevRepos];
            newRepos[repoIndex] = event.repository as AlexandriaEntry;
            return newRepos;
          }
          return prevRepos;
        });
      } else if (event.type === 'removed' && event.name) {
        // Remove the repository from our local state if it was deleted
        setWorkspaceRepositories((prevRepos) => {
          const filtered = prevRepos.filter((r) => r.name !== event.name);
          if (filtered.length !== prevRepos.length) {
            console.info('[AlexandriaWorkspaceApp] Repository removed, updating local state:', event.name);
          }
          return filtered;
        });
      }
    });

    return () => {
      unsubscribeWorkspace();
      unsubscribeAlexandria();
    };
  }, []);

  // Register workspace repositories for monitoring and enable git watching
  useEffect(() => {
    if (workspaceRepositories.length === 0) return;

    const initializeMonitoring = async () => {
      // Start monitoring service if not already started
      try {
        await RepositoryMonitoringService.startMonitoring();
      } catch (err) {
        console.error('[AlexandriaWorkspaceApp] Failed to start monitoring service:', err);
        return;
      }

      // Register each repository and enable git watching
      for (const repo of workspaceRepositories) {
        if (!repo.path || registeredReposRef.current.has(repo.path)) continue;

        try {
          await RepositoryMonitoringService.registerRepository(repo.path);
          await RepositoryMonitoringService.enableGitWatching(repo.path);
          registeredReposRef.current.add(repo.path);

          // Fetch initial git status
          const gitStatus = await RepositoryMonitoringService.getGitStatus(repo.path);
          if (gitStatus) {
            setRepoGitStatuses((prev) => {
              const next = new Map(prev);
              next.set(repo.path, {
                branch: gitStatus.branch,
                ahead: gitStatus.ahead,
                behind: gitStatus.behind,
              });
              return next;
            });
          }

          console.info('[AlexandriaWorkspaceApp] Registered repository for monitoring:', repo.path);
        } catch (err) {
          console.error('[AlexandriaWorkspaceApp] Failed to register repository:', repo.path, err);
        }
      }
    };

    initializeMonitoring();

    // Cleanup: unregister repositories when component unmounts
    return () => {
      for (const repoPath of registeredReposRef.current) {
        RepositoryMonitoringService.disableGitWatching(repoPath).catch((err) => {
          console.error('[AlexandriaWorkspaceApp] Failed to disable git watching:', repoPath, err);
        });
      }
      registeredReposRef.current.clear();
    };
  }, [workspaceRepositories]);

  // Subscribe to git status changes for all workspace repositories
  useEffect(() => {
    if (workspaceRepositories.length === 0) return;

    const repoPaths = new Set(workspaceRepositories.map((r) => r.path));

    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
      // Only handle events for repositories in this workspace
      if (!repoPaths.has(status.repoPath as typeof workspaceRepositories[0]['path'])) return;

      console.log('[AlexandriaWorkspaceApp] Git status changed:', status.repoPath, status.branch);

      setRepoGitStatuses((prev) => {
        const next = new Map(prev);
        next.set(status.repoPath, {
          branch: status.branch,
          ahead: status.ahead,
          behind: status.behind,
        });
        return next;
      });
    });

    return () => unsubscribe();
  }, [workspaceRepositories]);

  // Subscribe to workspace file changes
  useEffect(() => {
    if (workspaceRepositories.length === 0) return;

    const repoPaths = new Set(workspaceRepositories.map((r) => r.path));

    const unsubscribe = RepositoryMonitoringService.onWorkspaceChange((event) => {
      // Only handle events for repositories in this workspace
      if (!repoPaths.has(event.repoPath as typeof workspaceRepositories[0]['path'])) return;

      console.log('[AlexandriaWorkspaceApp] Workspace changed:', {
        repoPath: event.repoPath,
        changeCount: event.changes?.length ?? 0,
        state: event.state,
      });

      // Could emit to a panel event bus here if needed for child panels
    });

    return () => unsubscribe();
  }, [workspaceRepositories]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              marginBottom: '16px',
              fontSize: `${theme.fontSizes[3]}px`,
            }}
          >
            Loading workspace...
          </div>
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        <div
          style={{
            borderRadius: '8px',
            border: `1px solid ${theme.colors.error}`,
            backgroundColor: `${theme.colors.error}20`,
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              marginBottom: '8px',
              fontSize: `${theme.fontSizes[4]}px`,
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.error,
            }}
          >
            Error
          </h2>
          <p style={{ color: theme.colors.text }}>
            {error || 'Workspace not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Custom Titlebar */}
      <AlexandriaWorkspaceTitlebar
        workspace={workspace}
        workspaceRepositoryIds={workspaceRepositories
          .map(entry => entry.github?.id)
          .filter((id): id is string => id != null)
        }
        selectedRepository={selectedRepository}
        enableKeyboardShortcuts={enableKeyboardShortcuts}
        onToggleKeyboardShortcuts={() => setEnableKeyboardShortcuts(!enableKeyboardShortcuts)}
        collapsed={collapsed}
        onToggleLeftSidebar={() => setCollapsed(prev => ({ ...prev, left: !prev.left }))}
        onToggleRightSidebar={() => setCollapsed(prev => ({ ...prev, right: !prev.right }))}
        onCollapsedChange={setCollapsed}
        onSwitchLeftMiddlePanels={handleSwitchLeftMiddle}
        onSwitchRightMiddlePanels={handleSwitchRightMiddle}
        layout={layout}
        onLayoutChange={setLayout}
      />

      {/* Main Content - Panel Layout */}
      <AlexandriaWorkspaceLayout
        workspace={workspace}
        enableKeyboardShortcuts={enableKeyboardShortcuts}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        layout={layout}
        onLayoutChange={setLayout}
        onRepositorySelected={setSelectedRepository}
      />
    </div>
  );
};

/**
 * Alexandria Workspace Window
 *
 * This window provides a dedicated interface for managing a single workspace
 * and its repository members.
 */
export const AlexandriaWorkspaceApp: React.FC = () => {
  const [workspaceTheme, setWorkspaceTheme] = useState<string | undefined>(undefined);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);

  useEffect(() => {
    // Get workspace ID from URL and load its theme
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspaceId');

    if (!workspaceId) {
      setIsLoadingWorkspace(false);
      return;
    }

    const loadWorkspaceTheme = async () => {
      try {
        const workspaces = await WorkspaceService.getWorkspaces();
        const workspace = workspaces.find((w) => w.id === workspaceId);

        if (workspace?.theme) {
          setWorkspaceTheme(workspace.theme);
        }
      } catch (error) {
        console.error('[AlexandriaWorkspaceApp] Error loading workspace theme:', error);
      } finally {
        setIsLoadingWorkspace(false);
      }
    };

    loadWorkspaceTheme();

    // Subscribe to workspace changes to update theme if workspace is edited
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      // Check both event.workspaceId and event.workspace?.id since the event
      // structure varies depending on the event type
      const eventWorkspaceId = event.workspaceId || event.workspace?.id;
      if (event.type === 'updated' && eventWorkspaceId === workspaceId) {
        loadWorkspaceTheme();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Show minimal loading state while determining workspace theme
  if (isLoadingWorkspace) {
    return null; // Or a minimal loading spinner
  }

  return (
    <CustomThemeProvider workspaceThemeName={workspaceTheme}>
      <GlobalFeedbackProvider>
        <AlexandriaWorkspaceContent />
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};
