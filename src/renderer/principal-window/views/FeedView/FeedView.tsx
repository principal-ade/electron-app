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
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';

const FeedViewInner: React.FC = () => {
  const { theme } = useTheme();
  const { repositories, loading } = useAllRepositories();
  const { selectedRepository } = useSelectedRepository();
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedTopLevelNodes, setSelectedTopLevelNodes] = useState<string[]>(
    [],
  );
  const [showGitSyncPanel, setShowGitSyncPanel] = useState(false);

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

  // Load git sync panel visibility preference
  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        setShowGitSyncPanel(prefs.showGitSyncPanel ?? false);
      })
      .catch(console.error);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.showGitSyncPanel !== undefined) {
        setShowGitSyncPanel(detail.showGitSyncPanel);
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
    defaultSizes: { left: 20, middle: 55, right: 25 },
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
          'github-social',
          'graphs-list',
        ],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top' as const,
        },
      },
      middle: {
        type: 'tabs' as const,
        panels: ['recent-commits', 'readme-viewer', 'github-user-signals'],
        config: {
          defaultActiveTab: 1,
          tabPosition: 'top' as const,
        },
      },
      right: {
        type: 'tabs' as const,
        panels: showGitSyncPanel ? ['presence', 'git-sync-diagnostic'] : ['presence'],
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
          gap: '8px',
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <GitBranch size={20} color={theme.colors.text} />
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
          Projects
        </h2>
      </div>

      {/* Panel Layout */}
      <ConfigurablePanelLayout
        panels={panels}
        layout={layout}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={
          panelState.type === 'three-panel'
            ? panelState.sizes
            : { left: 20, middle: 55, right: 25 }
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
    <SelectedRepositoryProvider>
      <FeedViewInner />
    </SelectedRepositoryProvider>
  );
};
