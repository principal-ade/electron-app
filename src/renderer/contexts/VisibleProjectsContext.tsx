import React, { createContext, useContext, useState, useCallback } from 'react';

export interface VisibleProject {
  fullName: string; // e.g., "owner/repo"
  name: string;
  owner: string;
}

interface VisibleProjectsContextValue {
  visibleProjects: VisibleProject[];
  setVisibleProjects: (projects: VisibleProject[]) => void;
  addVisibleProject: (project: VisibleProject) => void;
  removeVisibleProject: (fullName: string) => void;
  toggleVisibleProject: (project: VisibleProject) => void;
  clearVisibleProjects: () => void;
  isProjectVisible: (fullName: string) => boolean;
}

const VisibleProjectsContext = createContext<
  VisibleProjectsContextValue | undefined
>(undefined);

export const VisibleProjectsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [visibleProjects, setVisibleProjects] = useState<VisibleProject[]>([]);

  const addVisibleProject = useCallback((project: VisibleProject) => {
    setVisibleProjects((prev) => {
      // Check if already exists
      if (prev.some((p) => p.fullName === project.fullName)) {
        return prev;
      }
      return [...prev, project];
    });
  }, []);

  const removeVisibleProject = useCallback((fullName: string) => {
    setVisibleProjects((prev) =>
      prev.filter((p) => p.fullName !== fullName),
    );
  }, []);

  const toggleVisibleProject = useCallback((project: VisibleProject) => {
    setVisibleProjects((prev) => {
      const exists = prev.some((p) => p.fullName === project.fullName);
      if (exists) {
        return prev.filter((p) => p.fullName !== project.fullName);
      }
      return [...prev, project];
    });
  }, []);

  const clearVisibleProjects = useCallback(() => {
    setVisibleProjects([]);
  }, []);

  const isProjectVisible = useCallback(
    (fullName: string) => {
      return visibleProjects.some((p) => p.fullName === fullName);
    },
    [visibleProjects],
  );

  return (
    <VisibleProjectsContext.Provider
      value={{
        visibleProjects,
        setVisibleProjects,
        addVisibleProject,
        removeVisibleProject,
        toggleVisibleProject,
        clearVisibleProjects,
        isProjectVisible,
      }}
    >
      {children}
    </VisibleProjectsContext.Provider>
  );
};

export const useVisibleProjects = (): VisibleProjectsContextValue => {
  const context = useContext(VisibleProjectsContext);
  if (!context) {
    throw new Error(
      'useVisibleProjects must be used within a VisibleProjectsProvider',
    );
  }
  return context;
};
