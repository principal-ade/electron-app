import React, { useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Network, Package, Eye } from 'lucide-react';
import { ConfigurablePanelLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { useAllRepositories } from '../../../hooks/useRepositoryData';
import { buildDependencyGraphs } from './graphDataBuilder';
import { GraphVizPanel } from '../../../panels/components/GraphVizPanel';
import { graphToDot } from './graphToDot';

export const GraphsView: React.FC = () => {
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

  // Filter graph based on selected top-level nodes
  const filteredGraph = useMemo(() => {
    if (!selectedGraph || selectedTopLevelNodes.length === 0) {
      return selectedGraph;
    }

    // Find all nodes reachable from selected top-level nodes
    const reachableNodes = new Set<string>();
    const nodesToVisit = selectedTopLevelNodes
      .map((name) => selectedGraph.nodes.find((n) => n.name === name)?.id)
      .filter((id): id is string => id !== undefined);

    while (nodesToVisit.length > 0) {
      const nodeId = nodesToVisit.pop()!;
      if (reachableNodes.has(nodeId)) continue;

      reachableNodes.add(nodeId);

      // Add all nodes this one depends on
      selectedGraph.edges
        .filter((e) => e.source === nodeId)
        .forEach((e) => {
          if (!reachableNodes.has(e.target)) {
            nodesToVisit.push(e.target);
          }
        });
    }

    // Filter nodes and edges
    const filteredNodes = selectedGraph.nodes.filter((n) =>
      reachableNodes.has(n.id),
    );
    const filteredEdges = selectedGraph.edges.filter(
      (e) => reachableNodes.has(e.source) && reachableNodes.has(e.target),
    );

    return {
      ...selectedGraph,
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [selectedGraph, selectedTopLevelNodes]);

  // Memoize the DOT string to prevent re-rendering the graph
  const graphDot = useMemo(() => {
    if (!filteredGraph) return '';
    return graphToDot(filteredGraph, {
      rankdir: 'TB',
      showPackageNames: true,
      showVersionRanges: false,
    });
  }, [filteredGraph]);

  // Memoize graphviz options
  const graphVizOptions = useMemo(
    () => ({
      engine: 'dot' as const,
      fit: true,
      zoom: true,
    }),
    [],
  );

  // Use panel persistence hook for three-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'graphsView',
    defaultSizes: { left: 20, middle: 80, right: 0 },
    collapsed: { left: false, right: true },
    panelType: 'three-panel',
  });

  // Render left panel - Graphs list
  const renderGraphsListPanel = () => {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <Package size={16} color={theme.colors.text} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
              Graphs
            </h3>
          </div>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            {graphs.length} {graphs.length === 1 ? 'graph' : 'graphs'} available
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '14px',
                padding: '16px',
              }}
            >
              Loading repositories...
            </div>
          ) : graphs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '14px',
                padding: '16px',
              }}
            >
              No graphs available
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Add repositories with package.json to see dependency graphs
              </div>
            </div>
          ) : (
            graphs.map((graph) => (
              <div
                key={graph.id}
                onClick={() => setSelectedGraphId(graph.id)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '6px',
                  backgroundColor:
                    selectedGraphId === graph.id
                      ? theme.colors.primary + '20'
                      : theme.colors.background,
                  border: `1px solid ${
                    selectedGraphId === graph.id
                      ? theme.colors.primary
                      : theme.colors.border
                  }`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedGraphId !== graph.id) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedGraphId !== graph.id) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={graph.name}
                >
                  {graph.name}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginBottom: '6px',
                  }}
                >
                  Top-level:{' '}
                  {graph.metadata.topLevelRepositories.slice(0, 2).join(', ')}
                  {graph.metadata.topLevelRepositories.length > 2 &&
                    ` +${graph.metadata.topLevelRepositories.length - 2} more`}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {graph.metadata.totalRepositories}{' '}
                    {graph.metadata.totalRepositories === 1 ? 'repo' : 'repos'}
                  </span>
                  <span>{graph.edges.length} connections</span>
                  {graph.metadata.isMonorepo && (
                    <span
                      style={{
                        color: theme.colors.primary,
                        fontWeight: 600,
                      }}
                    >
                      Monorepo
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Render middle panel - Graph visualization
  const renderGraphPanel = () => {
    if (!selectedGraph) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 24px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Network size={16} color={theme.colors.text} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                Graph
              </h3>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                maxWidth: '400px',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary + '20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                }}
              >
                <Network size={40} color={theme.colors.primary} />
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '12px',
                }}
              >
                Package Graph Visualization
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.6',
                }}
              >
                Select a graph from the left panel to visualize package
                dependencies and relationships.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Show selected graph with GraphViz visualization
    const toggleTopLevelNode = (nodeName: string) => {
      setSelectedTopLevelNodes((prev) => {
        if (prev.includes(nodeName)) {
          // Don't allow deselecting the last node
          if (prev.length === 1) return prev;
          return prev.filter((n) => n !== nodeName);
        } else {
          return [...prev, nodeName];
        }
      });
    };

    const selectAllNodes = () => {
      setSelectedTopLevelNodes(selectedGraph.metadata.topLevelRepositories);
    };

    const deselectAllNodes = () => {
      // Keep at least one selected
      if (selectedGraph.metadata.topLevelRepositories.length > 0) {
        setSelectedTopLevelNodes([
          selectedGraph.metadata.topLevelRepositories[0],
        ]);
      }
    };

    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <Network size={16} color={theme.colors.text} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
              {selectedGraph.name}
            </h3>
          </div>

          {/* Top-level nodes filter buttons */}
          {selectedGraph.metadata.topLevelRepositories.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  fontWeight: 500,
                }}
              >
                Filter:
              </span>
              {selectedGraph.metadata.topLevelRepositories.map((nodeName) => {
                const isSelected = selectedTopLevelNodes.includes(nodeName);
                return (
                  <button
                    key={nodeName}
                    onClick={() => toggleTopLevelNode(nodeName)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.background,
                      color: isSelected ? '#ffffff' : theme.colors.text,
                      border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundSecondary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.background;
                      }
                    }}
                  >
                    {nodeName}
                  </button>
                );
              })}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button
                  onClick={selectAllNodes}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: theme.colors.background,
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  All
                </button>
                <button
                  onClick={deselectAllNodes}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: theme.colors.background,
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            {filteredGraph?.nodes.length || 0} nodes ·{' '}
            {filteredGraph?.edges.length || 0} edges
            {selectedTopLevelNodes.length <
              selectedGraph.metadata.topLevelRepositories.length && (
              <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                (showing {selectedTopLevelNodes.length} of{' '}
                {selectedGraph.metadata.topLevelRepositories.length} top-level)
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <GraphVizPanel
            dot={graphDot}
            showHeader={false}
            options={graphVizOptions}
          />
        </div>
      </div>
    );
  };

  // Render right panel - Visible Graph Packages
  const renderPackagesPanel = () => {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <Eye size={16} color={theme.colors.text} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
              Visible Graph Packages
            </h3>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: '14px',
            }}
          >
            No packages to display
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
        <Network size={20} color={theme.colors.text} />
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
          Package Graphs
        </h2>
      </div>

      {/* Panel Layout */}
      <ConfigurablePanelLayout
        panels={[
          {
            id: 'graphs-list',
            label: 'Graphs',
            content: renderGraphsListPanel(),
          },
          {
            id: 'graph-view',
            label: 'Graph',
            content: renderGraphPanel(),
          },
          {
            id: 'packages-list',
            label: 'Visible Graph Packages',
            content: renderPackagesPanel(),
          },
        ]}
        layout={{
          left: 'graphs-list',
          middle: 'graph-view',
          right: 'packages-list',
        }}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={
          panelState.type === 'three-panel'
            ? panelState.sizes
            : { left: 20, middle: 50, right: 30 }
        }
        minSizes={{ left: 15, middle: 30, right: 20 }}
        collapsed={
          panelState.type === 'three-panel'
            ? panelState.collapsed
            : { left: false, right: false }
        }
        style={{ height: '100%', width: '100%' }}
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
  );
};
