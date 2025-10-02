import { useState, useEffect, useCallback, useRef } from 'react';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface PanelSizes {
  left: number;
  middle: number;
  right: number;
}

export interface PanelCollapsed {
  left?: boolean;
  right?: boolean;
}

export interface TwoPanelSizes {
  left: number;
  right: number;
}

interface ThreePanelPersistence {
  type: 'three-panel';
  sizes: PanelSizes;
  collapsed: PanelCollapsed;
  handlePanelResize: (sizes: PanelSizes) => void;
  handleLeftCollapseComplete: () => Promise<void>;
  handleLeftExpandComplete: () => Promise<void>;
  handleRightCollapseComplete: () => Promise<void>;
  handleRightExpandComplete: () => Promise<void>;
}

interface TwoPanelPersistence {
  type: 'two-panel';
  sizes: TwoPanelSizes;
  collapsed: { left?: boolean };
  handlePanelResize: (sizes: TwoPanelSizes) => void;
  handleLeftCollapseComplete: () => Promise<void>;
  handleLeftExpandComplete: () => Promise<void>;
}

type PanelPersistence = ThreePanelPersistence | TwoPanelPersistence;

interface UsePanelPersistenceOptions {
  viewKey: 'repositoryExplorer' | 'roomsManager' | 'terminalManager' | 'authView';
  defaultSizes: PanelSizes | TwoPanelSizes;
  collapsed: PanelCollapsed | { left?: boolean }; // Initial collapsed state
  panelType: 'three-panel' | 'two-panel';
}

/**
 * Hook for persisting panel layouts across sessions
 * Loads panel state from UserPreferences and saves changes automatically
 */
export function usePanelPersistence(options: UsePanelPersistenceOptions): PanelPersistence {
  const { viewKey, defaultSizes, panelType } = options;

  const [sizes, setSizes] = useState(defaultSizes);
  const [collapsed, setCollapsed] = useState(options.collapsed);
  const prevCollapsedRef = useRef(options.collapsed);

  // Update sizes when defaultSizes changes (parent has loaded preferences)
  useEffect(() => {
    setSizes(defaultSizes);
  }, [defaultSizes]);

  // Sync with parent's collapsed state (e.g., from titlebar buttons)
  // This will now properly detect changes since we're using options.collapsed
  useEffect(() => {
    const leftChanged = options.collapsed.left !== prevCollapsedRef.current.left;
    const rightChanged =
      'right' in options.collapsed &&
      'right' in prevCollapsedRef.current &&
      (options.collapsed as PanelCollapsed).right !== (prevCollapsedRef.current as PanelCollapsed).right;

    if (leftChanged || rightChanged) {
      setCollapsed(options.collapsed);
      prevCollapsedRef.current = { ...options.collapsed }; // Create a new object to ensure proper reference
    }
  }, [options.collapsed.left, (options.collapsed as PanelCollapsed).right]);

  // Save preferences helper (only saves sizes, not collapsed state)
  const savePreferences = useCallback(async (newSizes: typeof sizes) => {
    try {
      await UserPreferencesService.updatePreferences({
        panelLayouts: {
          [viewKey]: {
            sizes: newSizes,
          },
        },
      });
    } catch (error) {
      console.error(`Failed to save panel preferences for ${viewKey}:`, error);
    }
  }, [viewKey]);

  // Handle panel resize (debounced)
  const handlePanelResize = useCallback((newSizes: typeof sizes) => {
    setSizes(newSizes);

    // Debounce saving to preferences
    const timeoutId = setTimeout(() => {
      savePreferences(newSizes);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [savePreferences]);

  // Collapse/expand handlers - no-ops because state is controlled by parent (IntegratedShell)
  // The parent manages collapsed state via titlebar buttons and passes it down as props
  const handleLeftCollapseComplete = useCallback(async () => {
    // No-op: parent controls state
  }, []);

  const handleLeftExpandComplete = useCallback(async () => {
    // No-op: parent controls state
  }, []);

  // Right panel collapse/expand handlers
  const handleRightCollapseComplete = useCallback(async () => {
    // No-op: parent controls state
  }, []);

  const handleRightExpandComplete = useCallback(async () => {
    // No-op: parent controls state
  }, []);

  if (panelType === 'three-panel') {

    return {
      type: 'three-panel',
      sizes: sizes as PanelSizes,
      collapsed: collapsed as PanelCollapsed,
      handlePanelResize: handlePanelResize as (sizes: PanelSizes) => void,
      handleLeftCollapseComplete,
      handleLeftExpandComplete,
      handleRightCollapseComplete,
      handleRightExpandComplete,
    };
  } else {
    return {
      type: 'two-panel',
      sizes: sizes as TwoPanelSizes,
      collapsed: collapsed as { left?: boolean },
      handlePanelResize: handlePanelResize as (sizes: TwoPanelSizes) => void,
      handleLeftCollapseComplete,
      handleLeftExpandComplete,
    };
  }
}
