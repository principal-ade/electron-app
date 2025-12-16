/**
 * Alexandria Workspace Event Context
 *
 * Provides a PanelEventEmitter instance for the Alexandria workspace window.
 * This enables event-driven communication between components,
 * particularly for the Agent Command Palette integration.
 */

import React, { createContext, useContext, useMemo } from 'react';
import {
  PanelEventBus,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';

interface AlexandriaWorkspaceEventContextValue {
  events: PanelEventEmitter;
}

const AlexandriaWorkspaceEventContext =
  createContext<AlexandriaWorkspaceEventContextValue | null>(null);

interface AlexandriaWorkspaceEventProviderProps {
  children: React.ReactNode;
}

export function AlexandriaWorkspaceEventProvider({
  children,
}: AlexandriaWorkspaceEventProviderProps) {
  const events = useMemo(() => new PanelEventBus(), []);

  const value = useMemo(() => ({ events }), [events]);

  return (
    <AlexandriaWorkspaceEventContext.Provider value={value}>
      {children}
    </AlexandriaWorkspaceEventContext.Provider>
  );
}

export function useAlexandriaWorkspaceEvents(): AlexandriaWorkspaceEventContextValue {
  const context = useContext(AlexandriaWorkspaceEventContext);
  if (!context) {
    throw new Error(
      'useAlexandriaWorkspaceEvents must be used within AlexandriaWorkspaceEventProvider',
    );
  }
  return context;
}
