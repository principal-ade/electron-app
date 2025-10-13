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
  viewKey:
    | 'repositoryExplorer'
    | 'roomsManager'
    | 'terminalManager'
    | 'authView'
    | 'repositoryDetailsNested';
  defaultSizes: PanelSizes | TwoPanelSizes;
  collapsed: PanelCollapsed | { left?: boolean }; // Initial collapsed state
  panelType: 'three-panel' | 'two-panel';
}

/**
 * Hook for persisting panel layouts across sessions
 * Loads panel state from UserPreferences and saves changes automatically
 */
export function usePanelPersistence(
  options: UsePanelPersistenceOptions,
): PanelPersistence {
  const { viewKey, defaultSizes, panelType } = options;

  const [sizes, setSizes] = useState(defaultSizes);
  const [collapsed, setCollapsed] = useState(options.collapsed);
  const prevCollapsedRef = useRef(options.collapsed);
  const lastNonZeroSizesRef = useRef<Partial<PanelSizes & TwoPanelSizes>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistSizesRef = useRef<typeof sizes | null>(null);

  const updateLastNonZeroSizes = useCallback(
    (incomingSizes: PanelSizes | TwoPanelSizes) => {
      if ('left' in incomingSizes && incomingSizes.left > 0) {
        lastNonZeroSizesRef.current.left = incomingSizes.left;
      }

      if ('middle' in incomingSizes && incomingSizes.middle > 0) {
        lastNonZeroSizesRef.current.middle = incomingSizes.middle;
      }

      if ('right' in incomingSizes && incomingSizes.right > 0) {
        lastNonZeroSizesRef.current.right = incomingSizes.right;
      }
    },
    [],
  ); // No dependencies - uses ref

  const getFallbackSize = useCallback(
    (panel: 'left' | 'right') => {
      const storedSize = lastNonZeroSizesRef.current[panel];
      if (storedSize && storedSize > 0) {
        return storedSize;
      }

      if (panel === 'left' && 'left' in defaultSizes && defaultSizes.left > 0) {
        return defaultSizes.left;
      }

      if (
        panel === 'right' &&
        'right' in defaultSizes &&
        defaultSizes.right > 0
      ) {
        return defaultSizes.right;
      }

      return undefined;
    },
    [defaultSizes],
  );

  // Update sizes when defaultSizes changes (parent has loaded preferences)
  // Use a ref to track if we've seen this defaultSizes object before
  const prevDefaultSizesRef = useRef(defaultSizes);
  useEffect(() => {
    // Only update if the actual values changed, not just the reference
    const hasChanged =
      ('left' in defaultSizes &&
        defaultSizes.left !== prevDefaultSizesRef.current.left) ||
      ('middle' in defaultSizes &&
        'middle' in prevDefaultSizesRef.current &&
        defaultSizes.middle !==
          (prevDefaultSizesRef.current as PanelSizes).middle) ||
      ('right' in defaultSizes &&
        defaultSizes.right !== prevDefaultSizesRef.current.right);

    if (hasChanged) {
      setSizes(defaultSizes);
      updateLastNonZeroSizes(defaultSizes);
      prevDefaultSizesRef.current = defaultSizes;
    }
  }, [defaultSizes, updateLastNonZeroSizes]);

  // Sync with parent's collapsed state (e.g., from titlebar buttons)
  // This will now properly detect changes since we're using options.collapsed
  useEffect(() => {
    const leftChanged =
      options.collapsed.left !== prevCollapsedRef.current.left;
    const rightChanged =
      'right' in options.collapsed &&
      'right' in prevCollapsedRef.current &&
      (options.collapsed as PanelCollapsed).right !==
        (prevCollapsedRef.current as PanelCollapsed).right;

    if (leftChanged || rightChanged) {
      setCollapsed(options.collapsed);
      prevCollapsedRef.current = { ...options.collapsed }; // Create a new object to ensure proper reference
    }
  }, [options.collapsed.left, (options.collapsed as PanelCollapsed).right]);

  // Save preferences helper (only saves sizes, not collapsed state)
  const savePreferences = useCallback(
    async (newSizes: typeof sizes) => {
      try {
        await UserPreferencesService.updatePreferences({
          panelLayouts: {
            [viewKey]: {
              sizes: newSizes,
            },
          },
        });
      } catch (error) {
        console.error(
          `Failed to save panel preferences for ${viewKey}:`,
          error,
        );
      }
    },
    [viewKey],
  );

  // Handle panel resize (debounced)
  const handlePanelResize = useCallback(
    (newSizes: typeof sizes) => {
      const sanitizedSizes = { ...newSizes } as typeof newSizes;
      let shouldPersist = true;

      if ('left' in newSizes) {
        const leftCollapsed = Boolean((collapsed as PanelCollapsed)?.left);
        const leftSize = newSizes.left;

        if (leftCollapsed) {
          const fallback = getFallbackSize('left');
          if (fallback !== undefined && fallback > 0) {
            sanitizedSizes.left = fallback;
          } else {
            shouldPersist = false;
          }
        } else if (leftSize === 0) {
          shouldPersist = false;
        }
      }

      if (panelType === 'three-panel' && 'right' in newSizes) {
        const rightCollapsed = Boolean((collapsed as PanelCollapsed)?.right);
        const rightSize = newSizes.right;

        if (rightCollapsed) {
          const fallback = getFallbackSize('right');
          if (fallback !== undefined && fallback > 0) {
            sanitizedSizes.right = fallback;
          } else {
            shouldPersist = false;
          }
        } else if (rightSize === 0) {
          shouldPersist = false;
        }
      }

      setSizes(sanitizedSizes);
      updateLastNonZeroSizes(sanitizedSizes);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      if (!shouldPersist) {
        pendingPersistSizesRef.current = null;
        return;
      }

      pendingPersistSizesRef.current = sanitizedSizes;
      saveTimeoutRef.current = setTimeout(() => {
        const pendingSizes = pendingPersistSizesRef.current;
        if (pendingSizes) {
          savePreferences(pendingSizes);
          pendingPersistSizesRef.current = null;
        }
        saveTimeoutRef.current = null;
      }, 500);
    },
    [
      collapsed,
      getFallbackSize,
      panelType,
      savePreferences,
      updateLastNonZeroSizes,
    ],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        const pendingSizes = pendingPersistSizesRef.current;
        if (pendingSizes) {
          savePreferences(pendingSizes);
          pendingPersistSizesRef.current = null;
        }
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
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
