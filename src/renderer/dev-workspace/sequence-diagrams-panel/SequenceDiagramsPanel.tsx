import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AlertCircle, RefreshCw, Workflow } from 'lucide-react';
import { useSequenceDiagramLibrary } from './useSequenceDiagramLibrary';
import { useSequenceDiagramShares } from './useSequenceDiagramShares';
import { SequenceDiagramRow } from './SequenceDiagramRow';
import { SharedSequenceDiagramRow } from './SharedSequenceDiagramRow';
import { SequenceDiagramShareService } from '../../services/SequenceDiagramShareService';

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
  const library = useSequenceDiagramLibrary(repositoryPath ?? null);
  const shares = useSequenceDiagramShares(repositoryPath ?? null);

  const repoLabel = repoBasename(repositoryPath);

  const handleRefresh = useCallback(async () => {
    await Promise.all([library.refresh(), shares.refresh()]);
  }, [library, shares]);

  const handleShareLocal = useCallback(
    async (id: string) => {
      const result = await SequenceDiagramShareService.share(id, {
        repositoryPath,
      });
      shares.recordShare(id, result.url);
      // Refresh the shared list so the just-shared entry appears under
      // "Shared with this repo" — this is the round-trip verification path.
      shares.refresh();
    },
    [repositoryPath, shares],
  );

  const handleActivateShared = useCallback(
    async (id: string) => {
      const fetched = await shares.hydrate(id);
      if (!fetched) {
        throw new Error('No origin resolved for this repo.');
      }
      await SequenceDiagramShareService.setTransient(fetched.payload);
    },
    [shares],
  );

  const localReady = !library.loading;
  const localEmpty = library.entries.length === 0;
  const showSharedSection = shares.availability !== 'unavailable';
  const sharedLoading = shares.availability === 'pending' || shares.loading;

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
          onClick={handleRefresh}
          title="Refresh"
          aria-label="Refresh"
          disabled={library.loading || sharedLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor:
              library.loading || sharedLoading ? 'not-allowed' : 'pointer',
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
          gap: '16px',
        }}
      >
        <Section
          theme={theme}
          title={showSharedSection ? 'On this machine' : null}
        >
          {!localReady && <Loading theme={theme} />}
          {localReady && localEmpty && (
            <EmptyState theme={theme} repositoryPath={repositoryPath} />
          )}
          {localReady &&
            !localEmpty &&
            library.entries.map((entry) => (
              <SequenceDiagramRow
                key={entry.id}
                entry={entry}
                isActive={entry.id === library.activeId}
                onActivate={library.activate}
                onRemove={library.remove}
                shareUrl={shares.sharedUrlByLocalId.get(entry.id) ?? null}
                onShare={handleShareLocal}
              />
            ))}
        </Section>

        {showSharedSection && (
          <Section theme={theme} title="Shared with this repo">
            {sharedLoading && <Loading theme={theme} />}
            {!sharedLoading && shares.availability === 'error' && (
              <ErrorRow
                theme={theme}
                message={
                  shares.errorMessage ??
                  'Could not load shared diagrams from web-ade.'
                }
                onRetry={shares.refresh}
              />
            )}
            {!sharedLoading &&
              shares.availability === 'available' &&
              shares.entries.length === 0 && (
                <div
                  style={{
                    padding: '12px 4px',
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                  }}
                >
                  No shares yet for this repo.
                </div>
              )}
            {!sharedLoading &&
              shares.availability === 'available' &&
              shares.entries.map((entry) => (
                <SharedSequenceDiagramRow
                  key={entry.id}
                  entry={entry}
                  onActivate={handleActivateShared}
                />
              ))}
          </Section>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  title: string | null;
  children: React.ReactNode;
}> = ({ theme, title, children }) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}
  >
    {title && (
      <div
        style={{
          fontSize: theme.fontSizes[0],
          fontWeight: theme.fontWeights.semibold,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.colors.textSecondary,
          paddingBottom: '4px',
        }}
      >
        {title}
      </div>
    )}
    {children}
  </section>
);

const Loading: React.FC<{ theme: ReturnType<typeof useTheme>['theme'] }> = ({
  theme,
}) => (
  <div
    style={{
      padding: '12px 0',
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: theme.fontSizes[1],
    }}
  >
    Loading…
  </div>
);

const ErrorRow: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  message: string;
  onRetry: () => void;
}> = ({ theme, message, onRetry }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.background,
      color: theme.colors.error ?? theme.colors.textSecondary,
      fontSize: theme.fontSizes[0],
    }}
  >
    <AlertCircle size={14} />
    <span style={{ flex: 1, minWidth: 0 }} title={message}>
      {message}
    </span>
    <button
      type="button"
      onClick={onRetry}
      style={{
        padding: '4px 8px',
        borderRadius: '6px',
        border: `1px solid ${theme.colors.border}`,
        background: 'transparent',
        color: theme.colors.textSecondary,
        cursor: 'pointer',
        fontSize: theme.fontSizes[0],
      }}
    >
      Retry
    </button>
  </div>
);

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
