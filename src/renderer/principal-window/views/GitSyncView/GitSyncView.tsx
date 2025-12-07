import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import { GitHubSocialPanel } from '@industry-theme/git-sync-panels';
import { Users } from 'lucide-react';
import {
  GitSyncPanelProvider,
  useGitSyncPanelProvider,
} from '../../../contexts/GitSyncPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';

/**
 * Inner content component that uses the panel context
 */
const GitSyncViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useGitSyncPanelProvider();

  // Use panel persistence for three-panel layout (single panel in middle)
  const panelState = usePanelPersistence({
    viewKey: 'gitSyncView',
    defaultSizes: { left: 0, middle: 100, right: 0 },
    collapsed: { left: true, right: true },
    panelType: 'three-panel',
  });

  // Define panels using git-sync-panels components
  const panels = useMemo(
    () => [
      {
        id: 'github-social',
        label: 'Network',
        icon: <Users size={16} />,
        content: (
          <GitHubSocialPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
    ],
    [context, actions, events]
  );

  // Define layout configuration - single panel in middle
  const layout = useMemo(
    () => ({
      left: {
        type: 'tabs' as const,
        panels: [],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      middle: {
        type: 'tabs' as const,
        panels: ['github-social'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      right: {
        type: 'tabs' as const,
        panels: [],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
    }),
    []
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel Layout */}
      <ConfigurablePanelLayout
        panels={panels}
        layout={layout}
        collapsiblePanels={{ left: false, right: false }}
        defaultSizes={
          panelState.type === 'three-panel'
            ? panelState.sizes
            : { left: 0, middle: 100, right: 0 }
        }
        minSizes={{ left: 0, middle: 100, right: 0 }}
        collapsed={{ left: true, right: true }}
        style={{ flex: 1, width: '100%', minHeight: 0 }}
        theme={theme}
        showCollapseButtons={false}
        onPanelResize={
          panelState.type === 'three-panel'
            ? panelState.handlePanelResize
            : undefined
        }
        onLeftCollapseComplete={panelState.handleLeftCollapseComplete}
        onLeftExpandComplete={panelState.handleLeftExpandComplete}
      />
    </div>
  );
};

/**
 * GitSyncView - Panel framework view for GitHub social network and presence
 *
 * Uses @industry-theme/git-sync-panels for the GitHubSocialPanel
 * with the ConfigurablePanelLayout.
 */
export const GitSyncView: React.FC = () => {
  return (
    <GitSyncPanelProvider>
      <GitSyncViewContent />
    </GitSyncPanelProvider>
  );
};
