/**
 * Dev Workspace App
 *
 * Main component for the dev-workspace window.
 * Uses the panel framework layout with minimal API dependencies.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PanelLayout } from '@principal-ade/panel-layouts';
import {
  AgentCommandPalette,
  useAgentCommandPalette,
} from '@principal-ade/panel-layouts';
import { DevWorkspacePanelFramework } from './DevWorkspacePanelFramework';
import { DevWorkspaceTitlebar } from './DevWorkspaceTitlebar';
import {
  DevWorkspaceEventProvider,
  useDevWorkspaceEvents,
} from './DevWorkspaceEventContext';
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { gitSyncConnectionManager } from '../services/git-sync/GitSyncConnectionManager';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { AlexandriaEventType } from '../../shared/main-process-api-interfaces/AlexandriaAPI';

/**
 * Alexandria entry data passed from main process
 */
interface AlexandriaEntryData {
  name: string;
  path: string;
  remoteUrl?: string;
  github?: {
    owner?: string;
    description?: string;
    avatarUrl?: string;
  };
}

/**
 * Parse window initialization data from URL hash
 * Format: #init/{encodedJSON} where JSON is an AlexandriaEntry
 */
function useWindowData(): AlexandriaEntryData | null {
  const [data, setData] = useState<AlexandriaEntryData | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#init/')) {
      try {
        const encodedData = hash.slice(6); // Remove '#init/'
        const parsed = JSON.parse(
          decodeURIComponent(encodedData),
        ) as AlexandriaEntryData;
        setData(parsed);
      } catch (error) {
        console.error('[DevWorkspaceApp] Failed to parse window data:', error);
      }
    }
  }, []);

  return data;
}

/**
 * Inner content component that has access to the event context.
 * This separation is necessary because useDevWorkspaceEvents must be
 * called inside the DevWorkspaceEventProvider.
 */
interface DevWorkspaceContentProps {
  alexandriaEntry: AlexandriaEntryData;
}

