import React, { useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Rss } from 'lucide-react';
import { ConfigurablePanelLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { useAllRepositories } from '../../../hooks/useRepositoryData';
import { buildDependencyGraphs } from '../../../services/DependencyGraphService';
import { GraphsListPanel } from '../../../panels/components/GraphsListPanel';
import { GraphDetailPanel } from '../../../panels/components/GraphDetailPanel';
import { GitHubStarsPanel } from '../../../panels/components/GitHubStarsPanel';
import { GitHubSocialPanel } from '../../../panels/components/GitHubSocialPanel';
import { RecentCommitsPanel } from '../../../panels/components/RecentCommitsPanel';
import { VisibleProjectsProvider } from '../../../contexts/VisibleProjectsContext';

export const FeedView: React.FC = () => {
  const { theme } = useTheme();
  const { repositories, loading } = useAllRepositories();
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedTopLevelNodes, setSelectedTopLevelNodes] = useState<string[]>(
    [],
  );

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
  }, [selectedGraph?.id]);

  // Use panel persistence hook for three-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'feedView',
    defaultSizes: { left: 20, middle: 80, right: 0 },
    collapsed: { left: false, right: true },
    panelType: 'three-panel',
  });

  return (
    <VisibleProjectsProvider>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          <Rss size={20} color={theme.colors.text} />
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
            Feed
          </h2>
        </div>

        {/* Panel Layout */}
        <ConfigurablePanelLayout
          panels={[
            {
              id: 'github-stars',
              label: 'GitHub Stars',
              content: <GitHubStarsPanel />,
            },
            {
              id: 'github-social',
              label: 'GitHub Network',
              content: <GitHubSocialPanel />,
            },
            {
              id: 'recent-commits',
              label: 'Recent Commits',
              content: <RecentCommitsPanel />,
            },
            {
              id: 'graphs-list',
              label: 'Graphs',
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
              content: (
                <GraphDetailPanel
                  graph={selectedGraph}
                  selectedTopLevelNodes={selectedTopLevelNodes}
                  onTopLevelNodesChange={setSelectedTopLevelNodes}
                />
              ),
            },
          ]}
          layout={{
            left: {
              type: 'tabs',
              panels: ['github-social', 'github-stars', 'graphs-list'],
              config: {
                defaultActiveTab: 0,
                tabPosition: 'top',
              },
            },
            middle: 'recent-commits',
            right: null,
          }}
          collapsiblePanels={{ left: true, right: false }}
          defaultSizes={
            panelState.type === 'three-panel'
              ? panelState.sizes
              : { left: 20, middle: 80, right: 0 }
          }
          minSizes={{ left: 15, middle: 30, right: 20 }}
          collapsed={
            panelState.type === 'three-panel'
              ? panelState.collapsed
              : { left: false, right: false }
          }
          style={{ flex: 1, width: '100%' }}
          theme={theme}
          showCollapseButtons={true}
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
    </VisibleProjectsProvider>
  );
};
