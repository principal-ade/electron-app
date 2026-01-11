import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import {
  GitHubSocialPanel,
  CurrentProjectsPanel,
} from '@industry-theme/git-sync-panels';
import { UserProfilePanel } from '@industry-theme/alexandria-panels';
import { Users, User, FolderGit2 } from 'lucide-react';
import {
  GitSyncPanelProvider,
  useGitSyncPanelProvider,
} from '../../../contexts/GitSyncPanelContext';

/**
 * Inner content component that uses the panel context
 */
const GitSyncViewContent: React.FC = () => {
  const { theme, mode } = useTheme();
  const { context, actions, events, isConnected } = useGitSyncPanelProvider();

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
  // When connected to presence server, show CurrentProjectsPanel
  // Otherwise show UserProfilePanel
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
        id: 'projects-or-profile',
        label: isConnected ? 'Projects' : 'Profile',
        icon: isConnected ? <FolderGit2 size={16} /> : <User size={16} />,
        content: isConnected ? (
          <CurrentProjectsPanel
            context={context}
            actions={actions}
            events={events}
          />
        ) : (
          <UserProfilePanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
    ],
    [context, actions, events, isConnected],
  );

  // Define layout configuration - network in middle, projects/profile on right
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
        panels: ['projects-or-profile'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
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
