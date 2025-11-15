import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { AlexandriaEntry } from '@a24z/core-library';
import {
  FolderGit2,
  Users,
  Network,
  FileText,
  Star,
  Activity,
  Folder,
  Layers,
} from 'lucide-react';
import { ConfigurablePanelLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { useAllRepositories } from '../../../hooks/useRepositoryData';
import { buildWorkspaceDependencyGraph } from '../../../services/WorkspaceDependencyGraphService';
import { WorkspaceService } from '../../../main-process-api/WorkspaceService';
import { GraphDetailPanel } from '../../../panels/components/GraphDetailPanel';
import { GitHubProjectsPanel } from '../../../panels/components/GitHubProjectsPanel';
import { GitHubStarredPanel } from '../../../panels/components/GitHubStarredPanel';
import { GitHubSocialPanel } from '../../../panels/components/GitHubSocialPanel';
import { GitHubReadmePanel } from '../../../panels/components/GitHubReadmePanel';
import { GitSyncDiagnosticPanel } from '../../../panels/components/GitSyncDiagnosticPanel';
import { LocalProjectsPanel } from '../../../panels/components/LocalProjectsPanel';
import { PresencePanel } from '../../../panels/components/PresencePanel';
import { WorkspacesListPanel } from '../../../panels/components/WorkspacesListPanel';
import { WorkspaceEntriesPanel } from '../../../panels/components/WorkspaceEntriesPanel';
import {
  SelectedRepositoryProvider,
  useSelectedRepository,
} from '../../../contexts/SelectedRepositoryContext';
import {
  WorkspaceFilterProvider,
  useWorkspaceFilter,
} from '../../../contexts/WorkspaceFilterContext';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FeedViewHeader } from './FeedViewHeader';

