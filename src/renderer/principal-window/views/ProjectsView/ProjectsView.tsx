import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FileCityImageService } from '../../../main-process-api/FileCityImageService';
import {
  LocalProjectsPanel,
  GitHubStarredPanel,
  GitHubProjectsPanel,
  UserCollectionsPanel,
} from '@industry-theme/alexandria-panels';
import { LocalProjectGridPanelContent } from '@industry-theme/repository-composition-panels';
import type { GitHubRepository } from '@industry-theme/alexandria-panels';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { FolderGit2, Folder, FolderOpen, Star, Github } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuthState';
import {
  ProjectsPanelProvider,
  useProjectsPanelProvider,
} from '../../../contexts/ProjectsPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { ProjectsViewHeader } from './ProjectsViewHeader';
import { GitCloneModal } from '../../../components/GitCloneModal';
import { CreateWorkspaceModal } from '../../../components/CreateWorkspaceModal';
import { DeleteAlexandriaEntryModal } from '../../../panels/components/DeleteAlexandriaEntryModal';
import { RemoveFromWorkspaceModal } from '../../../panels/components/RemoveFromWorkspaceModal';
import { DeleteWorkspaceConfirmationModal } from '../../../components/DeleteWorkspaceConfirmationModal';
import { CreateRepositoryInWorkspaceModal } from '../../../panels/components/CreateRepositoryInWorkspaceModal';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../../main-process-api/WorkspaceService';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { CollectionRepositoriesPanel } from '../../../panels/CollectionRepositoriesPanel';
import { ProjectInfoPanel } from '../../../panels/ProjectInfoPanel';

/**
 * Hook to fetch File City images for entries
 * Returns a function that gets the image URL for a given entry path
 */
function useFileCityImages(entries: AlexandriaEntry[] | null): (path: string) => string | undefined {
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!entries || entries.length === 0) return;

    // Fetch images for entries that don't have one yet
    entries.forEach(async (entry) => {
      // Skip if already in map or currently fetching
      if (imageMap.has(entry.path) || fetchingRef.current.has(entry.path)) {
        return;
      }

      fetchingRef.current.add(entry.path);

      try {
        const imageUrl = await FileCityImageService.getImage(entry.path);
        if (imageUrl) {
          setImageMap((prev) => new Map(prev).set(entry.path, imageUrl));
        }
      } catch (error) {
        console.warn('[useFileCityImages] Failed to get image for', entry.path, error);
      } finally {
        fetchingRef.current.delete(entry.path);
      }
    });
  }, [entries, imageMap]);

  return useCallback((path: string) => imageMap.get(path), [imageMap]);
}

/**
 * Empty state shown when user is not authenticated for GitHub panels
 */
const GitHubLoginEmptyState: React.FC<{ type: 'projects' | 'starred' }> = ({ type }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <Github
        size={48}
        style={{
          color: theme.colors.textSecondary,
          marginBottom: 16,
          opacity: 0.5,
        }}
      />
      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: theme.colors.text,
          marginBottom: 8,
        }}
      >
        Sign in to GitHub
      </div>
      <div
        style={{
          fontSize: 14,
          color: theme.colors.textSecondary,
          maxWidth: 280,
        }}
      >
        {type === 'starred'
          ? 'Sign in to see your starred repositories'
          : 'Sign in to see your GitHub projects'}
      </div>
    </div>
  );
};

/**
 * Inner content component that uses the panel context
 */
// Type for left panel view options
export type LeftPanelView = 'local' | 'remote' | 'starred';

interface ProjectsViewContentProps {
  mode: LeftPanelView;
}

