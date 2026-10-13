/**
 * ProcessesLeftPanel
 *
 * Left panel for the process/bridge surface. Lists "process entries" — commands
 * that were run as managed, long-lived processes (dev servers, watchers, tasks)
 * plus the history of commands that were opened. Clicking a row emits a
 * `process:open` intent on the panel event bus; a host turns it into a tab that
 * shows the process info (port, pid, cwd, live logs) WITHOUT killing it. Closing
 * that tab must not kill the process — only an explicit Stop/Kill does.
 *
 * This is a Storybook-first prototype: it is fully prop-driven (no electron /
 * telemetry imports) so it renders in the browser and the story can drive every
 * state. The eventual production wiring reads `entries` from a main-process
 * process registry (and subscribes to registry changes); the intent emissions
 * below are the contract that host implements.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  RefreshCw,
  Search,
  X,
  ChevronDown,
  Check,
  ListFilter,
  Plus,
  Play,
  Square,
  RotateCw,
  Power,
  Trash2,
  Copy,
  ExternalLink,
  Folder,
  Clock,
  Activity,
  Terminal,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useDelayedLoading } from '../hooks/useDelayedLoading';

// ---------------------------------------------------------------------------
// Entry model
//
// The whole point of this panel is to pin down the shape. `id` is a stable,
// durable, main-process-generated identifier (NOT the OS pid). `pid` is
// diagnostic only, may be absent (daemon/worker modes), and changes on restart.
// ---------------------------------------------------------------------------

export type ProcessStatus =
  | 'starting'
  | 'running'
  | 'restarting'
  | 'stopping'
  | 'stopped'
  | 'failed';

/** Coarse classification of what kind of process this is. */
export type ProcessKind = 'dev-server' | 'watcher' | 'task' | 'agent' | 'script';

export interface ProcessEntry {
  /** Stable, durable id minted by the main-process registry. Never the pid. */
  id: string;
  /** Human-readable label shown as the row title. */
  label: string;
  /** Full command line as run (for the row subtitle + copy). */
  command: string;
  /** Working directory the process was launched in. */
  cwd: string;
  kind: ProcessKind;
  status: ProcessStatus;
  /** OS pid — diagnostic only; may be undefined and changes across restarts. */
  pid?: number;
  /** Active port, when the process exposes one (dev servers). */
  port?: number;
  /** What opened this process (topic id, agent session, manual run). */
  source?: string;
  /** When the current run started. */
  startedAt: number;
  /** When the (most recent) run ended, if it has. */
  endedAt?: number;
  /** Exit code of the last finished run. */
  exitCode?: number;
  /** Last error captured, for failed/stopped processes. */
  lastError?: string;
  /** How many times this command has been launched (history signal). */
  runCount?: number;
  /** Whether a tab is currently open for this process. */
  hasOpenTab?: boolean;
  /** Whether this process was launched from the command history. */
  fromHistory?: boolean;
}

// ---------------------------------------------------------------------------
// Intents — the contract a host implements. Clicking a row never opens a tab
// directly; it emits an intent on the bus (mirrors the portal-intent pattern).
// ---------------------------------------------------------------------------

export const PROCESS_INTENTS = {
  /** Open (or focus) a tab showing this process — does NOT kill it. */
  open: 'process:open',
  /** Open the "run a command" affordance (new process from a command). */
  run: 'process:run',
  /** Restart a stopped/failed process, or re-run from history. */
  restart: 'process:restart',
  /** Gracefully stop a running process. */
  stop: 'process:stop',
  /** Force-kill a running process. */
  kill: 'process:kill',
  /** Remove a stopped/failed entry from the history list. */
  remove: 'process:remove',
  /** Copy the full command line. */
  copyCommand: 'process:copy-command',
  /** Reveal the raw logs (without opening the info tab). */
  revealLogs: 'process:reveal-logs',
} as const;

export type ProcessIntentName =
  (typeof PROCESS_INTENTS)[keyof typeof PROCESS_INTENTS];

/** Payload carried by every process intent. */
export interface ProcessIntentPayload {
  entry: ProcessEntry;
}

function emitProcessIntent(
  events: PanelEventEmitter,
  type: ProcessIntentName,
  entry: ProcessEntry,
): void {
  events.emit<ProcessIntentPayload>({
    type,
    source: 'processes-left-panel',
    timestamp: Date.now(),
    payload: { entry },
  });
}

