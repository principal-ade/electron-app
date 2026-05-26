import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type {
  ServerDiagnostics,
  LifecycleEvent,
  LifecyclePhase,
} from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { ShellService } from '../../../main-process-api/ShellService';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

const PHASE_LABELS: Record<LifecyclePhase, string> = {
  idle: 'Idle',
  spawning: 'Spawning',
  ready: 'Ready',
  running: 'Running',
  stopping: 'Stopping',
  stopped: 'Stopped',
  crashed: 'Crashed',
  restarting: 'Restarting',
  fatal: 'Fatal',
};

export function phaseLabel(phase: LifecyclePhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function phaseAccentColor(
  phase: LifecyclePhase,
  theme: ThemeShape,
): string {
  switch (phase) {
    case 'running':
    case 'ready':
      return theme.colors.success;
    case 'spawning':
    case 'restarting':
      return theme.colors.info ?? theme.colors.primary;
    case 'stopping':
      return theme.colors.warning;
    case 'crashed':
    case 'fatal':
      return theme.colors.error;
    case 'stopped':
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
  if (diag.workerPid) parts.push(`pid ${String(diag.workerPid)}`);
  if (diag.lastExit) {
    const code =
      diag.lastExit.code === null ? 'null' : String(diag.lastExit.code);
    parts.push(
      `last exit: code ${code}${diag.lastExit.signal ? ` (${diag.lastExit.signal})` : ''}`,
    );
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
    details.push(
      `attempt ${String(evt.attempt)}${
        evt.maxAttempts ? `/${String(evt.maxAttempts)}` : ''
      }`,
    );
  }
  if (evt.workerPid) details.push(`pid ${String(evt.workerPid)}`);
  if (evt.exitCode !== undefined && evt.exitCode !== null) {
    details.push(`code ${String(evt.exitCode)}`);
  }
  if (evt.exitSignal) details.push(`signal ${evt.exitSignal}`);
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

const LogStream: React.FC<{
  lines: { ts: number; stream: 'stdout' | 'stderr'; line: string }[];
  empty: string;
  theme: ThemeShape;
}> = ({ lines, empty, theme }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);
  if (lines.length === 0) {
    return (
      <div
        style={{
          padding: '12px 20px',
          color: theme.colors.textSecondary,
          fontSize: '12px',
        }}
      >
        {empty}
      </div>
    );
  }
  return (
    <div
      ref={scrollRef}
      style={{
        maxHeight: '280px',
        overflowY: 'auto',
        backgroundColor: theme.colors.background,
        fontFamily: theme.fonts.monospace,
        fontSize: '12px',
        padding: '8px 0',
      }}
    >
      {lines.map((entry) => (
        <div
          key={`${String(entry.ts)}-${entry.line.slice(0, 32)}`}
          style={{
            display: 'flex',
            gap: '12px',
            padding: '2px 20px',
            color:
              entry.stream === 'stderr'
                ? theme.colors.warning
                : theme.colors.text,
          }}
        >
          <span
            style={{
              color: theme.colors.textSecondary,
              flexShrink: 0,
              minWidth: '92px',
            }}
          >
            {formatClockTime(entry.ts)}
          </span>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {entry.line}
          </span>
        </div>
      ))}
    </div>
  );
};

export const RepositoryMonitoringDiagnostics: React.FC<{
  diagnostics: ServerDiagnostics | null;
  /** Wall-clock now, ticked by parent so phase elapsed updates each second. */
  nowTick: number;
}> = ({ diagnostics, nowTick }) => {
  const { theme } = useTheme();
  const [stderrExpanded, setStderrExpanded] = useState(true);
  const [stdoutExpanded, setStdoutExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [switchingImpl, setSwitchingImpl] = useState<
    'parcel' | 'chokidar' | null
  >(null);

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
                label: 'PID',
                value:
                  diagnostics.workerPid !== null
                    ? String(diagnostics.workerPid)
                    : '—',
              },
              {
                label: 'In Phase',
                value: formatRelativeDuration(
                  nowTick - diagnostics.phaseEnteredAt,
                ),
              },
              {
                label: 'Uptime',
                value: diagnostics.lastReadyAt
                  ? formatRelativeDuration(nowTick - diagnostics.lastReadyAt)
                  : '—',
              },
              {
                label: 'Restarts',
                value: `${diagnostics.restartAttempts}/${diagnostics.maxRestartAttempts}`,
                color:
                  diagnostics.restartAttempts > 0
                    ? theme.colors.warning
                    : undefined,
              },
              {
                label: 'Last Exit',
                value: diagnostics.lastExit
                  ? `code ${diagnostics.lastExit.code ?? 'null'}${
                      diagnostics.lastExit.signal
                        ? ` (${diagnostics.lastExit.signal})`
                        : ''
                    }`
                  : '—',
                color: diagnostics.lastExit ? theme.colors.error : undefined,
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
              Open Main Log
            </button>
            <button
              onClick={async () => {
                try {
                  const logs = await RepositoryMonitoringService.getLogTail();
                  if (logs.workerLog.path) {
                    await ShellService.openPath(logs.workerLog.path);
                  }
                } catch (error) {
                  console.error('Failed to open worker log:', error);
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
              Open Worker Log
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
              {copyState === 'copied' ? 'Copied' : 'Copy Diagnostics JSON'}
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
            title={`Worker stderr (${diagnostics.stderrTail.length})`}
            expanded={stderrExpanded}
            onToggle={() => setStderrExpanded((v) => !v)}
            theme={theme}
            accent={
              diagnostics.stderrTail.length > 0
                ? theme.colors.warning
                : undefined
            }
          >
            <LogStream
              lines={diagnostics.stderrTail}
              empty="No stderr captured."
              theme={theme}
            />
          </Collapsible>

          <Collapsible
            title={`Worker stdout (${diagnostics.stdoutTail.length})`}
            expanded={stdoutExpanded}
            onToggle={() => setStdoutExpanded((v) => !v)}
            theme={theme}
          >
            <LogStream
              lines={diagnostics.stdoutTail}
              empty="No stdout captured."
              theme={theme}
            />
          </Collapsible>
        </div>
      )}
    </section>
  );
};
