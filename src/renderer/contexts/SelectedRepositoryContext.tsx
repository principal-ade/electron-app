import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';

interface SelectedRepositoryContextValue {
  selectedRepository: GitHubRepository | null;
  setSelectedRepository: (repository: GitHubRepository | null) => void;
}

const SelectedRepositoryContext = createContext<
  SelectedRepositoryContextValue | undefined
>(undefined);

export const SelectedRepositoryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedRepository, setSelectedRepositoryState] =
    useState<GitHubRepository | null>(null);

  const setSelectedRepository = useCallback(
    (repository: GitHubRepository | null) => {
      setSelectedRepositoryState(repository);
    },
    [],
  );

  return (
    <SelectedRepositoryContext.Provider
      value={{ selectedRepository, setSelectedRepository }}
    >
      {children}
    </SelectedRepositoryContext.Provider>
  );
};

export const useSelectedRepository = (): SelectedRepositoryContextValue => {
  const context = useContext(SelectedRepositoryContext);
  if (!context) {
    throw new Error(
      'useSelectedRepository must be used within a SelectedRepositoryProvider',
    );
  }
  return context;
};
