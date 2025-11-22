import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../main-process-api/WorkspaceService';

interface WorkspaceFilterContextValue {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  workspaces: Workspace[];
  loading: boolean;
  defaultWorkspace: Workspace | null;
}

const WorkspaceFilterContext = createContext<WorkspaceFilterContextValue | undefined>(
  undefined,
);

export const WorkspaceFilterProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultWorkspace, setDefaultWorkspace] = useState<Workspace | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        setLoading(true);
        const [allWorkspaces, defaultWs] = await Promise.all([
          WorkspaceService.getWorkspaces(),
          WorkspaceService.getDefaultWorkspace(),
        ]);
        setWorkspaces(allWorkspaces);
        setDefaultWorkspace(defaultWs);
      } catch (error) {
        console.error('[WorkspaceFilterContext] Failed to load workspaces:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaces();

    // Subscribe to workspace changes
    const unsubscribe = WorkspaceService.onWorkspaceChange(() => {
      loadWorkspaces();
    });

    return unsubscribe;
  }, []);

  return (
    <WorkspaceFilterContext.Provider
      value={{
        selectedWorkspace,
        setSelectedWorkspace,
        workspaces,
        loading,
        defaultWorkspace,
      }}
    >
      {children}
    </WorkspaceFilterContext.Provider>
  );
};

export const useWorkspaceFilter = (): WorkspaceFilterContextValue => {
  const context = useContext(WorkspaceFilterContext);
  if (!context) {
    throw new Error('useWorkspaceFilter must be used within a WorkspaceFilterProvider');
  }
  return context;
};
