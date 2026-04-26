import React from 'react';

/**
 * Folder-expansion sync between the files panel and the city panel.
 *
 * The files panel owns the actual tree model (via `@pierre/trees/react`'s
 * `useFileTree`); this provider just relays:
 *   - the set of currently-expanded folder paths (for the city panel to
 *     decide which umbrella tiles to render)
 *   - a toggle callback (for the city panel to fold/unfold a folder when
 *     the user clicks a tile)
 *
 * Two contexts intentionally: a read context that any panel can consume,
 * and a write context only the files panel uses. Keeping them separate
 * prevents accidental writes from consumers that should only be reading.
 */

interface FolderExpansionReadValue {
  expandedFolders: ReadonlySet<string>;
  /** No-op when no files panel is mounted to handle the toggle. */
  toggleFolder: (folderPath: string) => void;
}

interface FolderExpansionWriteValue {
  setExpandedFolders: (next: ReadonlySet<string>) => void;
  /**
   * Register the actual toggle implementation (typically calls
   * `treeModel.getItem(path).toggle()`). Pass null on unmount to clear.
   */
  registerToggleHandler: (
    handler: ((folderPath: string) => void) | null,
  ) => void;
}

const FolderExpansionReadContext =
  React.createContext<FolderExpansionReadValue | null>(null);
const FolderExpansionWriteContext =
  React.createContext<FolderExpansionWriteValue | null>(null);

const EMPTY_SET: ReadonlySet<string> = new Set();

export const FolderExpansionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [expandedFolders, setExpandedFoldersState] =
    React.useState<ReadonlySet<string>>(EMPTY_SET);
  const toggleHandlerRef = React.useRef<
    ((folderPath: string) => void) | null
  >(null);

  const toggleFolder = React.useCallback((folderPath: string) => {
    toggleHandlerRef.current?.(folderPath);
  }, []);

  const setExpandedFolders = React.useCallback(
    (next: ReadonlySet<string>) => {
      setExpandedFoldersState(next);
    },
    [],
  );

  const registerToggleHandler = React.useCallback(
    (handler: ((folderPath: string) => void) | null) => {
      toggleHandlerRef.current = handler;
    },
    [],
  );

  const readValue = React.useMemo<FolderExpansionReadValue>(
    () => ({ expandedFolders, toggleFolder }),
    [expandedFolders, toggleFolder],
  );
  const writeValue = React.useMemo<FolderExpansionWriteValue>(
    () => ({ setExpandedFolders, registerToggleHandler }),
    [setExpandedFolders, registerToggleHandler],
  );

  return (
    <FolderExpansionReadContext.Provider value={readValue}>
      <FolderExpansionWriteContext.Provider value={writeValue}>
        {children}
      </FolderExpansionWriteContext.Provider>
    </FolderExpansionReadContext.Provider>
  );
};

/**
 * Read the current folder-expansion set + toggle callback. Returns sane
 * defaults when no provider is mounted, so consuming panels stay
 * mountable in isolation.
 */
export function useFolderExpansion(): FolderExpansionReadValue {
  const value = React.useContext(FolderExpansionReadContext);
  return value ?? { expandedFolders: EMPTY_SET, toggleFolder: () => {} };
}

/**
 * Write API for the files panel: push expansion state up and register the
 * toggle implementation. Returns null when no provider is mounted.
 */
export function useFolderExpansionWriter(): FolderExpansionWriteValue | null {
  return React.useContext(FolderExpansionWriteContext);
}
