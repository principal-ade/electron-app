import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Package } from 'lucide-react';
import type { DependencyGraph } from '../../services/DependencyGraphService';

export interface GraphsListPanelProps {
  graphs: DependencyGraph[];
  loading: boolean;
  selectedGraphId: string | null;
  onGraphSelect: (graphId: string) => void;
}

export const GraphsListPanel: React.FC<GraphsListPanelProps> = ({
  graphs,
  loading,
  selectedGraphId,
  onGraphSelect,
}) => {
  const { theme } = useTheme();

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
          <h3 style={{ fontSize: `${theme.fontSizes[1]}px`, fontWeight: theme.fontWeights.semibold, fontFamily: theme.fonts.body, margin: 0 }}>
            Graphs
          </h3>
        </div>
        <div
          style={{
            fontSize: `${theme.fontSizes[0]}px`,
            fontFamily: theme.fonts.body,
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
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
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
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              padding: '16px',
            }}
          >
            No graphs available
            <div style={{ fontSize: `${theme.fontSizes[0]}px`, fontFamily: theme.fonts.body, marginTop: '8px' }}>
              Add repositories with package.json to see dependency graphs
            </div>
          </div>
        ) : (
          graphs.map((graph) => (
            <div
              key={graph.id}
              onClick={() => onGraphSelect(graph.id)}
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
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
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
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
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
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
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
                      fontWeight: theme.fontWeights.semibold,
                      fontFamily: theme.fonts.body,
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
