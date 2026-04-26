import React from 'react';
import {
  CanvasFileScopeStore,
  InMemoryScopeStore,
  ScopeManager,
  type ScopeStore,
  type ScopeWorkspace,
} from '../../services/scope-manager';
import { ScopeOverlaySelectionProvider } from '../scope-overlay';

interface ScopeManagerContextValue {
  manager: ScopeManager;
  workspace: ScopeWorkspace;
  isLoaded: boolean;
}

const ScopeManagerContext = React.createContext<ScopeManagerContextValue | null>(
  null,
);

export interface ScopeManagerProviderProps {
  /**
   * Explicit store override. Wins over `repositoryPath` — useful for tests
   * and storybook.
   */
  store?: ScopeStore;
  /**
   * Absolute repo path. When provided (and no `store` override), the provider
   * spins up a CanvasFileScopeStore reading/writing
   * `<repositoryPath>/.principal-views/`. When null/undefined, falls back to
   * an InMemoryScopeStore so the provider stays mountable without a repo.
   */
  repositoryPath?: string | null;
  children: React.ReactNode;
}

export const ScopeManagerProvider: React.FC<ScopeManagerProviderProps> = ({
  store,
  repositoryPath,
  children,
}) => {
  const manager = React.useMemo(() => {
    const resolvedStore =
      store ??
      (repositoryPath
        ? new CanvasFileScopeStore({ repositoryPath })
        : new InMemoryScopeStore());
    return new ScopeManager(resolvedStore);
  }, [store, repositoryPath]);
  const [workspace, setWorkspace] = React.useState<ScopeWorkspace>(() =>
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
        console.error('[ScopeManagerProvider] load failed', err);
      });
    const unsubscribe = manager.subscribe((next) => {
      if (!cancelled) setWorkspace(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [manager]);

  const value = React.useMemo<ScopeManagerContextValue>(
    () => ({ manager, workspace, isLoaded }),
    [manager, workspace, isLoaded],
  );

  return (
    <ScopeManagerContext.Provider value={value}>
      <ScopeOverlaySelectionProvider>{children}</ScopeOverlaySelectionProvider>
    </ScopeManagerContext.Provider>
  );
};

export function useScopeManager(): ScopeManagerContextValue {
  const value = React.useContext(ScopeManagerContext);
  if (!value) {
    throw new Error(
      'useScopeManager must be used inside a <ScopeManagerProvider>',
    );
  }
  return value;
}

/**
 * Optional variant — returns null instead of throwing when no provider is
 * mounted. Use when a panel can render meaningfully without scope state.
 */
export function useScopeManagerOptional(): ScopeManagerContextValue | null {
  return React.useContext(ScopeManagerContext);
}
