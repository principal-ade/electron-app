import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';

export interface HighlightItem {
  path: string;
  type: 'file' | 'directory';
}

export interface HighlightLayer {
  id: string;
  name: string;
  enabled: boolean;
  color: string;
  priority: number;
  items: HighlightItem[];
}

interface HighlightLayersContextValue {
  /** Get all registered highlight layers, sorted by priority */
  getAllLayers: () => HighlightLayer[];

  /** Register or update a highlight layer */
  registerLayer: (id: string, layer: Omit<HighlightLayer, 'id'>) => void;

  /** Unregister a highlight layer */
  unregisterLayer: (id: string) => void;

  /** Enable/disable a specific layer */
  setLayerEnabled: (id: string, enabled: boolean) => void;

  /** Get a specific layer by ID */
  getLayer: (id: string) => HighlightLayer | undefined;
}

const HighlightLayersContext = createContext<HighlightLayersContextValue | null>(null);

interface HighlightLayersProviderProps {
  children: ReactNode;
}

/**
 * Provider for managing highlight layers across the application
 *
 * Components can independently register their highlight layers (search results,
 * git changes, packages, notes, etc.) and the city visualization consumes them all.
 */
export function HighlightLayersProvider({ children }: HighlightLayersProviderProps) {
  const [layers, setLayers] = useState<Map<string, HighlightLayer>>(new Map());

  const getAllLayers = useCallback(() => {
    return Array.from(layers.values()).sort((a, b) => b.priority - a.priority);
  }, [layers]);

  const registerLayer = useCallback((id: string, layerData: Omit<HighlightLayer, 'id'>) => {
    setLayers(prev => {
      const next = new Map(prev);
      next.set(id, { ...layerData, id });
      return next;
    });
  }, []);

  const unregisterLayer = useCallback((id: string) => {
    setLayers(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setLayerEnabled = useCallback((id: string, enabled: boolean) => {
    setLayers(prev => {
      const layer = prev.get(id);
      if (!layer) return prev;

      const next = new Map(prev);
      next.set(id, { ...layer, enabled });
      return next;
    });
  }, []);

  const getLayer = useCallback((id: string) => {
    return layers.get(id);
  }, [layers]);

  const value: HighlightLayersContextValue = {
    getAllLayers,
    registerLayer,
    unregisterLayer,
    setLayerEnabled,
    getLayer,
  };

  return (
    <HighlightLayersContext.Provider value={value}>
      {children}
    </HighlightLayersContext.Provider>
  );
}

/**
 * Hook to access highlight layers functionality
 *
 * Example usage:
 *
 * ```tsx
 * function SearchTab() {
 *   const { registerLayer, unregisterLayer } = useHighlightLayers();
 *   const [searchResults, setSearchResults] = useState([]);
 *
 *   useEffect(() => {
 *     if (searchResults.length > 0) {
 *       registerLayer('search-results', {
 *         name: `Search Results (${searchResults.length})`,
 *         enabled: true,
 *         color: '#3b82f6',
 *         priority: 25,
 *         items: searchResults.map(path => ({ path, type: 'file' }))
 *       });
 *     } else {
 *       unregisterLayer('search-results');
 *     }
 *
 *     return () => unregisterLayer('search-results');
 *   }, [searchResults, registerLayer, unregisterLayer]);
 * }
 * ```
 */
export function useHighlightLayers(): HighlightLayersContextValue {
  const context = useContext(HighlightLayersContext);
  if (!context) {
    throw new Error('useHighlightLayers must be used within a HighlightLayersProvider');
  }
  return context;
}