// ---------------------------------------------------------------------------
// Status presentation
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: ProcessStatus[] = [
  'starting',
  'running',
  'restarting',
  'stopping',
];
const HISTORY_STATUSES: ProcessStatus[] = ['stopped', 'failed'];

const ALL_STATUSES: ProcessStatus[] = [
  'running',
  'starting',
  'restarting',
  'stopping',
  'stopped',
  'failed',
];

interface StatusMeta {
  label: string;
  color: string;
  pulse: boolean;
}

function statusMeta(
  status: ProcessStatus,
  theme: ReturnType<typeof useTheme>['theme'],
): StatusMeta {
  switch (status) {
    case 'running':
      return { label: 'Running', color: theme.colors.success, pulse: true };
    case 'starting':
      return { label: 'Starting', color: theme.colors.primary, pulse: true };
    case 'restarting':
      return { label: 'Restarting', color: theme.colors.primary, pulse: true };
    case 'stopping':
      return { label: 'Stopping', color: theme.colors.warning, pulse: false };
    case 'failed':
      return { label: 'Failed', color: theme.colors.error, pulse: false };
    case 'stopped':
    default:
      return { label: 'Stopped', color: theme.colors.textTertiary, pulse: false };
  }
}

/** Compact "x ago" relative time. */
function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Elapsed run duration for a still-running process (or the last run's span). */
function formatRunDuration(entry: ProcessEntry): string | null {
  if (entry.startedAt == null) return null;
  const end = entry.endedAt ?? Date.now();
  const seconds = Math.max(0, Math.floor((end - entry.startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProcessesLeftPanelProps {
  /** Active + historical process entries. */
  entries: ProcessEntry[];
  events: PanelEventEmitter;
  loading?: boolean;
  error?: string | null;
  /** Id of the entry whose tab is currently active (row highlight). */
  activeEntryId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProcessesLeftPanel: React.FC<ProcessesLeftPanelProps> = ({
  entries,
  events,
  loading = false,
  error = null,
  activeEntryId = null,
}) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<ProcessStatus>>(
    () => new Set(),
  );
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const showLoading = useDelayedLoading(loading);

  // Close the status menu on an outside click.
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [statusMenuOpen]);

  const toggleStatus = useCallback((status: ProcessStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter.size > 0 && !statusFilter.has(entry.status)) return false;
      if (!q) return true;
      return (
        entry.label.toLowerCase().includes(q) ||
        entry.command.toLowerCase().includes(q) ||
        entry.cwd.toLowerCase().includes(q)
      );
    });
  }, [entries, query, statusFilter]);

  const running = useMemo(
    () =>
      visible
        .filter((e) => ACTIVE_STATUSES.includes(e.status))
        .sort((a, b) => b.startedAt - a.startedAt),
    [visible],
  );
  const history = useMemo(
    () =>
      visible
        .filter((e) => HISTORY_STATUSES.includes(e.status))
        .sort(
          (a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt),
        ),
    [visible],
  );

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  const statusTriggerLabel =
    statusFilter.size === 0
      ? 'All statuses'
      : statusFilter.size === 1
        ? (statusMeta([...statusFilter][0], theme).label)
        : `${statusFilter.size} statuses`;

  const emptyState = (text: string) => (
    <div
      style={{
        padding: `${spacing.sm * 3}px ${spacing.sm * 2}px`,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );

  const renderBadge = (
    text: string,
    color: string,
    opts: { mono?: boolean; title?: string } = {},
  ) => (
    <span
      title={opts.title}
      style={{
        fontSize: theme.fontSizes[0],
        fontFamily: opts.mono ? theme.fonts.monospace : theme.fonts.body,
        color,
        backgroundColor: `${color}15`,
        padding: '2px 6px',
        borderRadius: theme.radii[0],
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );

  const renderRow = (entry: ProcessEntry) => {
    const meta = statusMeta(entry.status, theme);
    const hovered = hoveredId === entry.id;
    const active = activeEntryId === entry.id;
    const isActive = ACTIVE_STATUSES.includes(entry.status);
    const duration = formatRunDuration(entry);

    const action = (name: ProcessIntentName) => (e: React.MouseEvent) => {
      e.stopPropagation();
      emitProcessIntent(events, name, entry);
    };

    const iconBtn = (
      title: string,
      Icon: React.ComponentType<{ size?: number; color?: string }>,
      onClick: (e: React.MouseEvent) => void,
      color?: string,
    ) => (
      <button
        title={title}
        aria-label={title}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 5,
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii[1],
          color: color ?? theme.colors.textSecondary,
          cursor: 'pointer',
        }}
      >
        <Icon size={13} color={color ?? theme.colors.textSecondary} />
      </button>
    );

    return (
      <div
        key={entry.id}
        role="button"
        tabIndex={0}
        onClick={() => emitProcessIntent(events, PROCESS_INTENTS.open, entry)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            emitProcessIntent(events, PROCESS_INTENTS.open, entry);
          }
        }}
        onMouseEnter={() => setHoveredId(entry.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing.sm,
          width: '100%',
          boxSizing: 'border-box',
          padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
          backgroundColor:
            active || hovered
              ? theme.colors.backgroundSecondary
              : 'transparent',
          borderBottom: `1px solid ${theme.colors.border}`,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s ease',
          opacity: isActive ? 1 : 0.85,
        }}
      >
        {/* Status dot — the process "aliveness" axis color. */}
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            marginTop: 5,
            backgroundColor: meta.color,
            animation: meta.pulse ? 'pulse 2s infinite' : 'none',
          }}
          title={meta.label}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title line: label + open-tab indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: active ? 700 : 500,
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.label}
            </span>
            {entry.hasOpenTab && (
              <span
                title="A tab is open for this process"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: theme.colors.primary,
                  flexShrink: 0,
                }}
              >
                <ExternalLink size={12} />
              </span>
            )}
          </div>

          {/* Command line */}
          <div
            title={entry.command}
            style={{
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 4,
            }}
          >
            {entry.command}
          </div>

          {/* Meta line: status + kind + port + pid + cwd + time */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              flexWrap: 'wrap',
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textTertiary,
            }}
          >
            {entry.status !== 'running' &&
              renderBadge(meta.label, meta.color)}
            {renderBadge(entry.kind, theme.colors.textSecondary)}
            {entry.port != null &&
              renderBadge(`:${entry.port}`, theme.colors.primary, {
                mono: true,
              })}
            {entry.pid != null &&
              renderBadge(`pid ${entry.pid}`, theme.colors.textTertiary)}
            {isActive && duration && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Activity size={11} />
                {duration}
              </span>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 180,
              }}
              title={entry.cwd}
            >
              <Folder size={11} />
              {entry.cwd}
            </span>
            {entry.runCount != null && entry.runCount > 1 && (
              <span title={`Ran ${entry.runCount} times`}>
                ×{entry.runCount}
              </span>
            )}
            {!isActive && (
              <span
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Clock size={11} />
                {timeAgo(entry.endedAt ?? entry.startedAt)}
              </span>
            )}
          </div>

          {/* Error / exit info */}
          {entry.status === 'failed' && entry.lastError && (
            <div
              title={entry.lastError}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[0],
                color: theme.colors.error,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <AlertCircle size={11} />
              {entry.lastError}
            </div>
          )}
        </div>

        {/* Hover actions */}
        {hovered && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexShrink: 0,
              marginLeft: spacing.sm,
              alignItems: 'center',
            }}
          >
            {isActive && (
              <>
                {iconBtn(
                  'Reveal logs',
                  Terminal,
                  action(PROCESS_INTENTS.revealLogs),
                )}
                {iconBtn(
                  'Restart',
                  RotateCw,
                  action(PROCESS_INTENTS.restart),
                )}
                {iconBtn(
                  'Stop',
                  Square,
                  action(PROCESS_INTENTS.stop),
                  theme.colors.warning,
                )}
                {iconBtn(
                  'Force kill',
                  Power,
                  action(PROCESS_INTENTS.kill),
                  theme.colors.error,
                )}
              </>
            )}
            {!isActive && (
              <>
                {iconBtn(
                  'Copy command',
                  Copy,
                  action(PROCESS_INTENTS.copyCommand),
                )}
                {iconBtn(
                  'Run again',
                  Play,
                  action(PROCESS_INTENTS.restart),
                  theme.colors.success,
                )}
                {iconBtn(
                  'Remove from history',
                  Trash2,
                  action(PROCESS_INTENTS.remove),
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, list: ProcessEntry[]) => {
    if (list.length === 0) return null;
    return (
      <div>
        <div
          style={{
            padding: `${spacing.sm}px ${spacing.sm * 2}px ${spacing.xs}px`,
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
            fontFamily: theme.fonts.heading,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.colors.textSecondary,
          }}
        >
          {title}
          <span style={{ marginLeft: 6, color: theme.colors.textTertiary }}>
            {list.length}
          </span>
        </div>
        {list.map(renderRow)}
      </div>
    );
  };

  const renderList = () => {
    if (loading && entries.length === 0) {
      return showLoading ? emptyState('Loading…') : null;
    }
    if (error) return emptyState(error);
    if (entries.length === 0) {
      return emptyState('No processes yet. Run a command to start one.');
    }
    if (visible.length === 0) {
      return emptyState('No processes match the current filters.');
    }
    return (
      <>
        {renderSection('Running', running)}
        {renderSection('History', history)}
      </>
    );
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header: title + count + run + refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          flexShrink: 0,
        }}
      >
        <Activity
          size={16}
          color={theme.colors.text}
          style={{ marginLeft: 4 }}
        />
        <span
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Processes
        </span>
        {loading && (
          <Loader2
            size={14}
            color={theme.colors.textTertiary}
            style={{ animation: 'spin 1s linear infinite' }}
          />
        )}
        <button
          onClick={() =>
            events.emit({
              type: PROCESS_INTENTS.run,
              source: 'processes-left-panel',
              timestamp: Date.now(),
              payload: {},
            })
          }
          title="Run a command"
          aria-label="Run a command"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() =>
            events.emit({
              type: 'process:refresh',
              source: 'processes-left-panel',
              timestamp: Date.now(),
              payload: {},
            })
          }
          title="Refresh"
          aria-label="Refresh"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filters: text search (left) + status (right) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `0 ${spacing.sm}px ${spacing.sm}px`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 30,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `0 ${spacing.sm}px`,
            borderRadius: 6,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <Search size={14} color={theme.colors.textSecondary} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter processes"
            aria-label="Filter processes"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              title="Clear filter"
              aria-label="Clear filter"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div
          ref={statusMenuRef}
          style={{ position: 'relative', flexShrink: 0 }}
        >
          <button
            onClick={() => setStatusMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={statusMenuOpen}
            title={
              statusFilter.size === 0
                ? 'Filter by status'
                : `Status: ${statusTriggerLabel}`
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 30,
              boxSizing: 'border-box',
              gap: spacing.xs,
              padding: `0 ${spacing.sm}px`,
              borderRadius: 6,
              border: `1px solid ${
                statusFilter.size > 0
                  ? theme.colors.primary
                  : theme.colors.border
              }`,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              cursor: 'pointer',
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
            }}
          >
            <ListFilter
              size={14}
              color={
                statusFilter.size > 0
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
            {statusFilter.size > 0 && (
              <>
                <span
                  style={{
                    maxWidth: 96,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusTriggerLabel}
                </span>
                <span
                  role="button"
                  aria-label="Clear status filter"
                  title="Clear status filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusFilter(new Set());
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: theme.colors.textSecondary,
                  }}
                >
                  <X size={14} />
                </span>
              </>
            )}
            <ChevronDown
              size={14}
              style={{
                flexShrink: 0,
                color: theme.colors.textSecondary,
                transition: 'transform 200ms ease',
                transform: statusMenuOpen ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>

          {statusMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 2,
                zIndex: 30,
                minWidth: 190,
                padding: 4,
                borderRadius: 8,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.background,
                boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
              }}
            >
              {ALL_STATUSES.map((s) => {
                const selected = statusFilter.has(s);
                const meta = statusMeta(s, theme);
                return (
                  <button
                    key={s}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={selected}
                    onClick={() => toggleStatus(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor: meta.color,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{meta.label}</span>
                    {selected && <Check size={14} color={theme.colors.primary} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto' }}>{renderList()}</div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProcessesLeftPanel;
