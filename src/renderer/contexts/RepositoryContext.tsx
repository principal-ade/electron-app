import React, { createContext, useContext } from 'react';

interface RepositoryContextType {
  onAddLocalRepository?: () => void;
  onAddGithubLink?: () => void;
}

const RepositoryContext = createContext<RepositoryContextType>({});

export const RepositoryProvider: React.FC<{
  children: React.ReactNode;
  onAddLocalRepository?: () => void;
  onAddGithubLink?: () => void;
}> = ({ children, onAddLocalRepository, onAddGithubLink }) => {
  return (
    <RepositoryContext.Provider
      value={{ onAddLocalRepository, onAddGithubLink }}
    >
      {children}
    </RepositoryContext.Provider>
  );
};

export const useRepositoryActions = () => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error(
      'useRepositoryActions must be used within a RepositoryProvider',
    );
  }
  return context;
};
