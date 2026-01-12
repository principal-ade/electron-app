import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import { GitHubSocialPanel } from '@industry-theme/git-sync-panels';
import { UserProfilePanel } from '@industry-theme/alexandria-panels';
import { Users, User } from 'lucide-react';
import {
  GitSyncPanelProvider,
  useGitSyncPanelProvider,
} from '../../../contexts/GitSyncPanelContext';

/**
 * Inner content component that uses the panel context
 */
const GitSyncViewContent: React.FC = () => {
  const { theme, mode } = useTheme();
  const { context, actions, events } = useGitSyncPanelProvider();

  // Fixed panel sizes - no persistence needed for this view
  const panelSizes = useMemo(() => ({ left: 0, middle: 50, right: 50 }), []);
  const minSizes = useMemo(() => ({ left: 0, middle: 300, right: 280 }), []);
  const collapsed = useMemo(() => ({ left: true, right: false }), []);
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

  // Define layout configuration - network in middle, user profile on right
  const layout = useMemo(
    () => ({
      left: [],
      middle: 'github-social',
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
          padding: '20px 24px',
          borderBottom: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: theme.colors.text }}>
          Network
        </h2>
      </div>

      {/* Panel Layout */}
      <ConfigurablePanelLayout
        panels={panels}
        layout={layout}
        collapsiblePanels={collapsiblePanels}
        defaultSizes={panelSizes}
        minSizes={minSizes}
        collapsed={collapsed}
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
