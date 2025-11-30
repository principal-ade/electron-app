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
import { APP_BRANDING } from '../../shared/config/appBranding';

/**
 * Parse window initialization data from URL hash
 * Format: #init/{encodedJSON}
 */
function useWindowData(): { repositoryPath?: string; repositoryName?: string } | null {
  const [data, setData] = useState<{ repositoryPath?: string; repositoryName?: string } | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#init/')) {
      try {
        const encodedData = hash.slice(6); // Remove '#init/'
        const parsed = JSON.parse(decodeURIComponent(encodedData));
        setData(parsed);
      } catch (error) {
        console.error('[DevWorkspaceApp] Failed to parse window data:', error);
        setData({});
      }
    } else {
      // No init data, use defaults
      setData({});
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
  repositoryPath: string;
  repositoryName: string;
}

const DevWorkspaceContent: React.FC<DevWorkspaceContentProps> = ({
  repositoryPath,
  repositoryName,
}) => {
  const { events } = useDevWorkspaceEvents();
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();
  const [terminalImplementation, setTerminalImplementation] = useState<'industry-themed' | 'ghostty'>('ghostty');
  const [collapsed, setCollapsed] = useState({ left: false, right: true });
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'visualValidation',
    middle: 'terminal',
    right: '',
  });

  // Create a minimal repository object for the panel framework
  const repository: Repository = useMemo(() => ({
    owner: 'local',
    name: repositoryName,
    remoteUrl: '',
    vcsType: 'generic' as const,
    localClones: repositoryPath ? [{ path: repositoryPath, addedAt: Date.now() }] : [],
    addedAt: Date.now(),
  }), [repositoryPath, repositoryName]);

  // Create file tree source for the titlebar
  const selectedSource: FileTreeSource | null = useMemo(() => {
    if (!repositoryPath) return null;
    return {
      id: `local-${repositoryPath}`,
      type: 'local' as const,
      owner: 'local',
      name: repositoryName,
      remoteUrl: '',
      location: repositoryPath,
      locationType: 'working' as const,
      label: repositoryName,
      provider: 'local' as const,
      metadata: {
        currentBranch,
      },
    };
  }, [repositoryPath, repositoryName, currentBranch]);

  // Quick command handler for Agent Command Palette
  const handleQuickCommand = useCallback(async (name: string, args: Record<string, unknown>) => {
    switch (name) {
      case 'toggle': {
        const panel = (args.args as string[])?.[0];
        if (panel === 'left') {
          setCollapsed(prev => ({ ...prev, left: !prev.left }));
        } else if (panel === 'right') {
          setCollapsed(prev => ({ ...prev, right: !prev.right }));
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
          setLayout(prev => ({ ...prev, [slot]: panelName }));
        }
        return { success: true };
      }
      default:
        return { error: `Unknown command: ${name}` };
    }
  }, []);

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
          setCollapsed(prev => ({ ...prev, left: !prev.left }));
        } else if (panelId === 'right') {
          setCollapsed(prev => ({ ...prev, right: !prev.right }));
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
          setLayout(prev => ({ ...prev, [payload.slot!]: payload.panel }));
        }
      }),
      events.on('panel:reset-layout', () => {
        setLayout({ left: 'visualValidation', middle: 'terminal', right: '' });
        setCollapsed({ left: false, right: true });
      }),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [events]);

  // Load current branch on mount
  useEffect(() => {
    if (!repositoryPath) return;

    const loadBranch = async () => {
      try {
        const gitStatus = await RepositoryMonitoringService.getGitStatus(repositoryPath);
        if (gitStatus?.branch) {
          setCurrentBranch(gitStatus.branch);
        }
      } catch (error) {
        console.error('[DevWorkspaceApp] Failed to load git branch:', error);
      }
    };

    loadBranch();

    // Subscribe to git status changes
    const unsubscribe = window.mainProcess.repositoryMonitoring.onGitStatusChanged(
      (status) => {
        if (status.repoPath === repositoryPath && status.branch) {
          setCurrentBranch(status.branch);
        }
      }
    );

    return () => unsubscribe();
  }, [repositoryPath]);

  // Load terminal implementation preference and subscribe to updates
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        if (prefs.terminalImplementation === 'industry-themed' || prefs.terminalImplementation === 'ghostty') {
          setTerminalImplementation(prefs.terminalImplementation);
        }
      } catch (error) {
        console.error('[DevWorkspaceApp] Failed to load terminal preference:', error);
      }
    };
    loadPreference();

    // Subscribe to preference updates so UI stays in sync
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      if (prefs.terminalImplementation === 'industry-themed' || prefs.terminalImplementation === 'ghostty') {
        setTerminalImplementation(prefs.terminalImplementation);
      }
    });

    return unsubscribe;
  }, []);

  const handleToggleTerminalImplementation = async () => {
    const newImpl = terminalImplementation === 'ghostty' ? 'industry-themed' : 'ghostty';
    setTerminalImplementation(newImpl);
    try {
      await UserPreferencesService.updatePreferences({ terminalImplementation: newImpl });
    } catch (error) {
      console.error('[DevWorkspaceApp] Failed to save terminal preference:', error);
    }
  };

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

  // Extract GitHub owner/repo from remote URL if available
  const githubInfo = useMemo(() => {
    if (repository.remoteUrl) {
      const match = repository.remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
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
    const baseUrl = isDev ? APP_BRANDING.WEB_ADE_URL.DEVELOPMENT : APP_BRANDING.WEB_ADE_URL.PRODUCTION;

    const webAdeUrl = `${baseUrl}/editor/${githubInfo.owner}/${githubInfo.repo}`;

    try {
      await window.mainProcess.shell.openExternal(webAdeUrl);
    } catch (error) {
      console.error('[DevWorkspaceApp] Failed to open Web-ADE:', error);
    }
  }, [githubInfo]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col">
      <DevWorkspaceTitlebar
        repository={repository}
        repositoryName={repositoryName}
        selectedSource={selectedSource}
        terminalImplementation={terminalImplementation}
        onToggleTerminalImplementation={handleToggleTerminalImplementation}
        collapsed={collapsed}
        onToggleLeftSidebar={() => setCollapsed(prev => ({ ...prev, left: !prev.left }))}
        onToggleRightSidebar={() => setCollapsed(prev => ({ ...prev, right: !prev.right }))}
        onSwitchLeftMiddlePanels={handleSwitchLeftMiddle}
        onSwitchRightMiddlePanels={handleSwitchRightMiddle}
        onOpenInWebADE={githubInfo ? handleOpenInWebADE : undefined}
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
  const windowData = useWindowData();

  // Wait for window data to load
  if (windowData === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading Dev Workspace...</p>
        </div>
      </div>
    );
  }

  const repositoryPath = windowData?.repositoryPath || process.cwd();
  const repositoryName = windowData?.repositoryName || 'Dev Workspace';

  return (
    <DevWorkspaceEventProvider>
      <DevWorkspaceContent
        repositoryPath={repositoryPath}
        repositoryName={repositoryName}
      />
    </DevWorkspaceEventProvider>
  );
};
