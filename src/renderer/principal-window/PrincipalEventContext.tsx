/**
 * Principal Window Event Context
 *
 * Provides a PanelEventEmitter instance for the principal window.
 * This enables event-driven communication between components,
 * particularly for the Agent Command Palette integration.
 */

import React, { createContext, useContext, useMemo } from 'react';
import {
  PanelEventBus,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';

interface PrincipalEventContextValue {
  events: PanelEventEmitter;
}

const PrincipalEventContext = createContext<PrincipalEventContextValue | null>(
  null,
);

interface PrincipalEventProviderProps {
  children: React.ReactNode;
}

export function PrincipalEventProvider({
  children,
}: PrincipalEventProviderProps) {
  const events = useMemo(() => new PanelEventBus(), []);

  const value = useMemo(() => ({ events }), [events]);

  return (
    <PrincipalEventContext.Provider value={value}>
      {children}
    </PrincipalEventContext.Provider>
  );
}

export function usePrincipalEvents(): PrincipalEventContextValue {
  const context = useContext(PrincipalEventContext);
  if (!context) {
    throw new Error(
      'usePrincipalEvents must be used within PrincipalEventProvider',
    );
  }
  return context;
}
