import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type {
  CacheSlice,
  CacheSliceState,
  ServerDiagnostics,
  LifecycleEvent,
  LifecyclePhase,
  RepoMonitorDiagnostics,
} from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { ShellService } from '../../../main-process-api/ShellService';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

const PHASE_LABELS: Record<LifecyclePhase, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  disconnecting: 'Disconnecting',
  disconnected: 'Disconnected',
  unreachable: 'Unreachable',
};

const OWNER_LABELS: Record<
  NonNullable<ServerDiagnostics['daemon']>['owner'],
  string
> = {
  desktop: 'this app',
  studio: 'Subsystems Studio',
  external: 'another process',
};

export function phaseLabel(phase: LifecyclePhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function phaseAccentColor(
  phase: LifecyclePhase,
  theme: ThemeShape,
): string {
  switch (phase) {
    case 'connected':
      return theme.colors.success;
    case 'connecting':
    case 'reconnecting':
      return theme.colors.info ?? theme.colors.primary;
    case 'disconnecting':
      return theme.colors.warning;
    case 'unreachable':
      return theme.colors.error;
    case 'disconnected':
    case 'idle':
    default:
      return theme.colors.textSecondary;
  }
}

export function phaseTooltip(
  phase: LifecyclePhase,
  diag: ServerDiagnostics | null,
): string {
  if (!diag) return phaseLabel(phase);
  const parts: string[] = [phaseLabel(phase)];
  if (diag.daemonPid) parts.push(`daemon pid ${String(diag.daemonPid)}`);
  if (diag.lastDisconnect) {
    parts.push(`last disconnect: ${diag.lastDisconnect.reason}`);
  }
  if (diag.lastError) parts.push(`last error: ${diag.lastError.message}`);
  return parts.join(' — ');
}

function formatRelativeDuration(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatClockTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3,
  )}`;
}

const Collapsible: React.FC<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
  theme: ThemeShape;
  accent?: string;
  children: React.ReactNode;
}> = ({ title, expanded, onToggle, theme, accent, children }) => {
  return (
    <div style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: accent ?? theme.colors.text,
          fontSize: '12px',
          fontWeight: 600,
          textAlign: 'left',
          letterSpacing: '0.02em',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {expanded && children}
    </div>
  );
};

const LifecycleRow: React.FC<{ evt: LifecycleEvent; theme: ThemeShape }> = ({
  evt,
  theme,
}) => {
  const color = phaseAccentColor(evt.phase, theme);
  const details: string[] = [];
  if (typeof evt.attempt === 'number') {
    details.push(`attempt ${String(evt.attempt)}`);
  }
  if (evt.daemonPid) details.push(`pid ${String(evt.daemonPid)}`);
  if (typeof evt.durationInPrevPhaseMs === 'number') {
    details.push(`+${formatRelativeDuration(evt.durationInPrevPhaseMs)}`);
  }
  if (evt.note) details.push(evt.note);
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '6px 20px',
        borderTop: `1px solid ${theme.colors.border}`,
      }}
    >
      <span
        style={{
          color: theme.colors.textSecondary,
          minWidth: '92px',
          flexShrink: 0,
        }}
      >
        {formatClockTime(evt.ts)}
      </span>
      <span
        style={{
          color,
          fontWeight: 600,
          minWidth: '88px',
          flexShrink: 0,
        }}
      >
        {phaseLabel(evt.phase)}
      </span>
      <span
        style={{
          color: theme.colors.text,
          flex: 1,
          minWidth: 0,
          wordBreak: 'break-word',
        }}
      >
        {details.join(' · ')}
        {evt.error && (
          <span style={{ color: theme.colors.error }}>
            {details.length > 0 ? ' · ' : ''}
            {evt.error.message}
          </span>
        )}
      </span>
    </div>
  );
};

const SLICE_META: Array<{ slice: CacheSlice; label: string }> = [
  { slice: 'fileTree', label: 'File tree' },
  { slice: 'packages', label: 'Packages' },
  { slice: 'gitStatus', label: 'Git status' },
  { slice: 'gitRemote', label: 'Git remote' },
];

function formatAge(ts: number | undefined, now: number): string {
  if (ts === undefined) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const SliceCell: React.FC<{
  state: CacheSliceState | undefined;
  now: number;
  theme: ThemeShape;
}> = ({ state, now, theme }) => {
  if (
    !state ||
    (state.updatedAt === undefined && !state.building && !state.error)
  ) {
    return <span style={{ color: theme.colors.textSecondary }}>—</span>;
  }
  if (state.error) {
    return (
      <span
        title={state.error}
        style={{
          color: theme.colors.error,
          display: 'inline-flex',
          gap: '4px',
          alignItems: 'center',
        }}
      >
        <AlertTriangle size={11} /> failed
      </span>
    );
  }
  const detail =
    state.count !== undefined ? ` · ${state.count.toLocaleString()}` : '';
  return (
    <span
      title={state.sha ? `built at ${state.sha.slice(0, 7)}` : undefined}
      style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
    >
      {state.building && (
        <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
      )}
      {state.building ? 'rebuilding' : formatAge(state.updatedAt, now)}
      {detail}
    </span>
  );
};

/**
 * Every repository the shared daemon knows about (registered by any client)
 * with the freshness of each cache slice. Polled while the section is
 * mounted; the data is daemon-wide, so repos other apps registered show too.
 */
const DaemonRepoTable: React.FC<{ nowTick: number; theme: ThemeShape }> = ({
  nowTick,
  theme,
}) => {
  const [snapshot, setSnapshot] = useState<RepoMonitorDiagnostics | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await RepositoryMonitoringService.getDaemonDiagnostics();
        if (cancelled) return;
        setSnapshot(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleRebuild = async (repoPath: string) => {
    setRebuilding(repoPath);
    try {
      await RepositoryMonitoringService.refreshRepository(repoPath);
    } finally {
      setRebuilding(null);
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px 12px',
    whiteSpace: 'nowrap',
    fontSize: '12px',
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'left',
    fontWeight: 500,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: '11px',
  };

  const message = (text: string, color = theme.colors.textSecondary) => (
    <div style={{ padding: '12px 20px', fontSize: '12px', color }}>{text}</div>
  );

  if (error) return message(`Status request failed: ${error}`, theme.colors.error);
  if (!snapshot) return message('Checking the daemon…');
  if (snapshot.state === 'unreachable') {
    return message(
      `Daemon unreachable at ${snapshot.socketPath}${snapshot.error ? `: ${snapshot.error}` : ''}`,
      theme.colors.error,
    );
  }
  if (snapshot.state === 'starting') return message('Daemon is starting…');
  if (snapshot.repos.length === 0) {
    return message('No repositories registered with the daemon.');
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: theme.fonts.monospace,
        }}
      >
        <thead>
          <tr>
            <th style={headStyle}>Repository</th>
            {SLICE_META.map(({ slice, label }) => (
              <th key={slice} style={headStyle}>
                {label}
              </th>
            ))}
            <th style={headStyle} />
          </tr>
        </thead>
        <tbody>
          {snapshot.repos.map((repo) => {
            const name =
              repo.path.split('/').filter(Boolean).pop() ?? repo.path;
            const watchTitle = repo.isWatching
              ? `Watching (${repo.watchingMode}${repo.fsMonitorEnabled ? ', git fsmonitor' : ''}) — ${String(repo.watchReferenceCount)} reference${repo.watchReferenceCount === 1 ? '' : 's'}`
              : 'Not watching — slices refresh only on request';
            const isRebuilding = rebuilding === repo.path;
            return (
              <tr
                key={repo.path}
                style={{ borderTop: `1px solid ${theme.colors.border}` }}
              >
                <td style={cellStyle}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span
                      title={watchTitle}
                      style={{
                        display: 'inline-flex',
                        color: repo.isWatching
                          ? theme.colors.success
                          : theme.colors.textSecondary,
                      }}
                    >
                      {repo.isWatching ? <Eye size={13} /> : <EyeOff size={13} />}
                    </span>
                    <span title={repo.path} style={{ color: theme.colors.text }}>
                      {name}
                    </span>
                    {repo.isWatching && repo.watchingMode === 'fallback' && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        fallback
                      </span>
                    )}
                  </div>
                </td>
                {SLICE_META.map(({ slice }) => (
                  <td
                    key={slice}
                    style={{ ...cellStyle, color: theme.colors.textSecondary }}
                  >
                    <SliceCell
                      state={repo.slices[slice]}
                      now={nowTick}
                      theme={theme}
                    />
                  </td>
                ))}
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  <button
                    onClick={() => void handleRebuild(repo.path)}
                    disabled={rebuilding !== null}
                    title="Drop every cached slice for this repo and rebuild."
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      cursor: rebuilding !== null ? 'not-allowed' : 'pointer',
                      opacity: rebuilding !== null && !isRebuilding ? 0.5 : 1,
                    }}
                  >
                    {isRebuilding ? (
                      <Loader2
                        size={11}
                        style={{ animation: 'spin 1s linear infinite' }}
                      />
                    ) : (
                      <RefreshCw size={11} />
                    )}
                    Rebuild
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
export const RepositoryMonitoringDiagnostics: React.FC<{
  diagnostics: ServerDiagnostics | null;
  /** Wall-clock now, ticked by parent so phase elapsed updates each second. */
  nowTick: number;
}> = ({ diagnostics, nowTick }) => {
  const { theme } = useTheme();
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [reposExpanded, setReposExpanded] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [switchingImpl, setSwitchingImpl] = useState<
    'parcel' | 'chokidar' | null
  >(null);
  const [restartingDaemon, setRestartingDaemon] = useState(false);

  const handleRestartDaemon = async () => {
    setRestartingDaemon(true);
    try {
      await RepositoryMonitoringService.restartDaemon();
    } catch (error) {
      console.error('Failed to restart daemon:', error);
    } finally {
      setRestartingDaemon(false);
    }
  };

  const handleSwitchImpl = async (impl: 'parcel' | 'chokidar') => {
    setSwitchingImpl(impl);
    try {
      await RepositoryMonitoringService.setWatcherImpl(impl);
    } catch (error) {
      console.error('Failed to switch watcher impl:', error);
    } finally {
      // The lifecycle stream will reflect the restart; clear the local
      // spinner once the manager has had a beat to begin the restart.
      setTimeout(() => setSwitchingImpl(null), 500);
    }
  };

  return (
    <section style={{ marginBottom: '32px' }}>
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: theme.colors.textSecondary,
          marginBottom: '16px',
          fontFamily: theme.fonts.heading,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Bug size={14} />
        SERVER DIAGNOSTICS
      </h3>

      {!diagnostics ? (
        <div
          style={{
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            fontSize: '13px',
          }}
        >
          Loading diagnostics...
        </div>
      ) : (
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              padding: '16px 20px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            {[
              {
                label: 'Phase',
                value: phaseLabel(diagnostics.phase),
                color: phaseAccentColor(diagnostics.phase, theme),
              },
              {
                label: 'Daemon PID',
                value:
                  diagnostics.daemonPid !== null
                    ? String(diagnostics.daemonPid)
                    : '—',
              },
              {
                label: 'In Phase',
                value: formatRelativeDuration(
                  nowTick - diagnostics.phaseEnteredAt,
                ),
              },
              {
                label: 'Connected for',
                value:
                  diagnostics.connected && diagnostics.lastConnectedAt
                    ? formatRelativeDuration(
                        nowTick - diagnostics.lastConnectedAt,
                      )
                    : '—',
              },
              {
                label: 'Reconnects',
                value: String(diagnostics.reconnectAttempts),
                color:
                  diagnostics.reconnectAttempts > 0
                    ? theme.colors.warning
                    : undefined,
              },
              {
                label: 'Last disconnect',
                value: diagnostics.lastDisconnect
                  ? `${formatAge(diagnostics.lastDisconnect.at, nowTick)} · ${diagnostics.lastDisconnect.reason}`
                  : '—',
                color: diagnostics.lastDisconnect
                  ? theme.colors.warning
                  : undefined,
              },
            ].map((cell) => (
              <div key={cell.label}>
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px',
                  }}
                >
                  {cell.label}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: cell.color ?? theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                  }}
                >
                  {cell.value}
                </div>
              </div>
            ))}
          </div>

          {/* The shared daemon this app is connected to. One daemon serves
              every client on the machine (this app, Subsystems Studio, …). */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  marginBottom: '4px',
                }}
              >
                Shared daemon
              </div>
              {diagnostics.daemon ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: '12px',
                    rowGap: '2px',
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  <span>Spawned by</span>
                  <span style={{ color: theme.colors.text }}>
                    {OWNER_LABELS[diagnostics.daemon.owner]}
                    {diagnostics.daemon.owner === 'external' &&
                      ` (${diagnostics.daemon.spawnedBy})`}
                  </span>
                  <span>Version</span>
                  <span
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.monospace,
                    }}
                  >
                    {diagnostics.daemon.version} · protocol{' '}
                    {diagnostics.daemon.protocolVersion} · node{' '}
                    {diagnostics.daemon.nodeVersion ?? '—'}
                  </span>
                  <span>Socket</span>
                  <span
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.monospace,
                      wordBreak: 'break-all',
                    }}
                  >
                    {diagnostics.daemon.socketPath}
                  </span>
                  <span>Log</span>
                  <span
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.monospace,
                      wordBreak: 'break-all',
                    }}
                  >
                    {diagnostics.daemon.logPath}
                  </span>
                </div>
              ) : (
                <div
                  style={{ fontSize: '11px', color: theme.colors.textSecondary }}
                >
                  Not connected. Repositories cannot load until the daemon is
                  reachable; see the last error below and the daemon log.
                </div>
              )}
            </div>
            <button
              onClick={handleRestartDaemon}
              disabled={restartingDaemon}
              title="Stop the shared daemon and spawn a fresh one. Other apps using it reconnect automatically."
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.warning}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.warning,
                cursor: restartingDaemon ? 'not-allowed' : 'pointer',
                opacity: restartingDaemon ? 0.6 : 1,
              }}
            >
              {restartingDaemon ? (
                <Loader2
                  size={12}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
              ) : (
                <RotateCcw size={12} />
              )}
              Restart daemon
            </button>
          </div>

          {/* Watcher impl switcher. Lets users A/B test Parcel vs Chokidar
              without restarting the app — useful when isolating which
              implementation is responsible for crashes or silent failures. */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  marginBottom: '2px',
                }}
              >
                File watcher implementation
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                  marginBottom: '2px',
                }}
              >
                Switching restarts the shared daemon for every connected app.
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                }}
              >
                Active:{' '}
                <span
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                  }}
                >
                  {diagnostics.watcherImpl ?? '—'}
                </span>
                {diagnostics.watcherImpl &&
                  diagnostics.watcherImpl !==
                    diagnostics.requestedWatcherImpl && (
                    <span
                      style={{
                        color: theme.colors.warning,
                        marginLeft: '8px',
                      }}
                    >
                      (requested: {diagnostics.requestedWatcherImpl} —{' '}
                      {diagnostics.watcherImplFallbackReason
                        ? 'fell back automatically'
                        : 'restart pending'}
                      )
                    </span>
                  )}
              </div>
              {diagnostics.watcherImplFallbackReason && (
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.warning,
                    marginTop: '4px',
                    fontFamily: theme.fonts.monospace,
                    wordBreak: 'break-word',
                  }}
                  title={diagnostics.watcherImplFallbackReason}
                >
                  Fallback reason:{' '}
                  {diagnostics.watcherImplFallbackReason.length > 200
                    ? diagnostics.watcherImplFallbackReason.slice(0, 200) + '…'
                    : diagnostics.watcherImplFallbackReason}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['parcel', 'chokidar'] as const).map((impl) => {
                const isActive = diagnostics.requestedWatcherImpl === impl;
                const isLoading = switchingImpl === impl;
                return (
                  <button
                    key={impl}
                    onClick={() => handleSwitchImpl(impl)}
                    disabled={switchingImpl !== null}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      border: `1px solid ${
                        isActive ? theme.colors.primary : theme.colors.border
                      }`,
                      backgroundColor: isActive
                        ? `${theme.colors.primary}15`
                        : theme.colors.background,
                      color: isActive
                        ? theme.colors.primary
                        : theme.colors.text,
                      cursor:
                        switchingImpl !== null ? 'not-allowed' : 'pointer',
                      opacity: switchingImpl !== null && !isLoading ? 0.5 : 1,
                      textTransform: 'capitalize',
                    }}
                  >
                    {isLoading && (
                      <Loader2
                        size={12}
                        style={{ animation: 'spin 1s linear infinite' }}
                      />
                    )}
                    {impl}
                  </button>
                );
              })}
            </div>
          </div>

          {diagnostics.lastError && (
            <div
              style={{
                padding: '12px 20px',
                borderBottom: `1px solid ${theme.colors.border}`,
                backgroundColor: `${theme.colors.error}10`,
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle
                size={16}
                style={{
                  color: theme.colors.error,
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: theme.colors.error,
                    marginBottom: '4px',
                  }}
                >
                  Last error
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {diagnostics.lastError.message}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              padding: '12px 20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={async () => {
                try {
                  const logs = await RepositoryMonitoringService.getLogTail();
                  if (logs.mainLog.path) {
                    await ShellService.openPath(logs.mainLog.path);
                  }
                } catch (error) {
                  console.error('Failed to open main log:', error);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                cursor: 'pointer',
              }}
            >
              <ExternalLink size={12} />
              Open app log
            </button>
            <button
              onClick={async () => {
                try {
                  const logs = await RepositoryMonitoringService.getLogTail();
                  if (logs.daemonLog.path) {
                    await ShellService.openPath(logs.daemonLog.path);
                  }
                } catch (error) {
                  console.error('Failed to open daemon log:', error);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                cursor: 'pointer',
              }}
            >
              <ExternalLink size={12} />
              Open daemon log
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify(diagnostics, null, 2),
                  );
                  setCopyState('copied');
                  setTimeout(() => setCopyState('idle'), 1500);
                } catch (error) {
                  console.error('Failed to copy diagnostics:', error);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: `1px solid ${
                  copyState === 'copied'
                    ? theme.colors.success
                    : theme.colors.border
                }`,
                backgroundColor:
                  copyState === 'copied'
                    ? `${theme.colors.success}15`
                    : theme.colors.background,
                color:
                  copyState === 'copied'
                    ? theme.colors.success
                    : theme.colors.text,
                cursor: 'pointer',
              }}
            >
              {copyState === 'copied' ? (
                <CheckCircle size={12} />
              ) : (
                <ClipboardCopy size={12} />
              )}
              {copyState === 'copied' ? 'Copied' : 'Copy diagnostics JSON'}
            </button>
          </div>

          <Collapsible
            title={`Lifecycle history (${diagnostics.lifecycleHistory.length})`}
            expanded={historyExpanded}
            onToggle={() => setHistoryExpanded((v) => !v)}
            theme={theme}
          >
            {diagnostics.lifecycleHistory.length === 0 ? (
              <div
                style={{
                  padding: '12px 20px',
                  color: theme.colors.textSecondary,
                  fontSize: '12px',
                }}
              >
                No transitions recorded yet.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  fontFamily: theme.fonts.monospace,
                  fontSize: '12px',
                }}
              >
                {[...diagnostics.lifecycleHistory]
                  .slice(-20)
                  .reverse()
                  .map((evt) => (
                    <LifecycleRow
                      key={`${String(evt.ts)}-${evt.phase}`}
                      evt={evt}
                      theme={theme}
                    />
                  ))}
              </div>
            )}
          </Collapsible>

          <Collapsible
            title="Repositories in the daemon"
            expanded={reposExpanded}
            onToggle={() => setReposExpanded((v) => !v)}
            theme={theme}
          >
            <DaemonRepoTable nowTick={nowTick} theme={theme} />
          </Collapsible>
        </div>
      )}
    </section>
  );
};
