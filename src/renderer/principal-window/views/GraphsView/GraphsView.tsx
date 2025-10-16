import React, { useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Network, Package, Eye, GitBranch } from 'lucide-react';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { useAllRepositories } from '../../../hooks/useRepositoryData';
import { buildDependencyGraphs, type DependencyGraph } from './graphDataBuilder';

export const GraphsView: React.FC = () => {
  const { theme } = useTheme();
  const { repositories, loading, error } = useAllRepositories();
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);

  // Build dependency graphs using cluster detection
  const graphs = useMemo(() => {
    if (repositories.length === 0) return [];
    return buildDependencyGraphs(repositories);
  }, [repositories]);

  // Get the currently selected graph
  const selectedGraph = useMemo(() => {
    return graphs.find((g) => g.id === selectedGraphId) || null;
  }, [graphs, selectedGraphId]);

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

    // Show selected graph info
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
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            {selectedGraph.nodes.length} nodes · {selectedGraph.edges.length}{' '}
            edges
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
            }}
          >
            {/* Graph Statistics */}
            <div
              style={{
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginBottom: '16px',
                  color: theme.colors.text,
                }}
              >
                Overview
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Repositories
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    {selectedGraph.metadata.totalRepositories}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Top-Level Repos
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    {selectedGraph.metadata.topLevelRepositories.length}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Connections
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 600,
                      color: theme.colors.primary,
                    }}
                  >
                    {selectedGraph.edges.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Top-Level Repositories */}
            {selectedGraph.metadata.topLevelRepositories.length > 0 && (
              <div
                style={{
                  marginBottom: '24px',
                  padding: '20px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h4
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: theme.colors.text,
                  }}
                >
                  Top-Level Repositories
                </h4>
                <p
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    marginBottom: '16px',
                  }}
                >
                  These repositories have no incoming dependencies from other
                  repos in this cluster
                </p>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  {selectedGraph.metadata.topLevelRepositories.map((repoName) => {
                    const node = selectedGraph.nodes.find(
                      (n) => n.name === repoName && n.type === 'repository',
                    );
                    if (!node) return null;

                    const outgoingEdges = selectedGraph.edges.filter(
                      (e) => e.source === node.id,
                    );

                    return (
                      <div
                        key={node.id}
                        style={{
                          padding: '12px',
                          backgroundColor: theme.colors.background,
                          borderRadius: '6px',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '6px',
                          }}
                        >
                          <GitBranch size={14} color={theme.colors.primary} />
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: theme.colors.text,
                            }}
                          >
                            {node.name}
                          </div>
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
                          <span>{node.packageNames.length} packages</span>
                          <span>→ {outgoingEdges.length} dependencies</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Repositories in Cluster */}
            <div
              style={{
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginBottom: '16px',
                  color: theme.colors.text,
                }}
              >
                All Repositories
              </h4>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {selectedGraph.nodes
                  .filter((n) => n.type === 'repository')
                  .map((node) => {
                    const outgoingEdges = selectedGraph.edges.filter(
                      (e) => e.source === node.id,
                    );
                    const incomingEdges = selectedGraph.edges.filter(
                      (e) => e.target === node.id,
                    );
                    const isTopLevel =
                      selectedGraph.metadata.topLevelRepositories.includes(
                        node.name,
                      );

                    return (
                      <div
                        key={node.id}
                        style={{
                          padding: '12px',
                          backgroundColor: isTopLevel
                            ? theme.colors.primary + '10'
                            : theme.colors.background,
                          borderRadius: '6px',
                          border: `1px solid ${
                            isTopLevel ? theme.colors.primary : theme.colors.border
                          }`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            marginBottom: '4px',
                          }}
                        >
                          {node.name}
                          {isTopLevel && (
                            <span
                              style={{
                                marginLeft: '8px',
                                fontSize: '11px',
                                color: theme.colors.primary,
                                fontWeight: 600,
                              }}
                            >
                              TOP-LEVEL
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            marginBottom: '6px',
                          }}
                        >
                          Packages: {node.packageNames.join(', ')}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            gap: '12px',
                          }}
                        >
                          <span>↑ {incomingEdges.length} depended on by</span>
                          <span>→ {outgoingEdges.length} depends on</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Placeholder for future visualization */}
            <div
              style={{
                padding: '32px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `2px dashed ${theme.colors.border}`,
                textAlign: 'center',
              }}
            >
              <Network
                size={48}
                color={theme.colors.textSecondary}
                style={{ margin: '0 auto 16px', display: 'block' }}
              />
              <div
                style={{
                  fontSize: '14px',
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                }}
              >
                Graph visualization coming soon
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                Interactive dependency graph will be displayed here
              </div>
            </div>
          </div>
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
