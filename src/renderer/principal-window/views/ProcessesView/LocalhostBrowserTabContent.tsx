/**
 * LocalhostBrowserTabContent
 *
 * Tab body for a `localhost-browser` tab. Mounts the industry-theme
 * `LocalhostBrowserPanel` — an embedded `<webview>` pointed at a local dev
 * server — so a running process can be viewed in-app rather than in an
 * external browser.
 */

import React, { useMemo } from 'react';
import {
  PanelEventBus,
  type PanelActions,
  type PanelContextValue,
} from '@principal-ade/panel-framework-core';
import { panels as localhostPanels } from '@industry-theme/localhost-panels';

/**
 * The panel's published prop type is `PanelComponentProps` only, but at runtime
 * it also accepts `initialPort` / `initialPath` to seed the address bar. Re-
 * declare them so we can pass them without a type error. The root export is the
 * `panels` array (not a named component), so resolve it by id.
 */
interface LocalhostBrowserPanelProps {
  context: PanelContextValue;
  actions: PanelActions;
  events: PanelEventBus;
  initialPort?: number;
  initialPath?: string;
}
const BrowserPanel = localhostPanels.find(
  (panel) => panel.metadata?.id === 'principal-ade.localhost-browser',
)?.component as unknown as React.FC<LocalhostBrowserPanelProps> | undefined;

export interface LocalhostBrowserTabContentProps {
  port: number;
  path?: string;
}

export const LocalhostBrowserTabContent: React.FC<
  LocalhostBrowserTabContentProps
> = ({ port, path }) => {
  const events = useMemo(() => new PanelEventBus(), []);
  const context = useMemo<PanelContextValue>(
    () => ({ currentScope: { type: 'workspace' }, refresh: async () => {} }),
    [],
  );
  const actions = useMemo(() => ({}) as PanelActions, []);

  if (!BrowserPanel) {
    return (
      <div style={{ padding: 16, color: '#888', fontFamily: 'monospace' }}>
        Localhost browser panel is unavailable.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <BrowserPanel
        context={context}
        actions={actions}
        events={events}
        initialPort={port}
        initialPath={path ?? '/'}
      />
    </div>
  );
};

export default LocalhostBrowserTabContent;
