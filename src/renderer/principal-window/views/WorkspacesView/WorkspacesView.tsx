import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import {
  WorkspacesListPanel,
  WorkspaceRepositoriesPanel,
  LocalProjectsPanel,
  GitHubStarredPanel,
  GitHubProjectsPanel,
} from '@industry-theme/alexandria-panels';
import type { GitHubRepository } from '@industry-theme/alexandria-panels';
import { DoorClosed, FolderGit2, Folder, Star } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuthState';
import {
  WorkspacesPanelProvider,
  useWorkspacesPanelProvider,
} from '../../../contexts/WorkspacesPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { WorkspacesViewHeader } from './WorkspacesViewHeader';
import { GitCloneModal } from '../../../components/GitCloneModal';
import { CreateWorkspaceModal } from '../../../components/CreateWorkspaceModal';

/**
 * Inner content component that uses the panel context
 */
const WorkspacesViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useWorkspacesPanelProvider();
  const { isAuthenticated } = useAuth();

  // State for clone modal
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneModalInitialUrl, setCloneModalInitialUrl] = useState<string | undefined>();

  // State for create workspace modal
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);

  // Handle clone modal close
  const handleCloseCloneModal = useCallback(() => {
    setIsCloneModalOpen(false);
    setCloneModalInitialUrl(undefined);
  }, []);

  // Handle create workspace modal close
  const handleCloseCreateWorkspaceModal = useCallback(() => {
    setIsCreateWorkspaceModalOpen(false);
  }, []);

  // Handle workspace created successfully - refresh the workspaces list
  const handleWorkspaceCreated = useCallback(() => {
    // Refresh workspaces slice
    context.refresh('workspace', 'workspaces');
  }, [context]);

  // Listen for github:clone-requested events
  useEffect(() => {
    const unsubscribe = events.on('github:clone-requested', (event) => {
      const { repository } = event.payload as { repository: GitHubRepository };
      console.info('[WorkspacesView] Clone requested for:', repository.full_name);

      // Use the clone_url or html_url from the repository
      const cloneUrl = repository.clone_url || repository.html_url;
      setCloneModalInitialUrl(cloneUrl);
      setIsCloneModalOpen(true);
    });

    return unsubscribe;
  }, [events]);

  // Listen for create-workspace-requested events from WorkspacesListPanel
  useEffect(() => {
    const unsubscribe = events.on('industry-theme.workspaces-list:create-workspace-requested', () => {
      console.info('[WorkspacesView] Create workspace requested');
      setIsCreateWorkspaceModalOpen(true);
    });

    return unsubscribe;
  }, [events]);

  // Use panel persistence for three-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'workspacesView',
    defaultSizes: { left: 25, middle: 50, right: 25 },
    collapsed: { left: false, right: false },
    panelType: 'three-panel',
  });

  // Define panels using alexandria-panels components
  const panels = useMemo(
    () => {
      const basePanels = [
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
      ];

      // Add GitHub panels when authenticated
      if (isAuthenticated) {
        basePanels.push(
          {
            id: 'github-projects',
            label: 'GitHub Projects',
            icon: <FolderGit2 size={16} />,
            content: (
              <GitHubProjectsPanel
                context={context}
                actions={actions}
                events={events}
              />
            ),
          },
          {
            id: 'github-starred',
            label: 'Starred',
            icon: <Star size={16} />,
            content: (
              <GitHubStarredPanel
                context={context}
                actions={actions}
                events={events}
              />
            ),
          }
        );
      }

      return basePanels;
    },
    [context, actions, events, isAuthenticated]
  );

  // Define layout configuration
  const layout = useMemo(
    () => {
      // Build left panel tabs based on authentication
      const leftPanels = isAuthenticated
        ? ['workspaces-list', 'local-projects', 'github-projects', 'github-starred']
        : ['workspaces-list', 'local-projects'];

      return {
        left: {
          type: 'tabs' as const,
          panels: leftPanels,
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
      };
    },
    [isAuthenticated]
  );

  return (
    <>
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

      {/* Clone Repository Modal */}
      <GitCloneModal
        isOpen={isCloneModalOpen}
        onClose={handleCloseCloneModal}
        initialUrl={cloneModalInitialUrl}
      />

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceModalOpen}
        onClose={handleCloseCreateWorkspaceModal}
        onSuccess={handleWorkspaceCreated}
      />
    </>
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
