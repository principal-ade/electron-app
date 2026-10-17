/**
 * LocalhostBrowserTabContent
 *
 * Tab body for a `localhost-browser` tab. Mounts the industry-theme
 * `LocalhostBrowserPanel` — an embedded `<webview>` pointed at a local dev
 * server — so a running process can be viewed in-app rather than in an
 * external browser.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  PanelEventBus,
  type PanelActions,
  type PanelContextValue,
} from '@principal-ade/panel-framework-core';
import { panels as localhostPanels } from '@industry-theme/localhost-panels';
import type { LocalhostBrowserTab } from '../../../events/portalTabs';
import { ProcessRegistryService } from '../../../main-process-api/ProcessRegistryService';

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

export type LocalhostBrowserTabContentProps = Pick<
  LocalhostBrowserTab,
  | 'port'
  | 'path'
  | 'processId'
  | 'processStatus'
  | 'processReady'
  | 'processRunCount'
  | 'navigationRevision'
>;

export const LocalhostBrowserTabContent: React.FC<
  LocalhostBrowserTabContentProps
> = ({
  port,
  path,
  processId,
  processStatus,
  processReady,
  processRunCount,
  navigationRevision,
}) => {
  const events = useMemo(() => new PanelEventBus(), []);
  const context = useMemo<PanelContextValue>(
    () => ({ currentScope: { type: 'workspace' }, refresh: async () => {} }),
    [],
  );
  const actions = useMemo(() => ({}) as PanelActions, []);
  const [logs, setLogs] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!showLogs || !processId) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const chunks = await ProcessRegistryService.logs(processId);
        if (!cancelled) setLogs(chunks.join(''));
      } catch {
        if (!cancelled) setError('Could not load process logs.');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [showLogs, processId]);

  const control = async (operation: 'stop' | 'restart') => {
    if (!processId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ProcessRegistryService[operation](processId);
      if (!result.success)
        setError(result.error || `Could not ${operation} process.`);
    } catch {
      setError(`Could not ${operation} process.`);
    } finally {
      setBusy(false);
    }
  };
  const ready = !processId || processReady === true;
  const removed = processStatus === 'removed';

  if (!BrowserPanel) {
    return (
      <div style={{ padding: 16, color: '#888', fontFamily: 'monospace' }}>
        Localhost browser panel is unavailable.
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {processId && (
        <div
          style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'center' }}
        >
          <span role="status">Process: {processStatus ?? 'loading'}</span>
          <button type="button" onClick={() => setShowLogs((value) => !value)}>
            Logs
          </button>
          <button
            type="button"
            disabled={
              busy ||
              removed ||
              !processStatus ||
              processStatus === 'stopping' ||
              processStatus === 'restarting'
            }
            onClick={() => void control('restart')}
          >
            Restart
          </button>
          <button
            type="button"
            disabled={
              busy || !['running', 'starting'].includes(processStatus ?? '')
            }
            onClick={() => void control('stop')}
          >
            Stop
          </button>
        </div>
      )}
      {error && (
        <div role="alert" style={{ padding: 8 }}>
          {error}
        </div>
      )}
      {showLogs && (
        <pre
          style={{
            padding: 8,
            maxHeight: '30%',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {logs || 'No captured output.'}
        </pre>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {ready ? (
          <BrowserPanel
            key={`${port}:${navigationRevision ?? 0}:${processRunCount ?? 0}`}
            context={context}
            actions={actions}
            events={events}
            initialPort={port}
            initialPath={path ?? '/'}
          />
        ) : (
          <div style={{ padding: 16 }}>
            {removed
              ? 'This process was removed. The browser tab has been kept.'
              : 'Server unavailable. Waiting for the linked process to run and report its port.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocalhostBrowserTabContent;
