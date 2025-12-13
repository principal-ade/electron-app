import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

interface PanelFocusContextValue {
  focusReadmePanel: () => void;
  middlePanelActiveTab: number;
  setMiddlePanelActiveTab: (index: number) => void;
}

const PanelFocusContext = createContext<PanelFocusContextValue | undefined>(
  undefined,
);

export const PanelFocusProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [middlePanelActiveTab, setMiddlePanelActiveTab] = useState(0);

  const focusReadmePanel = useCallback(() => {
    // README panel is at index 2 in the middle panel
    // ['workspace-entries', 'graph-view', 'readme-viewer']
    setMiddlePanelActiveTab(2);
  }, []);

  return (
    <PanelFocusContext.Provider
      value={{
        focusReadmePanel,
        middlePanelActiveTab,
        setMiddlePanelActiveTab,
      }}
    >
      {children}
    </PanelFocusContext.Provider>
  );
};

export const usePanelFocus = (): PanelFocusContextValue => {
  const context = useContext(PanelFocusContext);
  if (!context) {
    throw new Error('usePanelFocus must be used within a PanelFocusProvider');
  }
  return context;
};
