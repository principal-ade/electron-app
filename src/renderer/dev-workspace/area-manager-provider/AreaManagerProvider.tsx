import React from 'react';
import {
  AreaManager,
  AuxiliaryManifestStore,
  InMemoryAreaStore,
  type AreaStore,
  type AreaWorkspace,
} from '../../services/area-manager';

interface AreaManagerContextValue {
  manager: AreaManager;
  workspace: AreaWorkspace;
  isLoaded: boolean;
}

const AreaManagerContext = React.createContext<AreaManagerContextValue | null>(
  null,
);

export interface AreaManagerProviderProps {
  /** Explicit store override. Wins over `repositoryPath`. */
  store?: AreaStore;
  /**
   * Absolute repo path. When provided (and no `store` override), the provider
   * spins up an `AuxiliaryManifestStore` reading/writing
   * `<repositoryPath>/.principal-views/auxiliary.manifest.json`. When
   * null/undefined, falls back to `InMemoryAreaStore` so the provider stays
   * mountable without a repo (e.g. in storybook).
   */
  repositoryPath?: string | null;
  children: React.ReactNode;
}

export const AreaManagerProvider: React.FC<AreaManagerProviderProps> = ({
  store,
  repositoryPath,
  children,
}) => {
  const manager = React.useMemo(() => {
    const resolvedStore =
      store ??
      (repositoryPath
        ? new AuxiliaryManifestStore({ repositoryPath })
        : new InMemoryAreaStore());
    return new AreaManager(resolvedStore);
  }, [store, repositoryPath]);
  const [workspace, setWorkspace] = React.useState<AreaWorkspace>(() =>
    manager.getWorkspace(),
  );
  const [isLoaded, setIsLoaded] = React.useState(manager.isLoaded);

  React.useEffect(() => {
    let cancelled = false;
    manager
      .load()
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err) => {
        console.error('[AreaManagerProvider] load failed', err);
      });
    const unsubscribe = manager.subscribe((next) => {
      if (!cancelled) setWorkspace(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [manager]);

  const value = React.useMemo<AreaManagerContextValue>(
    () => ({ manager, workspace, isLoaded }),
    [manager, workspace, isLoaded],
  );

  return (
    <AreaManagerContext.Provider value={value}>
      {children}
    </AreaManagerContext.Provider>
  );
};

export function useAreaManager(): AreaManagerContextValue {
  const value = React.useContext(AreaManagerContext);
  if (!value) {
    throw new Error(
      'useAreaManager must be used inside an <AreaManagerProvider>',
    );
  }
  return value;
}

/**
 * Optional variant — returns null instead of throwing when no provider is
 * mounted. Use when a panel can render meaningfully without area state.
 */
export function useAreaManagerOptional(): AreaManagerContextValue | null {
  return React.useContext(AreaManagerContext);
}
