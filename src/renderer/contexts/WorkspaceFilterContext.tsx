import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { MultiRepoWorkspace } from '../../shared/types/userPreferences.types';

interface WorkspaceFilterContextValue {
  selectedWorkspaceId: string | 'all';
  setSelectedWorkspaceId: (id: string | 'all') => void;
  selectedWorkspace: MultiRepoWorkspace | null;
  setSelectedWorkspace: (workspace: MultiRepoWorkspace | null) => void;
}

const WorkspaceFilterContext = createContext<WorkspaceFilterContextValue | undefined>(
  undefined,
);

export const WorkspaceFilterProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | 'all'>('all');
  const [selectedWorkspace, setSelectedWorkspace] = useState<MultiRepoWorkspace | null>(
    null,
  );

  return (
    <WorkspaceFilterContext.Provider
      value={{
        selectedWorkspaceId,
        setSelectedWorkspaceId,
        selectedWorkspace,
        setSelectedWorkspace,
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
