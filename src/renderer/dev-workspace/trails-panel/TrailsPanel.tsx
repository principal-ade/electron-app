import React, { useCallback, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AlertCircle, RefreshCw, Route } from 'lucide-react';
import type { BaseTrailIndexEntry } from '@industry-theme/file-city-panel';
import { APP_BRANDING } from '../../../shared/config/appBranding';
import { useTrailLibrary } from './useTrailLibrary';
import { useTrailShares } from './useTrailShares';
import { TrailRow } from './TrailRow';
import { SharedTrailRow } from './SharedTrailRow';
import { TrailShareModal } from './TrailShareModal';
import { TrailShareService } from '../../services/TrailShareService';

const webAdeBaseUrl = (): string =>
  process.env.NODE_ENV === 'development'
    ? APP_BRANDING.WEB_ADE_URL.DEVELOPMENT
    : APP_BRANDING.WEB_ADE_URL.PRODUCTION;

const trailShareUrl = (id: string): string => `${webAdeBaseUrl()}/trail/${id}`;

interface ShareModalState {
  trail: BaseTrailIndexEntry;
  initialUrl: string | null;
  /**
   * `local` trails can run the share IPC; `shared` rows always open in
   * success state with `initialUrl` pre-filled.
   */
  source: 'local' | 'shared';
}

export interface TrailsPanelProps {
  repositoryPath?: string;
}

const repoBasename = (repositoryPath?: string): string | null => {
  if (!repositoryPath) return null;
  const trimmed = repositoryPath.replace(/[\\/]+$/, '');
  const idx = trimmed.search(/[\\/](?!.*[\\/])/);
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

export const TrailsPanel: React.FC<TrailsPanelProps> = ({ repositoryPath }) => {
  const { theme } = useTheme();
  const library = useTrailLibrary(repositoryPath ?? null);
  const shares = useTrailShares(repositoryPath ?? null);
  const [shareModal, setShareModal] = useState<ShareModalState | null>(null);

  const repoLabel = repoBasename(repositoryPath);

  const handleRefresh = useCallback(async () => {
    await Promise.all([library.refresh(), shares.refresh()]);
  }, [library, shares]);

  const handleOpenShareModal = useCallback(
    async (id: string) => {
      const entry = library.entries.find((e) => e.id === id);
      if (!entry) return;
      setShareModal({
        trail: entry,
        initialUrl: shares.sharedUrlByLocalId.get(id) ?? null,
        source: 'local',
      });
    },
    [library.entries, shares.sharedUrlByLocalId],
  );

  const handleCopyLinkForShared = useCallback(
    (id: string) => {
      const entry = shares.entries.find((e) => e.id === id);
      if (!entry) return;
      setShareModal({
        trail: entry,
        initialUrl: trailShareUrl(id),
        source: 'shared',
      });
    },
    [shares.entries],
  );

  const handleShareCompleted = useCallback(
    (id: string, url: string) => {
      shares.recordShare(id, url);
      // Refresh the shared list so the just-shared entry appears under
      // "Shared with this repo" — round-trip verification path.
      shares.refresh();
    },
    [shares],
  );

  const handleActivateShared = useCallback(
    async (id: string) => {
      const fetched = await shares.hydrate(id);
      if (!fetched) {
        throw new Error('No origin resolved for this repo.');
      }
      await TrailShareService.setTransient(fetched.payload);
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
        <Route size={18} strokeWidth={1.5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              lineHeight: 1.2,
            }}
          >
            Trails
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
              <TrailRow
                key={entry.id}
                entry={entry}
                isActive={entry.id === library.activeId}
                onActivate={library.activate}
                onRemove={library.remove}
                shareUrl={shares.sharedUrlByLocalId.get(entry.id) ?? null}
                onShare={handleOpenShareModal}
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
                  'Could not load shared trails from web-ade.'
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
                <SharedTrailRow
                  key={entry.id}
                  entry={entry}
                  onActivate={handleActivateShared}
                  onCopyLink={handleCopyLinkForShared}
                />
              ))}
          </Section>
        )}
      </div>

      {shareModal && (
        <TrailShareModal
          trail={shareModal.trail}
          repositoryPath={
            shareModal.source === 'local' ? repositoryPath : undefined
          }
          initialUrl={shareModal.initialUrl}
          onClose={() => setShareModal(null)}
          onShared={
            shareModal.source === 'local'
              ? (url) => handleShareCompleted(shareModal.trail.id, url)
              : undefined
          }
        />
      )}
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
  const snippet = `curl -XPOST http://localhost:3054/api/file-city/trail \\\n  -H 'content-type: application/json' \\\n  -d '{\n    "id": "trail-1",\n    "title": "My walkthrough"${repoArg},\n    "markers": [...],\n    "views": [{ "kind": "sequence", "markers": [...], "edges": [...] }],\n    "createdAt": "2026-05-06T00:00:00Z",\n    "updatedAt": "2026-05-06T00:00:00Z"\n  }'`;
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
      <div>No saved trails for this repository yet.</div>
      <div style={{ fontSize: theme.fontSizes[0] }}>
        Post one to <code>POST /api/file-city/trail</code> to get started:
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
