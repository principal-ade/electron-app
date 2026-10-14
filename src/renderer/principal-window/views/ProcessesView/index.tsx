/**
 * ProcessesView
 *
 * Hosts the unified process panel. Merges managed processes (from the main
 * registry) with detected local servers, and turns the panel's intents into
 * registry / detection calls:
 * - open      → highlight (a tab view is a later increment)
 * - restart   → managed only
 * - stop/kill → managed: registry.stop; detected: kill by pid
 * - remove    → managed only (drop from history)
 *
 * This replaces the old LocalhostProcessesView overlay.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PanelEventBus,
  type PanelEvent,
} from '@principal-ade/panel-framework-core';
import type { ProcessEntry } from '../../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import {
  ProcessesLeftPanel,
  PROCESS_INTENTS,
} from '../../../panels/ProcessesLeftPanel';
import { useProcessRegistry } from '../../../hooks/useProcessRegistry';
import { ProcessRegistryService } from '../../../main-process-api/ProcessRegistryService';
import { LocalhostDetectionService } from '../../../main-process-api/LocalhostDetectionService';
import { useWorkspaceTabs } from '../../PortalTabsContext';

export const ProcessesView: React.FC = () => {
  const { entries, loading, error, refresh } = useProcessRegistry();
  const bus = useMemo(() => new PanelEventBus(), []);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const { openLocalhostBrowser } = useWorkspaceTabs();

  const stopEntry = useCallback(
    async (entry: ProcessEntry) => {
      if (entry.origin === 'detected') {
        if (entry.pid != null) await LocalhostDetectionService.killServer(entry.pid);
      } else {
        await ProcessRegistryService.stop(entry.id);
      }
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    const entryOf = (event: PanelEvent<unknown>): ProcessEntry | undefined =>
      (event.payload as { entry?: ProcessEntry } | undefined)?.entry;

    const unsubscribers = [
      bus.on(PROCESS_INTENTS.open, (event) => {
        const entry = entryOf(event);
        if (!entry) return;
        setActiveEntryId(entry.id);
        // Open the dev server in an embedded browser tab when it exposes a port.
        if (entry.port != null) {
          openLocalhostBrowser(entry.port, undefined, entry.label);
        }
      }),
      bus.on(PROCESS_INTENTS.restart, (event) => {
        const entry = entryOf(event);
        if (entry?.origin === 'managed') {
          void ProcessRegistryService.restart(entry.id).then(() => refresh());
        }
      }),
      bus.on(PROCESS_INTENTS.stop, (event) => {
        const entry = entryOf(event);
        if (entry) void stopEntry(entry);
      }),
      bus.on(PROCESS_INTENTS.kill, (event) => {
        const entry = entryOf(event);
        if (entry) void stopEntry(entry);
      }),
      bus.on(PROCESS_INTENTS.remove, (event) => {
        const entry = entryOf(event);
        if (entry?.origin === 'managed') {
          void ProcessRegistryService.remove(entry.id).then(() => refresh());
        }
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [bus, refresh, stopEntry, openLocalhostBrowser]);

  return (
    <ProcessesLeftPanel
      entries={entries}
      events={bus}
      loading={loading}
      error={error}
      activeEntryId={activeEntryId}
    />
  );
};

export default ProcessesView;
