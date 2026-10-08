/**
 * Portal Event Context
 *
 * The portal-scoped `PanelEventBus` for the principal window — the bus that
 * carries view-agnostic *content-open* intents (`topic:open`, `doc:open`; see
 * `events/portalIntents.ts`). It is the "what content opens"
 * channel, deliberately separate from `PrincipalEventContext` (`principalEvents`),
 * which stays the "which surface is showing" channel for window chrome /
 * navigation (`panel:switch`, …). See docs/portal-unification.md (bus model
 * Option A).
 *
 * It is provided at the `PrincipalApp` level — above `IntegratedShell` — so that
 * always-mounted emitters (the titlebar) and the always-mounted listener
 * (`PortalIntentBridge`, the seed of the future single `PortalTabsContext`
 * listener) can both reach it regardless of which workspace view is mounted.
 * (The design doc says "owned by PrincipalPortal"; in practice the bus must sit
 * above the chrome, since the titlebar is a sibling of the portal, not a child.)
 */

import React, { createContext, useContext, useMemo } from 'react';
import {
  PanelEventBus,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';

interface PortalEventContextValue {
  events: PanelEventEmitter;
}

const PortalEventContext = createContext<PortalEventContextValue | null>(null);

interface PortalEventProviderProps {
  children: React.ReactNode;
}

export function PortalEventProvider({ children }: PortalEventProviderProps) {
  const events = useMemo(() => new PanelEventBus(), []);
  const value = useMemo(() => ({ events }), [events]);
  return (
    <PortalEventContext.Provider value={value}>
      {children}
    </PortalEventContext.Provider>
  );
}

export function usePortalEvents(): PortalEventContextValue {
  const context = useContext(PortalEventContext);
  if (!context) {
    throw new Error('usePortalEvents must be used within PortalEventProvider');
  }
  return context;
}
