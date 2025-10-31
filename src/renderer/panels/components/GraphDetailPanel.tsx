import React, { useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Network } from 'lucide-react';
import { GraphVizPanel } from './GraphVizPanel';
import { graphToDot } from '../../services/GraphToDotService';
import type { DependencyGraph } from '../../services/DependencyGraphService';

export interface GraphDetailPanelProps {
  graph: DependencyGraph | null;
  selectedTopLevelNodes: string[];
  onTopLevelNodesChange: (nodes: string[]) => void;
}

export const GraphDetailPanel: React.FC<GraphDetailPanelProps> = ({
  graph,
  selectedTopLevelNodes,
  onTopLevelNodesChange,
}) => {
  const { theme } = useTheme();

  // Filter graph based on selected top-level nodes
  const filteredGraph = useMemo(() => {
    if (!graph || selectedTopLevelNodes.length === 0) {
      return graph;
    }

    // Find all nodes reachable from selected top-level nodes
    const reachableNodes = new Set<string>();
    const nodesToVisit = selectedTopLevelNodes
      .map((name) => graph.nodes.find((n) => n.name === name)?.id)
      .filter((id): id is string => id !== undefined);

    while (nodesToVisit.length > 0) {
      const nodeId = nodesToVisit.pop()!;
      if (reachableNodes.has(nodeId)) continue;

      reachableNodes.add(nodeId);

      // Add all nodes this one depends on
      graph.edges
        .filter((e) => e.source === nodeId)
        .forEach((e) => {
          if (!reachableNodes.has(e.target)) {
            nodesToVisit.push(e.target);
          }
        });
    }

    // Filter nodes and edges
    const filteredNodes = graph.nodes.filter((n) => reachableNodes.has(n.id));
    const filteredEdges = graph.edges.filter(
      (e) => reachableNodes.has(e.source) && reachableNodes.has(e.target),
    );

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [graph, selectedTopLevelNodes]);

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

  if (!graph) {
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
            <h3 style={{ fontSize: `${theme.fontSizes[1]}px`, fontWeight: theme.fontWeights.semibold, fontFamily: theme.fonts.body, margin: 0 }}>
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
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
                marginBottom: '12px',
              }}
            >
              Package Graph Visualization
            </h3>
            <p
              style={{
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
                lineHeight: theme.lineHeights.body,
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

  const toggleTopLevelNode = (nodeName: string) => {
    const newNodes = selectedTopLevelNodes.includes(nodeName)
      ? selectedTopLevelNodes.length === 1
        ? selectedTopLevelNodes // Don't allow deselecting the last node
        : selectedTopLevelNodes.filter((n) => n !== nodeName)
      : [...selectedTopLevelNodes, nodeName];
    onTopLevelNodesChange(newNodes);
  };

  const selectAllNodes = () => {
    onTopLevelNodesChange(graph.metadata.topLevelRepositories);
  };

  const deselectAllNodes = () => {
    // Keep at least one selected
    if (graph.metadata.topLevelRepositories.length > 0) {
      onTopLevelNodesChange([graph.metadata.topLevelRepositories[0]]);
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
          <h3 style={{ fontSize: `${theme.fontSizes[1]}px`, fontWeight: theme.fontWeights.semibold, fontFamily: theme.fonts.body, margin: 0 }}>
            {graph.name}
          </h3>
        </div>

        {/* Top-level nodes filter buttons */}
        {graph.metadata.topLevelRepositories.length > 1 && (
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
                fontSize: `${theme.fontSizes[0]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
                fontWeight: theme.fontWeights.medium,
              }}
            >
              Filter:
            </span>
            {graph.metadata.topLevelRepositories.map((nodeName) => {
              const isSelected = selectedTopLevelNodes.includes(nodeName);
              return (
                <button
                  key={nodeName}
                  onClick={() => toggleTopLevelNode(nodeName)}
                  style={{
                    padding: '6px 12px',
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontWeight: theme.fontWeights.medium,
                    fontFamily: theme.fonts.body,
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
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
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
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
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
            fontSize: `${theme.fontSizes[0]}px`,
            fontFamily: theme.fonts.body,
            color: theme.colors.textSecondary,
          }}
        >
          {filteredGraph?.nodes.length || 0} nodes ·{' '}
          {filteredGraph?.edges.length || 0} edges
          {selectedTopLevelNodes.length <
            graph.metadata.topLevelRepositories.length && (
            <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
              (showing {selectedTopLevelNodes.length} of{' '}
              {graph.metadata.topLevelRepositories.length} top-level)
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
