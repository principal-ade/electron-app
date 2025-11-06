import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  FolderGit2,
  Users,
  History,
  Network,
  FileText,
  UserCheck,
  Star,
  Activity,
  Folder,
  GitBranch,
  FolderOpen,
  ChevronDown,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { ConfigurablePanelLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { useAllRepositories } from '../../../hooks/useRepositoryData';
import { buildDependencyGraphs } from '../../../services/DependencyGraphService';
import { GraphsListPanel } from '../../../panels/components/GraphsListPanel';
import { GraphDetailPanel } from '../../../panels/components/GraphDetailPanel';
import { GitHubProjectsPanel } from '../../../panels/components/GitHubProjectsPanel';
import { GitHubStarredPanel } from '../../../panels/components/GitHubStarredPanel';
import { GitHubSocialPanel } from '../../../panels/components/GitHubSocialPanel';
import { RecentCommitsPanel } from '../../../panels/components/RecentCommitsPanel';
import { GitHubReadmePanel } from '../../../panels/components/GitHubReadmePanel';
import { GitHubUserSignalsPanel } from '../../../panels/components/GitHubUserSignalsPanel';
import { GitSyncDiagnosticPanel } from '../../../panels/components/GitSyncDiagnosticPanel';
import { LocalProjectsPanel } from '../../../panels/components/LocalProjectsPanel';
import { PresencePanel } from '../../../panels/components/PresencePanel';
import {
  SelectedRepositoryProvider,
  useSelectedRepository,
} from '../../../contexts/SelectedRepositoryContext';
import {
  WorkspaceFilterProvider,
  useWorkspaceFilter,
} from '../../../contexts/WorkspaceFilterContext';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { MultiRepoWorkspace } from '../../../../shared/types/userPreferences.types';

const FeedViewInner: React.FC = () => {
  const { theme } = useTheme();
  const { repositories, loading } = useAllRepositories();
  const { selectedRepository } = useSelectedRepository();
  const { selectedWorkspaceId, setSelectedWorkspaceId, setSelectedWorkspace } =
    useWorkspaceFilter();

  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedTopLevelNodes, setSelectedTopLevelNodes] = useState<string[]>(
    [],
  );
  const [showGitSyncPanel, setShowGitSyncPanel] = useState(false);

  // Multi-Repo Workspace state
  const [workspaces, setWorkspaces] = useState<MultiRepoWorkspace[]>([]);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspacePath, setNewWorkspacePath] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  // Build dependency graphs using cluster detection
  const graphs = useMemo(() => {
    if (repositories.length === 0) return [];
    return buildDependencyGraphs(repositories);
  }, [repositories]);

  // Get the currently selected graph
  const selectedGraph = useMemo(() => {
    return graphs.find((g) => g.id === selectedGraphId) || null;
  }, [graphs, selectedGraphId]);

  // Initialize selected top-level nodes when graph changes
  React.useEffect(() => {
    if (selectedGraph) {
      setSelectedTopLevelNodes(selectedGraph.metadata.topLevelRepositories);
    } else {
      setSelectedTopLevelNodes([]);
    }
  }, [selectedGraph]);

  // Load git sync panel visibility preference and workspaces
  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        setShowGitSyncPanel(prefs.showGitSyncPanel ?? false);
        setWorkspaces(prefs.multiRepoWorkspaces ?? []);
      })
      .catch(console.error);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.showGitSyncPanel !== undefined) {
        setShowGitSyncPanel(detail.showGitSyncPanel);
      }
      if (detail?.multiRepoWorkspaces !== undefined) {
        setWorkspaces(detail.multiRepoWorkspaces ?? []);
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

  // Handler for creating a new workspace
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !newWorkspacePath.trim()) {
      return;
    }

    const newWorkspace: MultiRepoWorkspace = {
      id: `workspace-${Date.now()}`,
      name: newWorkspaceName,
      path: newWorkspacePath,
      description: newWorkspaceDescription || undefined,
      isDefault: workspaces.length === 0, // First workspace becomes default
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedWorkspaces = [...workspaces, newWorkspace];
    setWorkspaces(updatedWorkspaces);

    await UserPreferencesService.updatePreferences({
      multiRepoWorkspaces: updatedWorkspaces,
      defaultMultiRepoWorkspaceId: newWorkspace.isDefault ? newWorkspace.id : undefined,
    });

    // Select the newly created workspace
    setSelectedWorkspaceId(newWorkspace.id);

    // Reset form
    setIsCreatingWorkspace(false);
    setNewWorkspaceName('');
    setNewWorkspacePath('');
    setNewWorkspaceDescription('');
  };

  // Handler for browsing workspace path
  const handleBrowseWorkspacePath = async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Workspace Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (!result || result.canceled || !result.filePaths?.[0]) {
        return;
      }

      setNewWorkspacePath(result.filePaths[0]);
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  // Update context when selected workspace changes
  useEffect(() => {
    if (selectedWorkspaceId === 'all') {
      setSelectedWorkspace(null);
    } else {
      const workspace = workspaces.find((w) => w.id === selectedWorkspaceId);
      setSelectedWorkspace(workspace || null);
    }
  }, [selectedWorkspaceId, workspaces, setSelectedWorkspace]);

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
        id: 'recent-commits',
        label: 'Recent Commits',
        icon: <History size={16} />,
        content: <RecentCommitsPanel repository={selectedRepository} />,
      },
      {
        id: 'readme-viewer',
        label: 'README',
        icon: <FileText size={16} />,
        content: <GitHubReadmePanel repository={selectedRepository} />,
      },
      {
        id: 'github-user-signals',
        label: 'User Signals',
        icon: <UserCheck size={16} />,
        content: <GitHubUserSignalsPanel />,
      },
      {
        id: 'graphs-list',
        label: 'Graphs',
        icon: <Network size={16} />,
        content: (
          <GraphsListPanel
            graphs={graphs}
            loading={loading}
            selectedGraphId={selectedGraphId}
            onGraphSelect={setSelectedGraphId}
          />
        ),
      },
      {
        id: 'graph-view',
        label: 'Graph',
        icon: <Network size={16} />,
        content: (
          <GraphDetailPanel
            graph={selectedGraph}
            selectedTopLevelNodes={selectedTopLevelNodes}
            onTopLevelNodesChange={setSelectedTopLevelNodes}
          />
        ),
      },
      {
        id: 'presence',
        label: 'Live Presence',
        icon: <Users size={16} />,
        content: <PresencePanel />,
      },
    ];

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
    graphs,
    loading,
    selectedGraphId,
    selectedGraph,
    selectedTopLevelNodes,
    selectedRepository,
    showGitSyncPanel,
  ]);

  // Memoize layout based on git sync panel visibility
  const layout = useMemo(
    () => ({
      left: {
        type: 'tabs' as const,
        panels: [
          'local-projects',
          'github-projects',
          'github-starred',
          'graphs-list',
        ],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      middle: {
        type: 'tabs' as const,
        panels: ['readme-viewer', 'recent-commits'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      right: {
        type: 'tabs' as const,
        panels: showGitSyncPanel ? ['presence', 'github-social', 'github-user-signals', 'git-sync-diagnostic'] : ['presence', 'github-social', 'github-user-signals'],
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        {/* Left: Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={20} color={theme.colors.text} />
          <h2 style={{ fontSize: theme.fontSizes[4], fontWeight: theme.fontWeights.semibold, margin: 0 }}>
            {selectedWorkspaceId === 'all'
              ? 'All Projects'
              : workspaces.find((w) => w.id === selectedWorkspaceId)?.name || 'Projects'}
          </h2>
        </div>

        {/* Right: Workspace Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isCreatingWorkspace ? (
            <>
              {/* Workspace Dropdown - only show if workspaces exist */}
              {workspaces.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedWorkspaceId}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value as string | 'all')}
                    style={{
                      padding: '8px 32px 8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      fontSize: theme.fontSizes[1],
                      cursor: 'pointer',
                      appearance: 'none',
                      minWidth: '180px',
                    }}
                  >
                    <option value="all">All Projects</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: theme.colors.textSecondary,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              )}

              {/* Create Workspace Button */}
              <button
                onClick={() => setIsCreatingWorkspace(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: theme.colors.primary,
                  border: 'none',
                  borderRadius: '6px',
                  color: theme.colors.background,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                title="Create new workspace"
              >
                <Plus size={14} />
                {workspaces.length === 0 ? 'Create Workspace' : 'New Workspace'}
              </button>
            </>
          ) : (
            /* Create Workspace Form */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <input
                type="text"
                placeholder="Workspace name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: theme.fontSizes[1],
                  width: '140px',
                }}
              />
              <button
                onClick={handleBrowseWorkspacePath}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Browse directory"
              >
                <FolderOpen size={14} />
                {newWorkspacePath ? '✓' : 'Browse'}
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!newWorkspaceName.trim() || !newWorkspacePath.trim()}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: theme.colors.success,
                  color: 'white',
                  cursor: newWorkspaceName.trim() && newWorkspacePath.trim() ? 'pointer' : 'not-allowed',
                  fontSize: theme.fontSizes[1],
                  opacity: newWorkspaceName.trim() && newWorkspacePath.trim() ? 1 : 0.5,
                }}
                title="Create workspace"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => {
                  setIsCreatingWorkspace(false);
                  setNewWorkspaceName('');
                  setNewWorkspacePath('');
                  setNewWorkspaceDescription('');
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

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
