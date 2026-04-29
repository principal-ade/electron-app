import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitBranch, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { GitService } from '../../main-process-api/GitService';

export interface GitConfigPanelProps {
  repositoryPath?: string;
}

type Protocol = 'ssh' | 'https' | 'unknown';

function detectProtocol(url: string | null): Protocol {
  if (!url) return 'unknown';
  if (url.startsWith('git@') || url.includes('ssh://')) return 'ssh';
  if (url.startsWith('https://')) return 'https';
  return 'unknown';
}

function convertProtocol(url: string): string | null {
  const sshMatch = url.match(/git@([^:]+):(.+)/);
  const sshUrlMatch = url.match(/ssh:\/\/git@([^/]+)\/(.+)/);
  if (sshMatch) {
    const [, host, path] = sshMatch;
    return `https://${host}/${path}`;
  }
  if (sshUrlMatch) {
    const [, host, path] = sshUrlMatch;
    return `https://${host}/${path}`;
  }
  const httpsMatch = url.match(/https:\/\/([^/]+)\/(.+)/);
  if (httpsMatch) {
    const [, host, path] = httpsMatch;
    return `git@${host}:${path}`;
  }
  return null;
}

export const GitConfigPanel: React.FC<GitConfigPanelProps> = ({
  repositoryPath,
}) => {
  const { theme } = useTheme();
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRemote = useCallback(async () => {
    if (!repositoryPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.mainProcess.git.execCommand(repositoryPath, [
        'remote',
        'get-url',
        'origin',
      ]);
      const url = result.stdout.trim();
      setRemoteUrl(url || null);
    } catch (err) {
      console.error('[GitConfigPanel] Failed to read remote URL:', err);
      setRemoteUrl(null);
      setError(
        err instanceof Error ? err.message : 'Failed to read remote URL',
      );
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    loadRemote();
  }, [loadRemote]);

  const protocol = detectProtocol(remoteUrl);
  const otherProtocol: Protocol = protocol === 'ssh' ? 'https' : 'ssh';

  const handleSwitchProtocol = useCallback(async () => {
    if (!repositoryPath || !remoteUrl || protocol === 'unknown') return;
    const newUrl = convertProtocol(remoteUrl);
    if (!newUrl) {
      setError(`Could not parse remote URL: ${remoteUrl}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await GitService.setRemoteUrl(
        repositoryPath,
        'origin',
        newUrl,
      );
      if (!result.success) {
        setError(result.message);
        return;
      }
      setRemoteUrl(newUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch remote');
    } finally {
      setBusy(false);
    }
  }, [repositoryPath, remoteUrl, protocol]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '20px',
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          paddingBottom: '12px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <GitBranch size={20} strokeWidth={1.5} />
        <h2
          style={{
            margin: 0,
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
          }}
        >
          Git Config
        </h2>
      </header>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '14px',
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <LinkIcon size={14} />
            <span>Remote: origin</span>
          </div>
          <button
            onClick={loadRemote}
            disabled={loading || !repositoryPath}
            title="Reload remote URL"
            aria-label="Reload remote URL"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: loading || !repositoryPath ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[0],
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ color: theme.colors.textSecondary }}>Loading…</div>
        ) : !repositoryPath ? (
          <div style={{ color: theme.colors.textSecondary }}>
            No repository selected.
          </div>
        ) : !remoteUrl ? (
          <div style={{ color: theme.colors.textSecondary }}>
            No origin remote configured.
          </div>
        ) : (
          <>
            <code
              style={{
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[1],
                background: theme.colors.background,
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                wordBreak: 'break-all',
              }}
            >
              {remoteUrl}
            </code>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                }}
              >
                Protocol:{' '}
                <span
                  style={{
                    color: theme.colors.text,
                    fontWeight: theme.fontWeights.semibold,
                  }}
                >
                  {protocol === 'unknown' ? 'Unknown' : protocol.toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleSwitchProtocol}
                disabled={busy || protocol === 'unknown'}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.backgroundTertiary,
                  color: theme.colors.text,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  cursor:
                    busy || protocol === 'unknown' ? 'not-allowed' : 'pointer',
                  opacity: busy || protocol === 'unknown' ? 0.6 : 1,
                }}
              >
                {busy
                  ? 'Switching…'
                  : `Switch to ${otherProtocol.toUpperCase()}`}
              </button>
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              color: '#dc2626',
              fontSize: theme.fontSizes[1],
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
            }}
          >
            {error}
          </div>
        )}
      </section>
    </div>
  );
};
