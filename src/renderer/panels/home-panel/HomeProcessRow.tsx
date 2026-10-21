import React, { useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Cpu, Pin, Play, Power, Square } from 'lucide-react';
import type {
  ProcessControlResult,
  ProcessEntry,
} from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import { ProcessRegistryService } from '../../main-process-api/ProcessRegistryService';
import { LocalhostDetectionService } from '../../main-process-api/LocalhostDetectionService';
import { ConfirmDialog } from '../../repo-explorer/components/ConfirmDialog';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';
import type { HomeProcessTab } from './homeTabEntries';

/** Process pins are saved launch configurations, not workspace-tab pins. */
export const HomeProcessRow: React.FC<{
  entry: ProcessEntry;
  depth?: number;
  openTab?: HomeProcessTab;
  onActivateTab?: (id: string) => void;
  onProcessKilled?: () => void | Promise<void>;
}> = ({ entry, depth = 0, openTab, onActivateTab, onProcessKilled }) => {
  const { theme } = useTheme();
  const { openLocalhostBrowser } = useWorkspaceTabs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [killTarget, setKillTarget] = useState<ProcessEntry | null>(null);
  const acting = useRef(false);
  const managed = entry.origin === 'managed';
  const stopped = entry.status === 'stopped' || entry.status === 'failed';
  const transitioning = ['starting', 'restarting', 'stopping'].includes(
    entry.status,
  );
  const canFocus = openTab != null && onActivateTab != null;
  const canKill =
    managed || (Number.isSafeInteger(entry.pid) && (entry.pid ?? 0) > 0);
  const canOpen = canFocus || (!stopped && entry.port != null);
  const openBrowser = () => {
    if (openTab && onActivateTab) {
      onActivateTab(openTab.id);
      return;
    }
    if (!canOpen || entry.port == null) return;
    openLocalhostBrowser(
      entry.port,
      '/',
      entry.label,
      managed ? entry.id : undefined,
    );
  };

  const act = async (action: () => Promise<ProcessControlResult>) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!result.success) setError(result.error ?? 'Process action failed.');
    } catch {
      setError('Process action failed. Please try again.');
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };

  const killProcess = () => {
    if (!killTarget) return;
    const target = killTarget;
    void act(async () => {
      let result: ProcessControlResult;
      if (target.origin === 'managed') {
        const current = (await ProcessRegistryService.list()).find(
          (process) => process.id === target.id,
        );
        if (
          !current ||
          ['stopped', 'failed'].includes(current.status) ||
          (target.pid != null && current.pid !== target.pid)
        ) {
          return {
            success: false,
            error: 'This process has changed or stopped. Cancel and try again.',
          };
        }
        result = await ProcessRegistryService.stop(target.id);
      } else {
        // Do not signal a PID from an old scan after its port changes owners.
        const pid = target.pid;
        if (
          pid == null ||
          !Number.isSafeInteger(pid) ||
          pid <= 0 ||
          target.port == null
        ) {
          return {
            success: false,
            error: 'The process ID or port is unavailable.',
          };
        }
        const { servers } =
          await LocalhostDetectionService.detectRunningServers({
            ports: [target.port],
          });
        if (
          !servers.some(
            (server) =>
              server.port === target.port && server.pid === target.pid,
          )
        ) {
          return {
            success: false,
            error:
              'This process is no longer listening on that port. Cancel and try again.',
          };
        }
        result = await LocalhostDetectionService.killServer(pid);
      }
      if (result.success) {
        setKillTarget(null);
        // Termination succeeded even if a best-effort list refresh fails.
        void Promise.resolve(onProcessKilled?.()).catch(() => {});
      }
      return result;
    });
  };

  const buttonStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: theme.colors.textSecondary,
    display: 'inline-flex',
    alignItems: 'center',
    padding: 4,
    cursor: busy ? 'wait' : 'pointer',
  };

  return (
    <div>
      <div
        role={canOpen ? 'button' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        aria-label={canOpen ? `Open ${entry.label} in browser` : undefined}
        title={
          canFocus
            ? `Focus Tab ${openTab.number}`
            : canOpen
              ? `Open localhost:${entry.port}`
              : undefined
        }
        onClick={openBrowser}
        onKeyDown={(event) => {
          if (!canOpen || event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openBrowser();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: `5px 10px 5px ${14 + depth * 18}px`,
          borderRadius: 6,
          cursor: canOpen ? 'pointer' : undefined,
          background:
            canOpen && hovered ? theme.colors.backgroundSecondary : undefined,
        }}
      >
        <Cpu
          size={13}
          color={
            entry.status === 'failed'
              ? theme.colors.error
              : stopped
                ? theme.colors.textSecondary
                : theme.colors.success
          }
        />
        <span
          title={`${entry.command}\n${entry.cwd}\n${entry.status}`}
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: theme.colors.text,
            fontSize: theme.fontSizes[1],
          }}
        >
          {entry.label}
        </span>
        {openTab && (
          <span
            style={{
              flexShrink: 0,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            Tab {openTab.number}
          </span>
        )}
        {managed && (
          <span
            title={entry.status}
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {entry.status}
          </span>
        )}
        {managed && (
          <>
            <button
              type="button"
              style={buttonStyle}
              disabled={busy || transitioning}
              title={stopped ? 'Run saved command' : 'Stop process'}
              aria-label={`${stopped ? 'Run' : 'Stop'} ${entry.label}`}
              onClick={(event) => {
                event.stopPropagation();
                void act(() =>
                  stopped
                    ? ProcessRegistryService.restart(entry.id)
                    : ProcessRegistryService.stop(entry.id),
                );
              }}
            >
              {stopped ? <Play size={13} /> : <Square size={13} />}
            </button>
            <button
              type="button"
              style={{
                ...buttonStyle,
                color: entry.pinned
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              }}
              disabled={busy}
              title={
                entry.pinned
                  ? 'Unpin from Home'
                  : 'Pin launch configuration to Home'
              }
              aria-label={`${entry.pinned ? 'Unpin' : 'Pin'} ${entry.label}`}
              onClick={(event) => {
                event.stopPropagation();
                void act(() =>
                  ProcessRegistryService.setPinned(entry.id, !entry.pinned),
                );
              }}
            >
              <Pin size={13} fill={entry.pinned ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
        {!stopped && (
          <button
            type="button"
            style={{ ...buttonStyle, color: theme.colors.error }}
            disabled={busy || transitioning || !canKill}
            title={canKill ? 'Kill process' : 'Process ID unavailable'}
            aria-label={`Kill ${entry.label}`}
            onClick={(event) => {
              event.stopPropagation();
              setError(null);
              setKillTarget({ ...entry });
            }}
          >
            <Power size={13} />
          </button>
        )}
      </div>
      {killTarget && (
        <ConfirmDialog
          title="Kill process"
          message={
            <>
              Terminate <strong>{killTarget.label}</strong>
              {killTarget.pid != null ? ` (PID ${killTarget.pid})` : ''}
              {killTarget.port != null ? ` on port ${killTarget.port}` : ''}?
              <p>Any unsaved work in this process may be lost.</p>
              {killTarget.origin === 'detected' && (
                <p>
                  This process was started outside Principal and cannot be
                  restarted here.
                </p>
              )}
              {error && (
                <p role="alert" style={{ color: theme.colors.error }}>
                  {error}
                </p>
              )}
            </>
          }
          confirmLabel="Kill process"
          destructive
          busy={busy}
          onConfirm={killProcess}
          onCancel={() => {
            if (!acting.current) {
              setKillTarget(null);
              setError(null);
            }
          }}
        />
      )}
      {error && !killTarget && (
        <div
          role="alert"
          style={{ color: theme.colors.error, fontSize: theme.fontSizes[0] }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
