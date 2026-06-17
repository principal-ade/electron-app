/**
 * TopicsView
 *
 * Surfaces local topics (curated bundles of trails, each with a markdown
 * description) inside the principal window. Modeled on InboxView: a left list
 * panel and a right tabbed terminal panel where selected topics open as tabs
 * showing their markdown description.
 *
 * Tab state lives in TopicsTabsContext (mounted above IntegratedShell), so this
 * component only owns layout/collapse/size state and the local event bus.
 */

import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type { PanelLayout } from '@principal-ade/panel-layouts';
import { TopicsPanelFramework } from '../../../topics-view/TopicsPanelFramework';

export const TopicsView: React.FC = () => {
  const { theme } = useTheme();
  const events = useMemo(() => new PanelEventBus(), []);

  // Panel layout — list on the left, terminal in the middle, placeholder right.
  const [layout] = useState<PanelLayout>({
    left: 'topics-list',
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
      <TopicsPanelFramework
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

export default TopicsView;
