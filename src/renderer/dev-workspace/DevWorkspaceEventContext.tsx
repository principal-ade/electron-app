/**
 * Dev Workspace Event Context
 *
 * Provides a PanelEventEmitter instance for the dev-workspace window.
 * This enables event-driven communication between components,
 * particularly for the Agent Command Palette integration.
 */

import React, { createContext, useContext, useMemo } from 'react';
import {
  PanelEventBus,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';

interface DevWorkspaceEventContextValue {
  events: PanelEventEmitter;
}

const DevWorkspaceEventContext =
  createContext<DevWorkspaceEventContextValue | null>(null);

interface DevWorkspaceEventProviderProps {
  children: React.ReactNode;
}

export function DevWorkspaceEventProvider({
  children,
}: DevWorkspaceEventProviderProps) {
  const events = useMemo(() => new PanelEventBus(), []);

  const value = useMemo(() => ({ events }), [events]);

  return (
    <DevWorkspaceEventContext.Provider value={value}>
      {children}
    </DevWorkspaceEventContext.Provider>
  );
}

export function useDevWorkspaceEvents(): DevWorkspaceEventContextValue {
  const context = useContext(DevWorkspaceEventContext);
  if (!context) {
    throw new Error(
      'useDevWorkspaceEvents must be used within DevWorkspaceEventProvider',
    );
  }
  return context;
}
