import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import type { HighlightLayer } from '@principal-ai/file-city-react';
import { EventHighlightService } from '../services/EventHighlightService';
import { AgentSessionSDKService } from '../main-process-api/AgentSessionSDKService';

/**
 * Navigation state for agent event history
 */
export interface AgentHighlightNavigationState {
  currentIndex: number;
  totalEvents: number;
  isLive: boolean;
}

/**
 * Actions for controlling agent highlight visualization
 */
export interface AgentHighlightActions {
  navigatePrevious: () => void;
  navigateNext: () => void;
  goLive: () => void;
  clear: () => void;
}

/**
 * Agent highlight context value
 */
export interface AgentHighlightContextValue {
  highlightLayers: HighlightLayer[];
  navigationState: AgentHighlightNavigationState;
}

/**
 * Combined provider value
 */
export interface AgentHighlightProviderValue {
  context: AgentHighlightContextValue;
  actions: AgentHighlightActions;
}

const AgentHighlightContext = createContext<AgentHighlightProviderValue | null>(
  null,
);

interface AgentHighlightProviderProps {
  children: ReactNode;
  repositoryPath: string;
}

/**
 * AgentHighlightProvider - Manages agent event highlight state separately from panel data
 *
 * This context is split from RepositoryPanelContext to prevent agent event updates
 * (which can be high-frequency during agent sessions) from causing re-renders of
 * unrelated panels like git changes, terminal, dependencies, etc.
 *
 * Only the Code City panel needs to consume this context.
 */
export const AgentHighlightProvider: React.FC<AgentHighlightProviderProps> = ({
  children,
  repositoryPath,
}) => {
  // Track agent highlight layers for code city visualization
  const [highlightLayers, setHighlightLayers] = useState<HighlightLayer[]>([]);
  const [navigationState, setNavigationState] =
    useState<AgentHighlightNavigationState>({
      currentIndex: -1,
      totalEvents: 0,
      isLive: true,
    });

  // EventHighlightService instance
  const eventHighlightServiceRef = useRef<EventHighlightService | null>(null);

  // Set up EventHighlightService for agent events -> code city highlight layers
  useEffect(() => {
    if (!repositoryPath) {
      setHighlightLayers([]);
      setNavigationState({ currentIndex: -1, totalEvents: 0, isLive: true });
      return;
    }

    // Create or get the event highlight service
    if (!eventHighlightServiceRef.current) {
      eventHighlightServiceRef.current = new EventHighlightService();
    }

    const service = eventHighlightServiceRef.current;

    // Set repository context
    service.setRepository(repositoryPath);

    // Subscribe to processed agent events
    const unsubscribeEvents = AgentSessionSDKService.onProcessedEvent(
      (event) => {
        console.log(
          '[AgentHighlightProvider] Received agent event:',
          event.eventType,
          event.toolName,
        );
        service.processEvent(event);
      },
    );

    // Listen for highlight layer updates from the service
    const handleHighlightUpdate = (layers: HighlightLayer[]) => {
      console.log(
        '[AgentHighlightProvider] Agent highlight layers updated:',
        layers.length,
      );
      setHighlightLayers(layers);
      // Update navigation state
      const navState = service.getNavigationState();
      setNavigationState(navState);
    };

    service.on('highlight-update', handleHighlightUpdate);

    return () => {
      console.log(
        '[AgentHighlightProvider] Cleaning up event highlight service',
      );
      unsubscribeEvents();
      service.off('highlight-update', handleHighlightUpdate);
    };
  }, [repositoryPath]);

  // Create actions
  const actions: AgentHighlightActions = useMemo(
    () => ({
      navigatePrevious: () => {
        eventHighlightServiceRef.current?.navigatePrevious();
      },
      navigateNext: () => {
        eventHighlightServiceRef.current?.navigateNext();
      },
      goLive: () => {
        eventHighlightServiceRef.current?.goLive();
      },
      clear: () => {
        eventHighlightServiceRef.current?.clear();
      },
    }),
    [],
  );

  // Create context value
  const context: AgentHighlightContextValue = useMemo(
    () => ({
      highlightLayers,
      navigationState,
    }),
    [highlightLayers, navigationState],
  );

  // Provider value
  const value: AgentHighlightProviderValue = useMemo(
    () => ({
      context,
      actions,
    }),
    [context, actions],
  );

  return (
    <AgentHighlightContext.Provider value={value}>
      {children}
    </AgentHighlightContext.Provider>
  );
};

export const useAgentHighlightProvider = (): AgentHighlightProviderValue => {
  const context = useContext(AgentHighlightContext);
  if (!context) {
    throw new Error(
      'useAgentHighlightProvider must be used within an AgentHighlightProvider',
    );
  }
  return context;
};

/**
 * Hook to access just the highlight layers (most common use case)
 */
export const useAgentHighlightLayers = (): HighlightLayer[] => {
  const { context } = useAgentHighlightProvider();
  return context.highlightLayers;
};

/**
 * Hook to access highlight actions (for navigation controls)
 */
export const useAgentHighlightActions = (): AgentHighlightActions => {
  const { actions } = useAgentHighlightProvider();
  return actions;
};

/**
 * Hook to access navigation state (for UI indicators)
 */
export const useAgentHighlightNavigation =
  (): AgentHighlightNavigationState => {
    const { context } = useAgentHighlightProvider();
    return context.navigationState;
  };

export default AgentHighlightContext;
