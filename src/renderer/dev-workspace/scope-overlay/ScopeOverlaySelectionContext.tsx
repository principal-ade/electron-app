import React from 'react';

/**
 * UI selection state for the scope overlay. Mirrors the prototype's
 * ScopeTreeSelection — picking a row in the scope tree puts that row's
 * scope/namespace/event here, and the file-city panel reacts.
 */
export interface ScopeSelection {
  scopeName: string;
  namespaceName?: string;
  eventName?: string;
}

interface ScopeOverlaySelectionContextValue {
  selection: ScopeSelection | null;
  setSelection: (next: ScopeSelection | null) => void;
}

const ScopeOverlaySelectionContext =
  React.createContext<ScopeOverlaySelectionContextValue | null>(null);

export const ScopeOverlaySelectionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [selection, setSelection] = React.useState<ScopeSelection | null>(null);
  const value = React.useMemo(
    () => ({ selection, setSelection }),
    [selection],
  );
  return (
    <ScopeOverlaySelectionContext.Provider value={value}>
      {children}
    </ScopeOverlaySelectionContext.Provider>
  );
};

export function useScopeOverlaySelection(): ScopeOverlaySelectionContextValue {
  const value = React.useContext(ScopeOverlaySelectionContext);
  if (!value) {
    throw new Error(
      'useScopeOverlaySelection must be used inside <ScopeOverlaySelectionProvider>',
    );
  }
  return value;
}

export function useScopeOverlaySelectionOptional():
  | ScopeOverlaySelectionContextValue
  | null {
  return React.useContext(ScopeOverlaySelectionContext);
}
