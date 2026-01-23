import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelLayout, QuickCommand } from '@principal-ade/panel-layouts';
import {
  AgentCommandPalette,
  useAgentCommandPalette,
} from '@principal-ade/panel-layouts';

// Available panel IDs for switch command
const PANEL_IDS = [
  'workspace-repos',
  'terminal',
  'file-city',
  'code-quality',
  'package-composition',
];

// Quick commands for the command palette autocomplete
const QUICK_COMMANDS: QuickCommand[] = [
  {
    name: 'toggle',
    description: 'Toggle a sidebar panel',
    args: [
      {
        name: 'panel',
        description: 'Which panel to toggle',
        required: true,
        options: ['left', 'right'],
      },
    ],
  },
  {
    name: 'collapse',
    description: 'Collapse all sidebars',
  },
  {
    name: 'expand',
    description: 'Expand all sidebars',
  },
  {
    name: 'switch',
    description: 'Switch a panel slot to a different panel',
    args: [
      {
        name: 'slot',
        description: 'Which slot to change',
        required: true,
        options: ['left', 'middle', 'right'],
      },
      {
        name: 'panel',
        description: 'Panel to show',
        required: true,
        options: PANEL_IDS,
      },
    ],
  },
  {
    name: 'reset',
    description: 'Reset layout to default',
  },
];
import type {
  Workspace,
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AlexandriaWorkspaceTitlebar } from '../components/Titlebar';
import { AlexandriaWorkspaceLayout } from './AlexandriaWorkspaceLayout';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import {
  AlexandriaWorkspaceEventProvider,
  useAlexandriaWorkspaceEvents,
} from './AlexandriaWorkspaceEventContext';

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
  const { events } = useAlexandriaWorkspaceEvents();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceRepositories, setWorkspaceRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(false);
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'workspace-repos',
    middle: 'terminal',
    right: 'file-city',
  });

  // Track the currently selected repository
  const [selectedRepository, setSelectedRepository] = useState<
    | {
        name: string;
        path: string;
      }
    | undefined
  >(undefined);

  // Track git status for each repository by path
  const [repoGitStatuses, setRepoGitStatuses] = useState<
    Map<string, RepoGitStatus>
  >(new Map());

  // Switch handlers for panel swapping
  const handleSwitchLeftMiddle = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      left: prev.middle,
      middle: prev.left,
    }));
  }, []);

  const handleSwitchRightMiddle = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      right: prev.middle,
      middle: prev.right,
    }));
  }, []);

  // Quick command handler for Agent Command Palette
  const handleQuickCommand = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      switch (name) {
        case 'toggle': {
          const panel = (args.args as string[])?.[0];
          if (panel === 'left') {
            setCollapsed((prev) => ({ ...prev, left: !prev.left }));
          } else if (panel === 'right') {
            setCollapsed((prev) => ({ ...prev, right: !prev.right }));
          }
          return { success: true };
        }
        case 'collapse':
          setCollapsed({ left: true, right: true });
          return { success: true };
        case 'expand':
          setCollapsed({ left: false, right: false });
          return { success: true };
        case 'switch': {
          const [slot, panelName] = (args.args as string[]) || [];
          if (slot && panelName) {
            setLayout((prev) => ({ ...prev, [slot]: panelName }));
          }
          return { success: true };
        }
        case 'reset':
          setLayout({
            left: 'workspace-repos',
            middle: 'terminal',
            right: 'file-city',
          });
          setCollapsed({ left: false, right: false });
          return { success: true };
        default:
          return { error: `Unknown command: ${name}` };
      }
    },
    [],
  );

  // Event listeners for panel events from Agent Command Palette
  useEffect(() => {
    if (!events) return;

    const unsubscribers = [
      events.on('panel:toggle', (event) => {
        const payload = event.payload as { panel?: string };
        const panelId = payload.panel;
        if (panelId === 'left') {
          setCollapsed((prev) => ({ ...prev, left: !prev.left }));
        } else if (panelId === 'right') {
          setCollapsed((prev) => ({ ...prev, right: !prev.right }));
        }
      }),
      events.on('panel:collapse-all', () => {
        setCollapsed({ left: true, right: true });
      }),
      events.on('panel:expand-all', () => {
        setCollapsed({ left: false, right: false });
      }),
      events.on('panel:switch', (event) => {
        const payload = event.payload as { slot?: string; panel?: string };
        if (payload.slot && payload.panel) {
          setLayout((prev) => ({ ...prev, [payload.slot!]: payload.panel }));
        }
      }),
      events.on('panel:reset-layout', () => {
        setLayout({
          left: 'workspace-repos',
          middle: 'terminal',
          right: 'file-city',
        });
        setCollapsed({ left: false, right: false });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events]);

  // Initialize Agent Command Palette (Cmd+Shift+P to open)
  const agentPalette = useAgentCommandPalette({
    events,
    keyboard: { key: 'p', metaKey: true, shiftKey: true, altKey: false },
    config: {
      placeholder: 'Type / for commands or describe what you want',
      autoCloseDelay: 1500,
    },
    onExecuteTool: handleQuickCommand,
    quickCommands: QUICK_COMMANDS,
    agentAvailable: false,
    initialSuggestions: [
      '/toggle left',
      '/switch middle terminal',
      '/collapse',
      '/reset',
    ],
  });

  useEffect(() => {
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspaceId');
    const repositoryPath = urlParams.get('repositoryPath');
    const repositoryId = urlParams.get('repositoryId');

    // Load workspace data (either real workspace or temp single-repo mode)
    const loadWorkspace = async () => {
      try {
        setLoading(true);

        if (workspaceId) {
          // Standard workspace mode
          const workspaces = await WorkspaceService.getWorkspaces();
          const foundWorkspace = workspaces.find((w) => w.id === workspaceId);

          if (!foundWorkspace) {
            setError('Workspace not found');
          } else {
            setWorkspace(foundWorkspace);

            // Load workspace repositories
            try {
              const repos = await WorkspaceService.getRepositoriesInWorkspace(
                foundWorkspace.id,
              );
              setWorkspaceRepositories(repos);

              // Auto-select repository if specified
              if (repositoryPath) {
                const selectedRepo = repos.find((r) => r.path === repositoryPath);
                if (selectedRepo) {
                  setSelectedRepository({
                    name: selectedRepo.name,
                    path: selectedRepo.path,
                  });
                }
              }
            } catch (repoErr) {
              console.error(
                '[AlexandriaWorkspaceApp] Error loading repositories:',
                repoErr,
              );
              setWorkspaceRepositories([]);
            }
          }
        } else if (repositoryPath) {
          // Temp single-repository mode
          console.info(
            '[AlexandriaWorkspaceApp] Opening in temp mode for repository:',
            repositoryPath,
          );

          // Create a temporary workspace
          const tempWorkspace: Workspace = {
            id: `temp-${Date.now()}`,
            name: 'Repository Workspace',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setWorkspace(tempWorkspace);

          // Load the single repository from Alexandria
          try {
            const allRepos = await AlexandriaService.getRepositories();
            const repository = allRepos.find((r) => r.path === repositoryPath);

            if (repository) {
              setWorkspaceRepositories([repository]);
              // Auto-select this repository
              setSelectedRepository({
                name: repository.name,
                path: repository.path,
              });
            } else {
              console.warn(
                '[AlexandriaWorkspaceApp] Repository not found in Alexandria:',
                repositoryPath,
              );
              setWorkspaceRepositories([]);
            }
          } catch (repoErr) {
            console.error(
              '[AlexandriaWorkspaceApp] Error loading repository:',
              repoErr,
            );
            setWorkspaceRepositories([]);
          }
        } else {
          setError('No workspace ID or repository path provided');
        }
      } catch (err) {
        console.error('[AlexandriaWorkspaceApp] Error loading workspace:', err);
        setError('Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();

    // Subscribe to workspace changes (only for real workspaces, not temp mode)
    const unsubscribeWorkspace = workspaceId
      ? WorkspaceService.onWorkspaceChange((event) => {
          console.info(
            '[AlexandriaWorkspaceApp] Workspace change event received:',
            event,
          );

          if (event.workspaceId === workspaceId) {
            if (event.type === 'updated') {
              // Reload workspace metadata for 'updated' events
              console.info(
                '[AlexandriaWorkspaceApp] Workspace metadata updated, reloading',
              );
              loadWorkspace();
            } else if (event.type === 'membership-changed') {
              // Reload repositories when membership changes
              console.info(
                '[AlexandriaWorkspaceApp] Workspace membership changed, reloading repositories',
              );
              WorkspaceService.getRepositoriesInWorkspace(workspaceId)
                .then((repos) => {
                  setWorkspaceRepositories(repos);
                })
                .catch((err) => {
                  console.error(
                    '[AlexandriaWorkspaceApp] Error reloading repositories:',
                    err,
                  );
                });
            }
          }
        })
      : () => {}; // No-op for temp mode

    // Subscribe to Alexandria repository changes to handle stale references
    // This catches cases where a repository is moved/updated from another workspace window
    const unsubscribeAlexandria = AlexandriaService.onRepositoryChange(
      (event) => {
        if (event.type === 'updated' && event.repository) {
          // Check if this repository is in our workspace and update it if so
          setWorkspaceRepositories((prevRepos) => {
            const repoIndex = prevRepos.findIndex(
              (r) =>
                r.name === event.repository?.name ||
                r.github?.id === event.repository?.github?.id,
            );
            if (repoIndex !== -1) {
              console.info(
                '[AlexandriaWorkspaceApp] Repository updated, refreshing local state:',
                event.repository?.name,
              );
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
              console.info(
                '[AlexandriaWorkspaceApp] Repository removed, updating local state:',
                event.name,
              );
            }
            return filtered;
          });
        }
      },
    );

    return () => {
      unsubscribeWorkspace();
      unsubscribeAlexandria();
    };
  }, []);

  // Fetch git status for workspace repositories
  // Watch lifecycle is managed by main process window handlers
  useEffect(() => {
    if (workspaceRepositories.length === 0) return;

    const fetchGitStatuses = async () => {
      for (const repo of workspaceRepositories) {
        if (!repo.path) continue;

        try {
          const gitStatus = await RepositoryMonitoringService.getGitStatus(
            repo.path,
          );
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
        } catch (err) {
          console.error(
            '[AlexandriaWorkspaceApp] Failed to fetch git status:',
            repo.path,
            err,
          );
        }
      }
    };

    fetchGitStatuses();
  }, [workspaceRepositories]);

  // Subscribe to git status changes for all workspace repositories
  useEffect(() => {
    if (workspaceRepositories.length === 0) return;

    const repoPaths = new Set(workspaceRepositories.map((r) => r.path));

    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      (status) => {
        // Only handle events for repositories in this workspace
        if (
          !repoPaths.has(
            status.repoPath as (typeof workspaceRepositories)[0]['path'],
          )
        )
          return;

        console.log(
          '[AlexandriaWorkspaceApp] Git status changed:',
          status.repoPath,
          status.branch,
        );

        setRepoGitStatuses((prev) => {
          const next = new Map(prev);
          next.set(status.repoPath, {
            branch: status.branch,
            ahead: status.ahead,
            behind: status.behind,
          });
          return next;
        });
      },
    );

    return () => unsubscribe();
  }, [workspaceRepositories]);

  // Subscribe to workspace file changes
  useEffect(() => {
    if (workspaceRepositories.length === 0) return;

    const repoPaths = new Set(workspaceRepositories.map((r) => r.path));

    const unsubscribe = RepositoryMonitoringService.onWorkspaceChange(
      (event) => {
        // Only handle events for repositories in this workspace
        if (
          !repoPaths.has(
            event.repoPath as (typeof workspaceRepositories)[0]['path'],
          )
        )
          return;

        console.log('[AlexandriaWorkspaceApp] Workspace changed:', {
          repoPath: event.repoPath,
          changeCount: event.changes?.length ?? 0,
          state: event.state,
        });

        // Could emit to a panel event bus here if needed for child panels
      },
    );

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
          .map((entry) => entry.github?.id)
          .filter((id): id is string => id != null)}
        selectedRepository={selectedRepository}
        enableKeyboardShortcuts={enableKeyboardShortcuts}
        onToggleKeyboardShortcuts={() =>
          setEnableKeyboardShortcuts(!enableKeyboardShortcuts)
        }
        collapsed={collapsed}
        onToggleLeftSidebar={() =>
          setCollapsed((prev) => ({ ...prev, left: !prev.left }))
        }
        onToggleRightSidebar={() =>
          setCollapsed((prev) => ({ ...prev, right: !prev.right }))
        }
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

      {/* Agent Command Palette - Cmd+Shift+P to open */}
      <AgentCommandPalette
        palette={agentPalette}
        config={{
          placeholder: 'What would you like to do?',
        }}
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
  const [workspaceTheme, setWorkspaceTheme] = useState<string | undefined>(
    undefined,
  );
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
        console.error(
          '[AlexandriaWorkspaceApp] Error loading workspace theme:',
          error,
        );
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
        <AlexandriaWorkspaceEventProvider>
          <AlexandriaWorkspaceContent />
        </AlexandriaWorkspaceEventProvider>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};
