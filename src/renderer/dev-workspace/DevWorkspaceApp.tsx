/**
 * Dev Workspace App
 *
 * Main component for the dev-workspace window.
 * Uses the panel framework layout with minimal API dependencies.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { RepositoryWorkspacePanelFramework } from '../repo-manager/RepositoryWorkspacePanelFramework';
import type { Repository } from '../../shared/types/repository.types';

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
    <div className="h-screen w-screen overflow-hidden bg-gray-900">
      <RepositoryWorkspacePanelFramework
        repositoryPath={repositoryPath}
        repository={repository}
      />
    </div>
  );
};
