/**
 * InboxView
 *
 * Surfaces the web-ade trail inbox + recently-visited trails inside the
 * principal window. Modeled on ProjectsView (Projects): a left list panel and a
 * right tabbed terminal panel where selected trails open as tabs.
 *
 * Tab state lives in InboxTabsContext (mounted above IntegratedShell), so this
 * component only owns layout/collapse/size state and the local event bus.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type { PanelLayout } from '@principal-ade/panel-layouts';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { InboxPanelFramework } from '../../../inbox-view/InboxPanelFramework';

export const InboxView: React.FC = () => {
  const { theme } = useTheme();
  const events = useMemo(() => new PanelEventBus(), []);

  // Local repositories — used to resolve a clone for shared-trail file trees.
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchRepositories = async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        if (!cancelled) setRepositories(repos);
      } catch (err) {
        console.error('[InboxView] Failed to fetch repositories:', err);
        if (!cancelled) setRepositories([]);
      }
    };
    void fetchRepositories();

    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      void fetchRepositories();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Panel layout — list on the left, terminal in the middle, placeholder right.
  // Static for now (no titlebar swap control on this view yet).
  const [layout] = useState<PanelLayout>({
    left: 'inbox-list',
    middle: 'terminal',
    right: 'placeholder',
  });
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const [panelSizes, setPanelSizes] = useState({
    left: 25,
    middle: 75,
    right: 0,
  });

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <InboxPanelFramework
        repositories={repositories}
        events={events}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        layout={layout}
        panelSizes={panelSizes}
        onPanelSizesChange={setPanelSizes}
      />
    </div>
  );
};

export default InboxView;
