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
  UserCollectionsPanel,
} from '@industry-theme/alexandria-panels';
import { RepositoryQualityGridPanel } from '@principal-ade/code-quality-panels';
import type { GitHubRepository } from '@industry-theme/alexandria-panels';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { DoorClosed, FolderGit2, Folder, FolderOpen, Star, Hexagon } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuthState';
import {
  WorkspacesPanelProvider,
  useWorkspacesPanelProvider,
} from '../../../contexts/WorkspacesPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { WorkspacesViewHeader } from './WorkspacesViewHeader';
import { GitCloneModal } from '../../../components/GitCloneModal';
import { CreateWorkspaceModal } from '../../../components/CreateWorkspaceModal';
import { DeleteAlexandriaEntryModal } from '../../../panels/components/DeleteAlexandriaEntryModal';
import { RemoveFromWorkspaceModal } from '../../../panels/components/RemoveFromWorkspaceModal';
import { DeleteWorkspaceConfirmationModal } from '../../../components/DeleteWorkspaceConfirmationModal';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../../main-process-api/WorkspaceService';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { CollectionRepositoriesPanel } from '../../../panels/CollectionRepositoriesPanel';

/**
 * Inner content component that uses the panel context
 */
// Type for middle panel view options
export type MiddlePanelView = 'quality' | 'remote' | 'starred';

const WorkspacesViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useWorkspacesPanelProvider();
  const { isAuthenticated } = useAuth();

  // State for middle panel view selection
  const [middlePanelView, setMiddlePanelView] =
    useState<MiddlePanelView>('quality');

  // State for clone modal
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneModalInitialUrl, setCloneModalInitialUrl] = useState<
    string | undefined
  >();

  // State for create workspace modal
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    useState(false);

  // State for delete repository modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<AlexandriaEntry | null>(
    null,
  );

  // State for delete workspace modal
  const [isDeleteWorkspaceModalOpen, setIsDeleteWorkspaceModalOpen] =
    useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(
    null,
  );

  // State for remove from workspace modal
  const [isRemoveFromWorkspaceModalOpen, setIsRemoveFromWorkspaceModalOpen] =
    useState(false);
  const [entryToRemoveFromWorkspace, setEntryToRemoveFromWorkspace] =
    useState<AlexandriaEntry | null>(null);
  const [workspaceForRemoval, setWorkspaceForRemoval] =
    useState<Workspace | null>(null);

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

  // Handle delete modal close
  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setEntryToDelete(null);
  }, []);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(
    async (deleteLocal: boolean) => {
      if (!entryToDelete) return;
      await AlexandriaService.removeRepository(entryToDelete.name, deleteLocal);
      // Refresh the repositories list
      context.refresh('repository', 'alexandriaRepositories');
    },
    [entryToDelete, context],
  );

  // Handle delete workspace modal close
  const handleCloseDeleteWorkspaceModal = useCallback(() => {
    setIsDeleteWorkspaceModalOpen(false);
    setWorkspaceToDelete(null);
  }, []);

  // Handle workspace deleted successfully - refresh the workspaces list
  const handleWorkspaceDeleted = useCallback(() => {
    context.refresh('workspace', 'workspaces');
  }, [context]);

  // Handle remove from workspace modal close
  const handleCloseRemoveFromWorkspaceModal = useCallback(() => {
    setIsRemoveFromWorkspaceModalOpen(false);
    setEntryToRemoveFromWorkspace(null);
    setWorkspaceForRemoval(null);
  }, []);

  // Handle remove from workspace confirmation
  const handleConfirmRemoveFromWorkspace = useCallback(
    async (moveToDefault: boolean) => {
      if (!entryToRemoveFromWorkspace || !workspaceForRemoval) return;

      try {
        // Remove from workspace first (while entry still has original path)
        // Pass full entry so core library can extract github.id for matching
        await WorkspaceService.removeRepositoryFromWorkspace(
          entryToRemoveFromWorkspace,
          workspaceForRemoval.id,
        );

        // Refresh the workspace repositories in context
        context.refresh('workspace', 'workspaceRepositories');

        // Then move to default directory if requested
        if (moveToDefault) {
          await WorkspaceService.moveRepositoryToDefaultDirectory(
            entryToRemoveFromWorkspace,
          );
        }
      } catch (error) {
        console.error(
          '[WorkspacesView] Failed to remove from workspace:',
          error,
        );
        throw error;
      }
    },
    [entryToRemoveFromWorkspace, workspaceForRemoval, actions],
  );

  // Override actions to intercept removeRepository and deleteWorkspace to show modals
  const overriddenActions = useMemo(
    () => ({
      ...actions,
      removeRepository: async (name: string, _deleteLocal: boolean) => {
        // Find the entry by name from the context
        const slice = context.getSlice<{ repositories: AlexandriaEntry[] }>(
          'alexandriaRepositories',
        );
        const repositories = slice?.data?.repositories || [];
        const entry = repositories.find((r) => r.name === name);
        if (entry) {
          setEntryToDelete(entry);
          setIsDeleteModalOpen(true);
        }
      },
      deleteWorkspace: async (workspaceId: string) => {
        // Find the workspace by ID from the context
        const slice = context.getSlice<{ workspaces: Workspace[] }>(
          'workspaces',
        );
        const workspaces = slice?.data?.workspaces || [];
        const workspace = workspaces.find((w) => w.id === workspaceId);
        if (workspace) {
          setWorkspaceToDelete(workspace);
          setIsDeleteWorkspaceModalOpen(true);
        }
      },
      removeRepositoryFromWorkspace: async (
        repositoryId: string,
        workspaceId: string,
      ) => {
        // Find the entry from workspace repositories slice
        // In WorkspacesPanelContext, workspaceRepositories.data is AlexandriaEntry[] directly
        const repoSlice = context.getSlice<AlexandriaEntry[]>(
          'workspaceRepositories',
        );
        const repositories = repoSlice?.data || [];
        const entry = repositories.find((r) => r.name === repositoryId);

        // Find the workspace from workspaces slice
        // In WorkspacesPanelContext, workspaces.data has { workspaces: Workspace[], ... }
        const wsSlice = context.getSlice<{ workspaces: Workspace[] }>(
          'workspaces',
        );
        const workspaces = wsSlice?.data?.workspaces || [];
        const workspace = workspaces.find((w) => w.id === workspaceId);

        if (entry && workspace) {
          setEntryToRemoveFromWorkspace(entry);
          setWorkspaceForRemoval(workspace);
          setIsRemoveFromWorkspaceModalOpen(true);
        } else {
          // Fallback to direct removal if we can't find the entry/workspace
          console.warn(
            '[WorkspacesView] Could not find entry or workspace for removal modal, proceeding with direct removal',
          );
          await actions.removeRepositoryFromWorkspace?.(
            repositoryId,
            workspaceId,
          );
        }
      },
    }),
    [actions, context],
  );

  // Listen for github:clone-requested events
  useEffect(() => {
    const unsubscribe = events.on('github:clone-requested', (event) => {
      const { repository } = event.payload as { repository: GitHubRepository };
      console.info(
        '[WorkspacesView] Clone requested for:',
        repository.full_name,
      );

      // Use the clone_url or html_url from the repository
      const cloneUrl = repository.clone_url || repository.html_url;
      setCloneModalInitialUrl(cloneUrl);
      setIsCloneModalOpen(true);
    });

    return unsubscribe;
  }, [events]);

  // Listen for create-workspace-requested events from WorkspacesListPanel
  useEffect(() => {
    const unsubscribe = events.on(
      'industry-theme.workspaces-list:create-workspace-requested',
      () => {
        console.info('[WorkspacesView] Create workspace requested');
        setIsCreateWorkspaceModalOpen(true);
      },
    );

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
  // All panels are always registered so they can be switched to via header buttons
  const panels = useMemo(
    () => [
      {
        id: 'workspaces-list',
        label: 'Workspaces',
        icon: <DoorClosed size={16} />,
        content: (
          <WorkspacesListPanel
            context={context}
            actions={overriddenActions}
            events={events}
            defaultShowSearch
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
            actions={overriddenActions}
            events={events}
            defaultShowSearch
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
            actions={overriddenActions}
            events={events}
          />
        ),
      },
      {
        id: 'repository-quality-grid',
        label: 'Quality',
        icon: <Hexagon size={16} />,
        content: (
          <RepositoryQualityGridPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
      {
        id: 'github-projects',
        label: 'GitHub Projects',
        icon: <FolderGit2 size={16} />,
        content: (
          <GitHubProjectsPanel
            context={context}
            actions={actions}
            events={events}
            defaultShowSearch
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
            defaultShowSearch
          />
        ),
      },
      // Only include collections panels if user is authenticated
      ...(isAuthenticated
        ? [
            {
              id: 'user-collections',
              label: 'Collections',
              icon: <FolderOpen size={16} />,
              content: (
                <UserCollectionsPanel
                  context={context}
                  actions={actions}
                  events={events}
                />
              ),
            },
            {
              id: 'collection-repositories',
              label: 'Collection Repos',
              icon: <FolderOpen size={16} />,
              content: (
                <CollectionRepositoriesPanel
                  context={context}
                  actions={actions}
                  events={events}
                />
              ),
            },
          ]
        : []),
    ],
    [context, actions, overriddenActions, events, isAuthenticated],
  );

  // Get selected collection from context to determine right panel
  const selectedCollection = (context as { selectedCollection?: unknown }).selectedCollection;

  // Define layout configuration
  const layout = useMemo(() => {
    // Left panel has collections (if authenticated), local projects, and workspaces
    // GitHub panels are accessed via middle panel toggle buttons
    const leftPanels = isAuthenticated
      ? ['user-collections', 'local-projects', 'workspaces-list']
      : ['local-projects', 'workspaces-list'];

    // Map middle panel view to panel id
    const middlePanelMap: Record<MiddlePanelView, string> = {
      quality: 'repository-quality-grid',
      remote: 'github-projects',
      starred: 'github-starred',
    };

    // Right panel shows collection repos if a collection is selected, otherwise workspace repos
    const rightPanel = selectedCollection
      ? 'collection-repositories'
      : 'workspace-repositories';

    return {
      left: {
        type: 'tabs' as const,
        panels: leftPanels,
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      middle: middlePanelMap[middlePanelView],
      right: rightPanel,
    };
  }, [middlePanelView, selectedCollection, isAuthenticated]);

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
        <WorkspacesViewHeader
          middlePanelView={middlePanelView}
          onMiddlePanelViewChange={setMiddlePanelView}
          isAuthenticated={isAuthenticated}
        />

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
              ? panelState.collapsed
              : { left: false, right: false }
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

      {/* Delete Repository Modal */}
      <DeleteAlexandriaEntryModal
        isOpen={isDeleteModalOpen}
        entry={entryToDelete}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      {/* Delete Workspace Modal */}
      <DeleteWorkspaceConfirmationModal
        isOpen={isDeleteWorkspaceModalOpen}
        workspace={workspaceToDelete}
        onClose={handleCloseDeleteWorkspaceModal}
        onSuccess={handleWorkspaceDeleted}
      />

      {/* Remove from Workspace Modal */}
      <RemoveFromWorkspaceModal
        isOpen={isRemoveFromWorkspaceModalOpen}
        entry={entryToRemoveFromWorkspace}
        workspace={workspaceForRemoval}
        onClose={handleCloseRemoveFromWorkspaceModal}
        onConfirm={handleConfirmRemoveFromWorkspace}
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
