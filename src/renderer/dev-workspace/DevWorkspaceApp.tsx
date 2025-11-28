/**
 * Dev Workspace App
 *
 * Main component for the dev-workspace window.
 * Uses the panel framework layout with minimal API dependencies.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DevWorkspacePanelFramework } from './DevWorkspacePanelFramework';
import { DevWorkspaceTitlebar } from './DevWorkspaceTitlebar';
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

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

export const DevWorkspaceApp: React.FC = () => {
  const windowData = useWindowData();
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();
  const [terminalImplementation, setTerminalImplementation] = useState<'industry-themed' | 'ghostty'>('ghostty');

  const repositoryPath = windowData?.repositoryPath || process.cwd();
  const repositoryName = windowData?.repositoryName || 'Dev Workspace';

  // Create a minimal repository object for the panel framework
  // The panel framework needs owner/name for terminal context
  // Must be called unconditionally (before any returns) per React hooks rules
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

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col">
      <DevWorkspaceTitlebar
        repository={repository}
        repositoryName={repositoryName}
        selectedSource={selectedSource}
        terminalImplementation={terminalImplementation}
        onToggleTerminalImplementation={handleToggleTerminalImplementation}
      />
      <div className="flex-1 overflow-hidden">
        <DevWorkspacePanelFramework
          repositoryPath={repositoryPath}
          repository={repository}
        />
      </div>
    </div>
  );
};