const DevWorkspaceContent: React.FC<DevWorkspaceContentProps> = ({
  alexandriaEntry,
}) => {
  const {
    name: repositoryName,
    path: repositoryPath,
    remoteUrl,
    github,
  } = alexandriaEntry;
  const { events } = useDevWorkspaceEvents();
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();
  const [terminalImplementation, setTerminalImplementation] = useState<
    'xterm' | 'ghostty'
  >('xterm');
  const [showTerminalToggle, setShowTerminalToggle] = useState(false);
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'gitChanges',
    middle: 'terminal',
    right: 'codeCity',
  });
  const [hasGitHubFolder, setHasGitHubFolder] = useState(false);

  // Create repository object from Alexandria entry data
  const repository: Repository = useMemo(
    () => ({
      owner: github?.owner || 'local',
      name: repositoryName,
      remoteUrl: remoteUrl || '',
      vcsType: 'git' as const,
      avatarUrl: github?.avatarUrl,
      localClones: repositoryPath
        ? [{ path: repositoryPath, addedAt: Date.now() }]
        : [],
      addedAt: Date.now(),
    }),
    [repositoryPath, repositoryName, remoteUrl, github],
  );

  // Create file tree source for the titlebar
  const selectedSource: FileTreeSource | null = useMemo(() => {
    if (!repositoryPath) return null;
    return {
      id: `local-${repositoryPath}`,
      type: 'local' as const,
      owner: github?.owner || 'local',
      name: repositoryName,
      remoteUrl: remoteUrl || '',
      location: repositoryPath,
      locationType: 'working' as const,
      label: repositoryName,
      provider: 'local' as const,
      metadata: {
        currentBranch,
      },
    };
  }, [repositoryPath, repositoryName, remoteUrl, github, currentBranch]);

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
        default:
          return { error: `Unknown command: ${name}` };
      }
    },
    [],
  );

  // Initialize Agent Command Palette (Alt+P to open)
  const agentPalette = useAgentCommandPalette({
    events,
    keyboard: { key: 'p', altKey: true },
    config: {
      placeholder: 'What would you like to do?',
      autoCloseDelay: 1500,
    },
    onExecuteTool: handleQuickCommand,
    initialSuggestions: [
      'hide sidebars',
      'show validation panel',
      'focus on terminal',
      'switch to visual validation',
    ],
  });

  // Listen for panel events from the Agent Command Palette
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
          left: 'dependencies',
          middle: 'terminal',
          right: 'codeCity',
        });
        setCollapsed({ left: false, right: false });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events]);

  // Monitoring status state
  const [monitoringStatus, setMonitoringStatus] = useState<{
    registered: boolean;
    gitWatching: boolean;
    loading: boolean;
    error?: string;
  }>({ registered: false, gitWatching: false, loading: true });

  // Initialize repository monitoring on mount
  useEffect(() => {
    if (!repositoryPath) return;

    const initializeMonitoring = async () => {
      setMonitoringStatus((prev) => ({
        ...prev,
        loading: true,
        error: undefined,
      }));

      try {
        // Start monitoring service if not already started
        console.log('[DevWorkspaceApp] Starting monitoring service...');
        await RepositoryMonitoringService.startMonitoring();
        console.log('[DevWorkspaceApp] Monitoring service started');

        // Register repository with monitoring service
        console.log(
          '[DevWorkspaceApp] Registering repository:',
          repositoryPath,
        );
        await RepositoryMonitoringService.registerRepository(repositoryPath);
        console.log('[DevWorkspaceApp] Repository registered successfully');

        // Enable git watching for the repository
        console.log('[DevWorkspaceApp] Enabling git watching:', repositoryPath);
        const result =
          await RepositoryMonitoringService.enableGitWatching(repositoryPath);

        if (result.success) {
          console.log('[DevWorkspaceApp] Git watching enabled successfully');
          setMonitoringStatus({
            registered: true,
            gitWatching: true,
            loading: false,
          });
        } else {
          console.warn(
            '[DevWorkspaceApp] Failed to enable git watching:',
            result.error,
          );
          setMonitoringStatus({
            registered: true,
            gitWatching: false,
            loading: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error(
          '[DevWorkspaceApp] Failed to initialize monitoring:',
          error,
        );
        setMonitoringStatus({
          registered: false,
          gitWatching: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    initializeMonitoring();
  }, [repositoryPath]);

  // Refresh monitoring status
  const refreshMonitoringStatus = useCallback(async () => {
    if (!repositoryPath) return;

    setMonitoringStatus((prev) => ({ ...prev, loading: true }));

    try {
      // Re-register and re-enable watching
      await RepositoryMonitoringService.registerRepository(repositoryPath);
      const result =
        await RepositoryMonitoringService.enableGitWatching(repositoryPath);

      setMonitoringStatus({
        registered: true,
        gitWatching: result.success,
        loading: false,
        error: result.success ? undefined : result.error,
      });
    } catch (error) {
      setMonitoringStatus((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [repositoryPath]);

  // Check for .github folder on mount
  useEffect(() => {
    if (!repositoryPath) return;

    const checkGitHubFolder = async () => {
      try {
        const fileTree =
          await RepositoryMonitoringService.getFileTree(repositoryPath);
        if (fileTree?.allFiles) {
          const hasFolder = fileTree.allFiles.some(
            (file) =>
              file.path.startsWith('.github/') ||
              file.path === '.github' ||
              file.path.includes('/.github/'),
          );
          setHasGitHubFolder(hasFolder);
        }
      } catch (error) {
        console.error(
          '[DevWorkspaceApp] Failed to check for .github folder:',
          error,
        );
      }
    };

    checkGitHubFolder();
  }, [repositoryPath]);

  // Load current branch on mount
  useEffect(() => {
    if (!repositoryPath) return;

    const loadBranch = async () => {
      try {
        const gitStatus =
          await RepositoryMonitoringService.getGitStatus(repositoryPath);
        if (gitStatus?.branch) {
          setCurrentBranch(gitStatus.branch);
        }
      } catch (error) {
        console.error('[DevWorkspaceApp] Failed to load git branch:', error);
      }
    };

    loadBranch();

    // Subscribe to git status changes
    const unsubscribe =
      window.mainProcess.repositoryMonitoring.onGitStatusChanged((status) => {
        if (status.repoPath === repositoryPath && status.branch) {
          setCurrentBranch(status.branch);
        }
      });

    return () => unsubscribe();
  }, [repositoryPath]);

  // Subscribe to Alexandria repository change events
  useEffect(() => {
    if (!repositoryPath) return;

    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      // Check if this event is for our repository
      if (event.type === AlexandriaEventType.REMOVED) {
        // Repository was removed - we could close the window or show a message
        if (event.name === repositoryName) {
          console.log(
            '[DevWorkspaceApp] Repository was removed from Alexandria registry',
          );
        }
      } else if (event.repository?.path === repositoryPath) {
        console.log(
          '[DevWorkspaceApp] Repository updated:',
          event.type,
          event.repository,
        );
        // Repository was added or updated - could refresh local state if needed
      }
    });

    return () => unsubscribe();
  }, [repositoryPath, repositoryName]);

  // Subscribe to workspace file change events
  useEffect(() => {
    if (!repositoryPath) return;

    const unsubscribe = RepositoryMonitoringService.onWorkspaceChange(
      (event) => {
        // Filter events for this repository
        if (event.repoPath !== repositoryPath) return;

        console.log('[DevWorkspaceApp] Workspace changed:', {
          repoPath: event.repoPath,
          changeCount: event.changes?.length ?? 0,
          state: event.state,
        });

        // Emit to the event bus so panels can react to file changes
        if (events) {
          events.emit({
            type: 'workspace:changed',
            source: 'DevWorkspaceApp',
            timestamp: Date.now(),
            payload: {
              repoPath: event.repoPath,
              changes: event.changes,
              state: event.state,
            },
          });
        }
      },
    );

    return () => unsubscribe();
  }, [repositoryPath, events]);

  // Auto-connect to git-sync traffic controller when workspace opens
  useEffect(() => {
    if (!repositoryPath) return;

    let isMounted = true;

    const connectToGitSync = async () => {
      // Get branch information
      const branch = currentBranch || 'main';

      try {
        console.info('[DevWorkspaceApp] Attempting to connect to git-sync:', {
          owner: github?.owner || 'local',
          name: repositoryName,
          branch,
          path: repositoryPath,
        });

        // Attempt to get/create a connection
        const client = await gitSyncConnectionManager.getConnection(
          repositoryPath,
          branch,
          {
            owner: github?.owner || 'local',
            name: repositoryName,
          },
        );

        if (isMounted && client) {
          console.info(
            '[DevWorkspaceApp] Successfully connected to git-sync room:',
            `${github?.owner || 'local'}/${repositoryName}:${branch}`,
          );
        } else if (isMounted) {
          console.warn(
            '[DevWorkspaceApp] getConnection returned null - connection not established',
          );
        }
      } catch (error) {
        // Log the error with more context
        if (isMounted) {
          console.error('[DevWorkspaceApp] Failed to connect to git-sync:', {
            error,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            repository: `${github?.owner || 'local'}/${repositoryName}`,
            branch,
          });
          // Note: We don't show toast notifications here to avoid disrupting the user
          // experience. Users can check git-sync status in the titlebar indicator.
        }
      }
    };

    // Delay connection slightly to allow window to fully initialize
    const timeoutId = setTimeout(() => {
      connectToGitSync();
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [repositoryPath, repositoryName, github?.owner, currentBranch]);

  // Load terminal implementation preference and subscribe to updates
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        if (
          prefs.terminalImplementation === 'xterm' ||
          prefs.terminalImplementation === 'ghostty'
        ) {
          setTerminalImplementation(prefs.terminalImplementation);
        }
        // Load the toggle visibility preference (default: false)
        setShowTerminalToggle(prefs.showTerminalImplementationToggle ?? false);
      } catch (error) {
        console.error(
          '[DevWorkspaceApp] Failed to load terminal preference:',
          error,
        );
      }
    };
    loadPreference();

    // Subscribe to preference updates so UI stays in sync
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      if (
        prefs.terminalImplementation === 'xterm' ||
        prefs.terminalImplementation === 'ghostty'
      ) {
        setTerminalImplementation(prefs.terminalImplementation);
      }
      if (prefs.showTerminalImplementationToggle !== undefined) {
        setShowTerminalToggle(prefs.showTerminalImplementationToggle);
      }
    });

    return unsubscribe;
  }, []);

  const handleToggleTerminalImplementation = async () => {
    const newImpl = terminalImplementation === 'ghostty' ? 'xterm' : 'ghostty';
    setTerminalImplementation(newImpl);
    try {
      await UserPreferencesService.updatePreferences({
        terminalImplementation: newImpl,
      });
    } catch (error) {
      console.error(
        '[DevWorkspaceApp] Failed to save terminal preference:',
        error,
      );
    }
  };

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

  // Extract GitHub owner/repo from remote URL if available
  const githubInfo = useMemo(() => {
    if (repository.remoteUrl) {
      const match = repository.remoteUrl.match(
        /github\.com[/:]([^/]+)\/([^/.]+)/,
      );
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }
    return null;
  }, [repository.remoteUrl]);

  // Open in Web-ADE handler - only available for GitHub repos
  const handleOpenInWebADE = useCallback(async () => {
    if (!githubInfo) return;

    // Get the base URL based on environment
    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev
      ? APP_BRANDING.WEB_ADE_URL.DEVELOPMENT
      : APP_BRANDING.WEB_ADE_URL.PRODUCTION;

    const webAdeUrl = `${baseUrl}/${githubInfo.owner}/${githubInfo.repo}`;

    try {
      await window.mainProcess.shell.openExternal(webAdeUrl);
    } catch (error) {
      console.error('[DevWorkspaceApp] Failed to open Web-ADE:', error);
    }
  }, [githubInfo]);

  // Show git changes panel
  const handleShowGitChanges = useCallback(() => {
    setLayout((prev) => ({ ...prev, left: 'gitChanges' }));
    setCollapsed((prev) => ({ ...prev, left: false }));
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col">
      <DevWorkspaceTitlebar
        repository={repository}
        repositoryOwner={github?.owner}
        repositoryName={repositoryName}
        selectedSource={selectedSource}
        onShowGitChanges={handleShowGitChanges}
        terminalImplementation={terminalImplementation}
        onToggleTerminalImplementation={
          showTerminalToggle ? handleToggleTerminalImplementation : undefined
        }
        collapsed={collapsed}
        onToggleLeftSidebar={() =>
          setCollapsed((prev) => ({ ...prev, left: !prev.left }))
        }
        onToggleRightSidebar={() =>
          setCollapsed((prev) => ({ ...prev, right: !prev.right }))
        }
        onSwitchLeftMiddlePanels={handleSwitchLeftMiddle}
        onSwitchRightMiddlePanels={handleSwitchRightMiddle}
        onOpenInWebADE={githubInfo ? handleOpenInWebADE : undefined}
        currentLayout={
          layout as { left: string; middle: string; right: string }
        }
        onLayoutChange={(newLayout) => setLayout(newLayout)}
        onCollapsedChange={setCollapsed}
        monitoringStatus={monitoringStatus}
        onRefreshMonitoring={refreshMonitoringStatus}
        repositoryPath={repositoryPath}
      />
      <div className="flex-1 overflow-hidden">
        <DevWorkspacePanelFramework
          repositoryPath={repositoryPath}
          repository={repository}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          layout={layout}
          onLayoutChange={setLayout}
        />
      </div>

      {/* Agent Command Palette - Alt+P to open */}
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
 * Main DevWorkspaceApp component.
 * Wraps the content in the event provider so hooks can access the event bus.
 */
export const DevWorkspaceApp: React.FC = () => {
  const alexandriaEntry = useWindowData();

  // Wait for window data to load
  if (alexandriaEntry === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading Dev Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <DevWorkspaceEventProvider>
      <DevWorkspaceContent alexandriaEntry={alexandriaEntry} />
    </DevWorkspaceEventProvider>
  );
};