const FeedViewInner: React.FC = () => {
  const { theme } = useTheme();
  const { repositories } = useAllRepositories();
  const { selectedRepository } = useSelectedRepository();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceFilter();

  const [workspaceRepositories, setWorkspaceRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [selectedTopLevelNodes, setSelectedTopLevelNodes] = useState<string[]>(
    [],
  );
  const [showGitSyncPanel, setShowGitSyncPanel] = useState(false);
  const [showPresencePanel, setShowPresencePanel] = useState(false);

  // Load repositories in selected workspace
  useEffect(() => {
    if (!selectedWorkspace) {
      setWorkspaceRepositories([]);
      return;
    }

    const loadWorkspaceRepos = async () => {
      try {
        const repos = await WorkspaceService.getRepositoriesInWorkspace(
          selectedWorkspace.id,
        );
        setWorkspaceRepositories(repos);
      } catch (error) {
        console.error('Failed to load workspace repositories:', error);
        setWorkspaceRepositories([]);
      }
    };

    loadWorkspaceRepos();
  }, [selectedWorkspace]);

  // Build dependency graph for selected workspace
  const workspaceGraph = useMemo(() => {
    if (!selectedWorkspace || workspaceRepositories.length === 0) {
      return null;
    }

    // Create a map of repository path -> cache data
    const repoDataMap = new Map(
      repositories.map((repo) => [repo.repository.path, repo]),
    );

    return buildWorkspaceDependencyGraph(workspaceRepositories, repoDataMap);
  }, [selectedWorkspace, workspaceRepositories, repositories]);

  // Initialize selected top-level nodes when graph changes
  React.useEffect(() => {
    if (workspaceGraph) {
      setSelectedTopLevelNodes(workspaceGraph.metadata.topLevelRepositories);
    } else {
      setSelectedTopLevelNodes([]);
    }
  }, [workspaceGraph]);

  // Load panel visibility preferences
  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        setShowGitSyncPanel(prefs.showGitSyncPanel ?? false);
        setShowPresencePanel(prefs.showPresencePanel ?? false);
      })
      .catch(console.error);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.showGitSyncPanel !== undefined) {
        setShowGitSyncPanel(detail.showGitSyncPanel);
      }
      if (detail?.showPresencePanel !== undefined) {
        setShowPresencePanel(detail.showPresencePanel);
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );
    return () => {
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  // Use panel persistence hook for three-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'feedView',
    defaultSizes: { left: 25, middle: 50, right: 25 },
    collapsed: { left: false, right: false },
    panelType: 'three-panel',
  });

  // Memoize panels array based on git sync panel visibility
  const panels = useMemo(() => {
    const basePanels = [
      {
        id: 'local-projects',
        label: 'Local Projects',
        icon: <Folder size={16} />,
        content: <LocalProjectsPanel />,
      },
      {
        id: 'workspaces-list',
        label: 'Workspaces',
        icon: <Layers size={16} />,
        content: (
          <WorkspacesListPanel
            selectedWorkspaceId={selectedWorkspace?.id}
            onWorkspaceSelect={setSelectedWorkspace}
          />
        ),
      },
      {
        id: 'workspace-entries',
        label: 'Workspace Repositories',
        icon: <FolderGit2 size={16} />,
        content: <WorkspaceEntriesPanel selectedWorkspace={selectedWorkspace} />,
      },
      {
        id: 'github-projects',
        label: 'GitHub Projects',
        icon: <FolderGit2 size={16} />,
        content: <GitHubProjectsPanel />,
      },
      {
        id: 'github-starred',
        label: 'Starred',
        icon: <Star size={16} />,
        content: <GitHubStarredPanel />,
      },
      {
        id: 'github-social',
        label: 'GitHub Network',
        icon: <Users size={16} />,
        content: <GitHubSocialPanel />,
      },
      {
        id: 'readme-viewer',
        label: 'README',
        icon: <FileText size={16} />,
        content: <GitHubReadmePanel repository={selectedRepository} />,
      },
      {
        id: 'graph-view',
        label: 'Workspace Graph',
        icon: <Network size={16} />,
        content: (
          <GraphDetailPanel
            graph={workspaceGraph}
            selectedTopLevelNodes={selectedTopLevelNodes}
            onTopLevelNodesChange={setSelectedTopLevelNodes}
          />
        ),
      },
    ];

    // Conditionally add presence panel
    if (showPresencePanel) {
      basePanels.push({
        id: 'presence',
        label: 'Live Presence',
        icon: <Users size={16} />,
        content: <PresencePanel />,
      });
    }

    // Conditionally add git sync panel
    if (showGitSyncPanel) {
      basePanels.push({
        id: 'git-sync-diagnostic',
        label: 'Git-Sync',
        icon: <Activity size={16} />,
        content: <GitSyncDiagnosticPanel />,
      });
    }

    return basePanels;
  }, [
    workspaceGraph,
    selectedTopLevelNodes,
    selectedRepository,
    showGitSyncPanel,
    showPresencePanel,
    selectedWorkspace,
    setSelectedWorkspace,
  ]);

  // Memoize layout based on git sync panel visibility
  const layout = useMemo(
    () => ({
      left: {
        type: 'tabs' as const,
        panels: [
          'local-projects',
          'workspaces-list',
          'github-projects',
          'github-starred',
        ],
        config: {
          defaultActiveTab: 1,
          tabPosition: 'top' as const,
        },
      },
      middle: {
        type: 'tabs' as const,
        panels: ['workspace-entries', 'graph-view', 'readme-viewer'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      right: {
        type: 'tabs' as const,
        panels: showGitSyncPanel ? ['presence', 'github-social', 'git-sync-diagnostic'] : ['presence', 'github-social'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
    }),
    [showGitSyncPanel],
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
      <FeedViewHeader />

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
  );
};

export const FeedView: React.FC = () => {
  return (
    <WorkspaceFilterProvider>
      <SelectedRepositoryProvider>
        <FeedViewInner />
      </SelectedRepositoryProvider>
    </WorkspaceFilterProvider>
  );
};
