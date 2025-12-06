import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import {
  WorkspacesListPanel,
  WorkspaceRepositoriesPanel,
  LocalProjectsPanel,
} from '@industry-theme/alexandria-panels';
import { DoorClosed, FolderGit2, Folder } from 'lucide-react';
import {
  WorkspacesPanelProvider,
  useWorkspacesPanelProvider,
} from '../../../contexts/WorkspacesPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { WorkspacesViewHeader } from './WorkspacesViewHeader';

/**
 * Inner content component that uses the panel context
 */
const WorkspacesViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useWorkspacesPanelProvider();

  // Use panel persistence for three-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'workspacesView',
    defaultSizes: { left: 25, middle: 50, right: 25 },
    collapsed: { left: false, right: false },
    panelType: 'three-panel',
  });

  // Define panels using alexandria-panels components
  const panels = useMemo(
    () => [
      {
        id: 'workspaces-list',
        label: 'Workspaces',
        icon: <DoorClosed size={16} />,
        content: (
          <WorkspacesListPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
      {
        id: 'local-projects',
        label: 'Local Projects',
        icon: <Folder size={16} />,
        content: (
          <LocalProjectsPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
      {
        id: 'workspace-repositories',
        label: 'Repositories',
        icon: <FolderGit2 size={16} />,
        content: (
          <WorkspaceRepositoriesPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
    ],
    [context, actions, events]
  );

  // Define layout configuration
  const layout = useMemo(
    () => ({
      left: {
        type: 'tabs' as const,
        panels: ['workspaces-list', 'local-projects'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      middle: {
        type: 'tabs' as const,
        panels: ['workspace-repositories'],
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
      {/* Header */}
      <WorkspacesViewHeader />

      {/* Panel Layout */}
      <ConfigurablePanelLayout
        panels={panels}
        layout={layout}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={
          panelState.type === 'three-panel'
            ? panelState.sizes
            : { left: 25, middle: 50, right: 25 }
        }
        minSizes={{ left: 15, middle: 30, right: 20 }}
        collapsed={
          panelState.type === 'three-panel'
            ? { ...panelState.collapsed, right: true }
            : { left: false, right: true }
        }
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
        onRightCollapseComplete={
          panelState.type === 'three-panel'
            ? panelState.handleRightCollapseComplete
            : undefined
        }
        onRightExpandComplete={
          panelState.type === 'three-panel'
            ? panelState.handleRightExpandComplete
            : undefined
        }
      />
    </div>
  );
};

/**
 * WorkspacesView - Panel framework version of workspace management
 *
 * Uses @industry-theme/alexandria-panels for workspace and repository panels
 * with the ConfigurablePanelLayout for the three-panel layout.
 */
export const WorkspacesView: React.FC = () => {
  return (
    <WorkspacesPanelProvider>
      <WorkspacesViewContent />
    </WorkspacesPanelProvider>
  );
};
