import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Workflow } from 'lucide-react';
import { useSequenceDiagramLibrary } from './useSequenceDiagramLibrary';
import { SequenceDiagramRow } from './SequenceDiagramRow';

export interface SequenceDiagramsPanelProps {
  repositoryPath?: string;
}

const repoBasename = (repositoryPath?: string): string | null => {
  if (!repositoryPath) return null;
  const trimmed = repositoryPath.replace(/[\\/]+$/, '');
  const idx = trimmed.search(/[\\/](?!.*[\\/])/);
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

export const SequenceDiagramsPanel: React.FC<SequenceDiagramsPanelProps> = ({
  repositoryPath,
}) => {
  const { theme } = useTheme();
  const { entries, activeId, loading, refresh, activate, remove } =
    useSequenceDiagramLibrary(repositoryPath ?? null);

  const repoLabel = repoBasename(repositoryPath);
  const isReady = !loading;
  const empty = entries.length === 0;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <Workflow size={18} strokeWidth={1.5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              lineHeight: 1.2,
            }}
          >
            Sequence Diagrams
          </h2>
          {repoLabel && (
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={repositoryPath}
            >
              for {repoLabel}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          title="Refresh"
          aria-label="Refresh"
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={12} />
        </button>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {!isReady && (
          <div
            style={{
              padding: '20px 0',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}
          >
            Loading…
          </div>
        )}

        {isReady && empty && (
          <EmptyState theme={theme} repositoryPath={repositoryPath} />
        )}

        {isReady &&
          !empty &&
          entries.map((entry) => (
            <SequenceDiagramRow
              key={entry.id}
              entry={entry}
              isActive={entry.id === activeId}
              onActivate={activate}
              onRemove={remove}
            />
          ))}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  repositoryPath?: string;
}> = ({ theme, repositoryPath }) => {
  const repoArg = repositoryPath
    ? `,\n    "repositoryPath": "${repositoryPath}"`
    : '';
  const snippet = `curl -XPOST http://localhost:3054/api/file-city/sequence \\\n  -H 'content-type: application/json' \\\n  -d '{\n    "title": "My flow"${repoArg},\n    "events": [...],\n    "edges": [...]\n  }'`;
  return (
    <div
      style={{
        padding: '20px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: theme.colors.textSecondary,
        fontSize: theme.fontSizes[1],
      }}
    >
      <div>No saved diagrams for this repository yet.</div>
      <div style={{ fontSize: theme.fontSizes[0] }}>
        Post one to <code>POST /api/file-city/sequence</code> to get started:
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[0],
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          overflowX: 'auto',
          whiteSpace: 'pre',
          color: theme.colors.text,
        }}
      >
        {snippet}
      </pre>
    </div>
  );
};