const ProjectsViewContent: React.FC<ProjectsViewContentProps> = ({ mode }) => {
  const { theme } = useTheme();
  const { context, actions, events } = useProjectsPanelProvider();
  const { isAuthenticated } = useAuth();

  // Get repositories for File City images
  const repositories = context.alexandriaRepositories?.data?.repositories || null;

  // Hook to fetch File City visualization images for project cards
  const getFileCityImage = useFileCityImages(repositories);

  // State for grid view mode (only applies to local mode)
  const [isGridView, setIsGridView] = useState(false);

  // Toggle grid view handler
  const handleToggleGridView = useCallback(() => {
    setIsGridView((prev) => !prev);
  }, []);

  // State for base default directory
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  // State for clone modal
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneModalInitialUrl, setCloneModalInitialUrl] = useState<
    string | undefined
  >();

  // State for create workspace modal
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    useState(false);

  // State for create repository modal
  const [isCreateRepositoryModalOpen, setIsCreateRepositoryModalOpen] =
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

  // Load base default directory
  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    loadBaseDirectory();

    // Listen for preference updates
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
      },
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

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

  // Handle create repository request
  const handleCreateRepository = useCallback(() => {
    setIsCreateRepositoryModalOpen(true);
  }, []);

  // Handle create repository modal close
  const handleCloseCreateRepositoryModal = useCallback(() => {
    setIsCreateRepositoryModalOpen(false);
  }, []);

  // Handle delete modal close
  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setEntryToDelete(null);
  }, []);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(
    async (deleteLocal: boolean) => {
      if (!entryToDelete) return;

      try {
        await AlexandriaService.removeRepository(entryToDelete.name, deleteLocal);

        // Clear the selected repository
        events.emit({
          type: 'industry-theme.local-projects:repository-selected',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { entry: null },
        });

        // Refresh the repositories list
        await context.refresh('repository', 'alexandriaRepositories');
      } catch (error) {
        console.error('[ProjectsView] Failed to delete repository:', error);
        throw error; // Re-throw so modal knows it failed
      }
    },
    [entryToDelete, context, events],
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
          '[ProjectsView] Failed to remove from workspace:',
          error,
        );
        throw error;
      }
    },
    // context is intentionally omitted from dependencies (stable from context provider)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryToRemoveFromWorkspace, workspaceForRemoval],
  );

  // Override actions to intercept removeLocalRepository and deleteWorkspace to show modals
  const overriddenActions = useMemo<typeof actions>(
    () => ({
      ...actions,
      removeLocalRepository: async (name: string, _deleteLocal: boolean) => {
        // Find the entry by name from the context
        const repositories = context.alexandriaRepositories?.data?.repositories || [];
        const entry = repositories.find((r) => r.name === name);
        if (entry) {
          setEntryToDelete(entry);
          setIsDeleteModalOpen(true);
        }
      },
      deleteWorkspace: async (workspaceId: string) => {
        // Find the workspace by ID from the context
        const workspaces = context.workspaces?.data?.workspaces || [];
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
        // Find the entry from alexandria repositories slice
        const repositories = context.alexandriaRepositories?.data?.repositories || [];
        const entry = repositories.find((r: AlexandriaEntry) => r.name === repositoryId);

        // Find the workspace from workspaces slice
        const workspacesList = context.workspaces?.data?.workspaces || [];
        const workspace = workspacesList.find((w: Workspace) => w.id === workspaceId);

        if (entry && workspace) {
          setEntryToRemoveFromWorkspace(entry);
          setWorkspaceForRemoval(workspace);
          setIsRemoveFromWorkspaceModalOpen(true);
        } else {
          // Fallback to direct removal if we can't find the entry/workspace
          console.warn(
            '[ProjectsView] Could not find entry or workspace for removal modal, proceeding with direct removal',
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
        '[ProjectsView] Clone requested for:',
        repository.full_name,
      );

      // Use the clone_url or html_url from the repository
      const cloneUrl = repository.clone_url || repository.html_url;
      setCloneModalInitialUrl(cloneUrl);
      setIsCloneModalOpen(true);
    });

    return unsubscribe;
  }, [events]);

  // Listen for delete-requested events from ProjectInfoPanel
  useEffect(() => {
    const unsubscribe = events.on('project-info:delete-requested', (event) => {
      const { repository } = event.payload as {
        repository: AlexandriaEntry;
      };
      console.info('[ProjectsView] Delete requested for:', repository.name);
      setEntryToDelete(repository);
      setIsDeleteModalOpen(true);
    });

    return unsubscribe;
  }, [events]);

  // Use panel persistence for three-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'projectsView',
    defaultSizes: { left: 25, middle: 50, right: 25 },
    collapsed: { left: false, right: true },
    panelType: 'three-panel',
  });

  // Define panels using alexandria-panels components
  // All panels are always registered so they can be switched to via header buttons
  const panels = useMemo(
    () => [
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
        id: 'local-projects-grid',
        label: 'Local Projects Grid',
        icon: <Folder size={16} />,
        content: (
          <LocalProjectGridPanelContent
            context={{
              localProjects: {
                data: context.alexandriaRepositories?.data?.repositories || null,
                loading: context.alexandriaRepositories?.loading || false,
                scope: 'repository',
                name: 'localProjects',
                error: null,
                refresh: async () => context.refresh('repository', 'alexandriaRepositories'),
              },
              currentScope: { type: 'workspace' },
              refresh: context.refresh,
              getCustomImageUrl: (entry) => getFileCityImage(entry.path),
            }}
            actions={{
              openProject: async (entry) => {
                await actions.openLocalRepository?.(entry);
              },
              selectProject: (entry) => {
                events.emit({
                  type: 'industry-theme.local-projects:repository-selected',
                  source: 'local-projects-grid',
                  timestamp: Date.now(),
                  payload: { entry },
                });
              },
            }}
            events={events}
          />
        ),
      },
      {
        id: 'project-info',
        label: 'Project Info',
        icon: <FolderGit2 size={16} />,
        content: (
          <ProjectInfoPanel
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
        content: isAuthenticated ? (
          <GitHubProjectsPanel
            context={context}
            actions={actions}
            events={events}
            defaultShowSearch
          />
        ) : (
          <GitHubLoginEmptyState type="projects" />
        ),
      },
      {
        id: 'github-starred',
        label: 'Starred',
        icon: <Star size={16} />,
        content: isAuthenticated ? (
          <GitHubStarredPanel
            context={context}
            actions={actions}
            events={events}
            defaultShowSearch
          />
        ) : (
          <GitHubLoginEmptyState type="starred" />
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
    [context, actions, overriddenActions, events, isAuthenticated, getFileCityImage],
  );

  // Get workspaces from context for create repository button
  const workspaces = context.workspaces?.data?.workspaces || [];

  // Define layout configuration
  const layout = useMemo(() => {
    // If grid view is active for local mode, show grid panel in middle
    if (mode === 'local' && isGridView) {
      return {
        left: 'local-projects',
        middle: 'local-projects-grid',
        right: 'collection-repositories',
      };
    }

    // Map mode to panel id
    const leftPanelMap: Record<LeftPanelView, string> = {
      local: 'local-projects',
      remote: 'github-projects',
      starred: 'github-starred',
    };

    return {
      left: leftPanelMap[mode],
      middle: 'project-info',
      right: 'collection-repositories',
    };
  }, [mode, isGridView]);

  // Collapsed state - collapse left and right when grid view is active
  const collapsedState = useMemo(() => {
    if (mode === 'local' && isGridView) {
      return { left: true, right: true };
    }
    return panelState.type === 'three-panel'
      ? panelState.collapsed
      : { left: false, right: false };
  }, [mode, isGridView, panelState]);

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
        <ProjectsViewHeader
          mode={mode}
          onCreateRepository={handleCreateRepository}
          isGridView={isGridView}
          onToggleGridView={handleToggleGridView}
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
          collapsed={collapsedState}
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

      {/* Create Repository Modal */}
      <CreateRepositoryInWorkspaceModal
        isOpen={isCreateRepositoryModalOpen}
        onClose={handleCloseCreateRepositoryModal}
        workspaces={workspaces}
        baseDefaultDirectory={baseDefaultDirectory}
      />
    </>
  );
};

/**
 * ProjectsView - Panel framework version of workspace management
 *
 * Uses @industry-theme/alexandria-panels for workspace and repository panels
 * with the ConfigurablePanelLayout for the three-panel layout.
 */
interface ProjectsViewProps {
  mode: LeftPanelView;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ mode }) => {
  return (
    <ProjectsPanelProvider>
      <ProjectsViewContent mode={mode} />
    </ProjectsPanelProvider>
  );
};
