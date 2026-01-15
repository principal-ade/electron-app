/**
 * Dev Workspace App
 *
 * Main component for the dev-workspace window.
 * Uses the panel framework layout with minimal API dependencies.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PanelLayout, QuickCommand } from '@principal-ade/panel-layouts';
import {
  AgentCommandPalette,
  useAgentCommandPalette,
} from '@principal-ade/panel-layouts';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { DevWorkspacePanelFramework } from './DevWorkspacePanelFramework';
import {
  DevWorkspaceTitlebar,
  DEFAULT_PANEL_PRESETS,
} from './DevWorkspaceTitlebar';
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import type { PackageLayer } from '@principal-ai/codebase-composition';
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

// Available panel IDs for switch command
const PANEL_IDS = [
  'terminal',
  'principalView',
  'fileCity',
  'docs',
  'gitChanges',
  'localhostBrowser',
  'localProjects',
  'codeQuality',
  'packageComposition',
  'fileEditor',
  'gitDiff',
  'mdxEditor',
  'kanban',
  'task-detail',
  'milestones',
  'skillsList',
  'agentsList',
  'githubIssues',
  'githubIssueDetail',
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
    name: 'preset',
    description: `Apply a layout preset (${DEFAULT_PANEL_PRESETS.map((p) => p.id).join(', ')})`,
    args: [
      {
        name: 'preset',
        description: 'Preset name',
        required: true,
        options: DEFAULT_PANEL_PRESETS.map((p) => p.id),
      },
    ],
  },
  {
    name: 'backlog',
    description: 'Switch left panel to backlog (kanban)',
  },
  {
    name: 'skills',
    description: 'Switch left panel to skills list',
  },
  {
    name: 'agents',
    description: 'Switch left panel to agents list',
  },
  {
    name: 'projects',
    description: 'Switch left panel to local projects',
  },
  {
    name: 'files',
    description: 'Switch left panel to file tree',
  },
  {
    name: 'issues',
    description: 'Switch left panel to GitHub issues',
  },
  {
    name: 'docs',
    description: 'Switch left panel to documentation',
  },
  {
    name: 'file-city',
    description: 'Switch right panel to file city visualization',
  },
  {
    name: 'reset',
    description: 'Reset panel sizes to defaults',
  },
  {
    name: 'storybook',
    description: 'Apply Storybook layout preset',
  },
];

/**
 * Inner content component for the dev workspace.
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

  // Single event bus for all panel communication
  const events = useMemo(() => new PanelEventBus(), []);
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();
  const [terminalImplementation, setTerminalImplementation] = useState<
    'xterm' | 'ghostty'
  >('xterm');
  const [showTerminalToggle, setShowTerminalToggle] = useState(false);
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'skillsList',
    middle: 'terminal',
    right: 'fileCity',
  });
  const [panelSizes, setPanelSizes] = useState<{ left: number; middle: number; right: number }>({
    left: 25,
    middle: 50,
    right: 25,
  });
  const [resetKey, setResetKey] = useState(0);
  const [hasGitHubFolder, setHasGitHubFolder] = useState(false);
  const [packages, setPackages] = useState<PackageLayer[]>([]);

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
        case 'preset': {
          const presetId = (args.args as string[])?.[0];
          const preset = DEFAULT_PANEL_PRESETS.find(
            (p) =>
              p.id === presetId ||
              p.name.toLowerCase().replace(/\s+/g, '-') === presetId ||
              p.name.toLowerCase().includes(presetId?.toLowerCase() || ''),
          );
          if (preset) {
            setLayout(preset.layout);
            if (preset.collapsed) {
              setCollapsed(preset.collapsed);
            }
            return { success: true, message: `Applied preset: ${preset.name}` };
          }
          return { error: `Unknown preset: ${presetId}` };
        }
        case 'backlog':
          setLayout((prev) => ({ ...prev, left: 'kanban' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to backlog' };
        case 'skills':
          setLayout((prev) => ({ ...prev, left: 'skillsList' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to skills' };
        case 'agents':
          setLayout((prev) => ({ ...prev, left: 'agentsList' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to agents' };
        case 'projects':
          setLayout((prev) => ({ ...prev, left: 'localProjects' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to projects' };
        case 'files':
          setLayout((prev) => ({ ...prev, left: 'fileCity' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to files' };
        case 'issues':
          setLayout((prev) => ({ ...prev, left: 'githubIssues' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to issues' };
        case 'docs':
          setLayout((prev) => ({ ...prev, left: 'docs' }));
          setCollapsed((prev) => ({ ...prev, left: false }));
          return { success: true, message: 'Switched to docs' };
        case 'file-city':
          setLayout((prev) => ({ ...prev, right: 'fileCity' }));
          setCollapsed((prev) => ({ ...prev, right: false }));
          return { success: true, message: 'Switched to file city' };
        case 'reset':
          setPanelSizes({ left: 25, middle: 50, right: 25 });
          setResetKey((prev) => prev + 1);
          return { success: true, message: 'Reset panel sizes' };
        case 'storybook': {
          const storybookPreset = DEFAULT_PANEL_PRESETS.find(
            (p) => p.id === 'storybook',
          );
          if (storybookPreset) {
            setLayout(storybookPreset.layout);
            if (storybookPreset.collapsed) {
              setCollapsed(storybookPreset.collapsed);
            }
            return { success: true, message: 'Applied Storybook layout' };
          }
          return { error: 'Storybook preset not found' };
        }
        default:
          return { error: `Unknown command: ${name}` };
      }
    },
    [],
  );

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
    agentAvailable: false, // No AI backend connected yet
    initialSuggestions: [
      '/backlog',
      '/skills',
      '/agents',
      '/projects',
      '/files',
      '/issues',
      '/docs',
      '/file-city',
      '/storybook',
      '/reset',
      '/preset file-editor',
      '/collapse',
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
          left: 'skillsList',
          middle: 'terminal',
          right: 'fileCity',
        });
        setCollapsed({ left: false, right: false });
      }),
      // Listen for terminal shortcut events (e.g., Cmd+Shift+P from terminal)
      events.on('terminal:shortcut', (event) => {
        console.log(
          '[DevWorkspaceApp] Received terminal:shortcut event:',
          event,
        );
        const payload = event.payload as {
          shortcut: string;
          sessionId: string;
        };
        if (payload.shortcut === 'command-palette') {
          console.log(
            '[DevWorkspaceApp] Opening command palette from terminal shortcut',
          );
          agentPalette.open();
        }
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events, agentPalette]);

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

  // Fetch packages data for Storybook detection
  useEffect(() => {
    if (!repositoryPath) return;

    const fetchPackages = async () => {
      try {
        console.log('[DevWorkspaceApp] Fetching packages for:', repositoryPath);
        const packagesData =
          await RepositoryMonitoringService.getPackages(repositoryPath);
        console.log('[DevWorkspaceApp] Received packages data:', packagesData);
        if (packagesData?.packages) {
          console.log('[DevWorkspaceApp] Setting packages:', packagesData.packages);
          setPackages(packagesData.packages);
        } else {
          console.log('[DevWorkspaceApp] No packages in response');
        }
      } catch (error) {
        console.error('[DevWorkspaceApp] Failed to fetch packages:', error);
      }
    };

    fetchPackages();
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

  // Handle task deletion requests from kanban panel
  useEffect(() => {
    if (!events) return;

    const unsubscribers = [
      // Handle delete request - actually delete the file
      events.on('task:delete-requested', async (event) => {
        const { taskId, task } = event.payload as {
          taskId: string;
          task: { filePath?: string };
        };

        console.log('[DevWorkspaceApp] Task delete requested:', {
          taskId,
          filePath: task.filePath,
        });

        try {
          // Check if we have a file path to delete
          if (!task.filePath) {
            throw new Error('Task has no file path');
          }

          // Delete the task file
          await FileSystemService.deleteFile(task.filePath);

          console.log('[DevWorkspaceApp] Task file deleted successfully:', task.filePath);

          // Emit success event
          events.emit({
            type: 'task:deleted:success',
            source: 'dev-workspace-app',
            timestamp: Date.now(),
            payload: { taskId },
          });
        } catch (error) {
          console.error('[DevWorkspaceApp] Failed to delete task:', error);

          // Emit error event
          events.emit({
            type: 'task:deleted:error',
            source: 'dev-workspace-app',
            timestamp: Date.now(),
            payload: {
              taskId,
              error: error instanceof Error ? error.message : 'Failed to delete task',
            },
          });
        }
      }),

      // Handle task deleted - switch back to kanban panel
      events.on('task:deleted', () => {
        console.log('[DevWorkspaceApp] Task deleted, switching back to kanban panel');
        setLayout((prev) => ({ ...prev, left: 'kanban' }));
        setCollapsed((prev) => ({ ...prev, left: false }));
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [events]);

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

  // Open GitHub Actions page - only available for GitHub repos with .github folder
  const handleOpenGitHubActions = useCallback(async () => {
    if (!githubInfo) return;

    const actionsUrl = `https://github.com/${githubInfo.owner}/${githubInfo.repo}/actions`;

    try {
      await window.mainProcess.shell.openExternal(actionsUrl);
    } catch (error) {
      console.error('[DevWorkspaceApp] Failed to open GitHub Actions:', error);
    }
  }, [githubInfo]);

  // Show git changes panel
  const handleShowGitChanges = useCallback(() => {
    setLayout((prev) => ({ ...prev, left: 'gitChanges' }));
    setCollapsed((prev) => ({ ...prev, left: false }));
  }, []);

  // Per-panel focus state (dims that panel)
  const [panelFocus, setPanelFocus] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  // Focus handlers - dim the panel on that side
  const handleFocusLeft = useCallback(() => {
    setPanelFocus((prev) => ({ ...prev, left: !prev.left }));
  }, []);

  const handleFocusRight = useCallback(() => {
    setPanelFocus((prev) => ({ ...prev, right: !prev.right }));
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
        onOpenGitHubActions={
          githubInfo && hasGitHubFolder ? handleOpenGitHubActions : undefined
        }
        currentLayout={
          layout as { left: string; middle: string; right: string }
        }
        onLayoutChange={(newLayout) => setLayout(newLayout)}
        onCollapsedChange={setCollapsed}
        panelSizes={panelSizes}
        onPanelSizesChange={setPanelSizes}
        repositoryPath={repositoryPath}
        panelFocus={panelFocus}
        onFocusLeft={handleFocusLeft}
        onFocusRight={handleFocusRight}
        events={events}
        packages={packages}
      />
      <div className="flex-1 overflow-hidden">
        <DevWorkspacePanelFramework
          key={resetKey}
          repositoryPath={repositoryPath}
          repository={repository}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          layout={layout}
          onLayoutChange={setLayout}
          panelSizes={panelSizes}
          onPanelSizesChange={setPanelSizes}
          events={events}
          panelFocus={panelFocus}
          onFocusLeft={handleFocusLeft}
          onFocusRight={handleFocusRight}
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

  return <DevWorkspaceContent alexandriaEntry={alexandriaEntry} />;
};
