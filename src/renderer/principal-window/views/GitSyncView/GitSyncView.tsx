import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import { GitHubSocialPanel } from '@industry-theme/git-sync-panels';
import { UserProfilePanel } from '@industry-theme/alexandria-panels';
import { Users, User } from 'lucide-react';
import {
  GitSyncPanelProvider,
  useGitSyncPanelProvider,
} from '../../../contexts/GitSyncPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';

/**
 * Inner content component that uses the panel context
 */
const GitSyncViewContent: React.FC = () => {
  const { theme, mode } = useTheme();
  const { context, actions, events } = useGitSyncPanelProvider();

  // Use panel persistence for saving panel sizes
  const panelState = usePanelPersistence({
    viewKey: 'gitSyncView',
    defaultSizes: { left: 30, right: 70 },
    collapsed: { left: false },
    panelType: 'two-panel',
  });

  const minSizes = useMemo(() => ({ left: 280, right: 300 }), []);
  const collapsiblePanels = useMemo(() => ({ left: false, right: false }), []);

  const borderColor =
    mode === 'dark' && theme.modes?.dark?.border
      ? theme.modes.dark.border
      : theme.colors.border;

  // Define panels using git-sync-panels and alexandria-panels components
  // Always show UserProfilePanel on the right for now
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
      {
        id: 'user-profile',
        label: 'Profile',
        icon: <User size={16} />,
        content: (
          <UserProfilePanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
    ],
    [context, actions, events],
  );

  // Define layout configuration - network on left (30%), user profile on right (70%)
  const layout = useMemo(
    () => ({
      left: 'github-social',
      right: 'user-profile',
    }),
    [],
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '0 24px',
          height: '64px',
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: theme.colors.text }}>
          Network
        </h2>
      </div>

      {/* Panel Layout */}
      <ConfigurablePanelLayout
        panels={panels}
        layout={layout}
        collapsiblePanels={collapsiblePanels}
        defaultSizes={panelState.sizes}
        minSizes={minSizes}
        collapsed={panelState.collapsed}
        onPanelResize={panelState.handlePanelResize}
        onLeftCollapseComplete={panelState.handleLeftCollapseComplete}
        onLeftExpandComplete={panelState.handleLeftExpandComplete}
        style={{ flex: 1, width: '100%', minHeight: 0 }}
        theme={theme}
        showCollapseButtons={false}
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
