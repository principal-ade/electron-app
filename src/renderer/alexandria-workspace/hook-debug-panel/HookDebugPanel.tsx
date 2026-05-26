import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import {
  HOOK_DEBUG_CHANNEL,
  type HookDebugEvent,
} from '../../../shared/ipc-events/HookDebugEvents';

/**
 * Hook debug panel — subscribes to every hook POST received by the event
 * server (broadcast on HOOK_DEBUG_CHANNEL from HttpEventServer.processAgentEvent)
 * and renders a rolling list of the last MAX_EVENTS payloads. Used to confirm
 * that hooks are reaching the app at all, independent of pipeline outcome.
 */

const MAX_EVENTS = 200;

interface DisplayEvent extends HookDebugEvent {
  /** Locally-assigned id so React keys stay stable across renders. */
  localId: string;
}

const extractToolName = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return null;
  const tool = (raw as Record<string, unknown>).tool_name;
  return typeof tool === 'string' ? tool : null;
};

const extractSessionId = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return null;
  const sid = (raw as Record<string, unknown>).session_id;
  return typeof sid === 'string' ? sid : null;
};

const extractHookEventName = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return null;
  const name = (raw as Record<string, unknown>).hook_event_name;
  return typeof name === 'string' ? name : null;
};

const formatTime = (ms: number): string => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const millis = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${millis}`;
};

export const HookDebugPanel: React.FC = () => {
  const { theme } = useTheme();
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const counterRef = useRef(0);

  useEffect(() => {
    const off = window.electron.ipcRenderer.on(
      HOOK_DEBUG_CHANNEL,
      (...args: unknown[]) => {
        const event = args[0] as HookDebugEvent | undefined;
        if (!event) return;
        counterRef.current += 1;
        const localId = `${event.receivedAt}-${counterRef.current}`;
        setEvents((prev) => {
          const next = [{ ...event, localId }, ...prev];
          if (next.length > MAX_EVENTS) next.length = MAX_EVENTS;
          return next;
        });
      },
    );
    return off;
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setExpanded(new Set());
  }, []);

  const headerCount = useMemo(() => {
    const total = events.length;
    const cap = total === MAX_EVENTS ? ` (cap ${MAX_EVENTS})` : '';
    return `${total} ${total === 1 ? 'event' : 'events'}${cap}`;
  }, [events.length]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.medium,
            color: theme.colors.textSecondary,
          }}
        >
          {headerCount}
        </div>
        <button
          onClick={clear}
          disabled={events.length === 0}
          title="Clear"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            background: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            cursor: events.length === 0 ? 'not-allowed' : 'pointer',
            opacity: events.length === 0 ? 0.5 : 1,
            fontSize: `${theme.fontSizes[0]}px`,
            fontFamily: theme.fonts.body,
          }}
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {events.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Waiting for hook events. Run a briefed agent (or any agent with
            hooks installed) and its PreToolUse / PostToolUse / etc. payloads
            will appear here as they arrive.
          </div>
        ) : (
          events.map((evt) => {
            const isOpen = expanded.has(evt.localId);
            const tool = extractToolName(evt.raw);
            const sid = extractSessionId(evt.raw);
            const hookEvent = extractHookEventName(evt.raw);
            return (
              <div
                key={evt.localId}
                style={{
                  borderBottom: `1px solid ${theme.colors.border}`,
                  fontSize: `${theme.fontSizes[0]}px`,
                }}
              >
                <button
                  onClick={() => toggle(evt.localId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: theme.fonts.body,
                    fontSize: `${theme.fontSizes[0]}px`,
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                  <code
                    style={{
                      fontFamily: theme.fonts.monospace,
                      color: theme.colors.textSecondary,
                      minWidth: '90px',
                    }}
                  >
                    {formatTime(evt.receivedAt)}
                  </code>
                  <span
                    style={{
                      color: theme.colors.primary,
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    {evt.provider}
                  </span>
                  {hookEvent && (
                    <span style={{ color: theme.colors.textSecondary }}>
                      {hookEvent}
                    </span>
                  )}
                  {tool && (
                    <span style={{ color: theme.colors.text }}>{tool}</span>
                  )}
                  {sid && (
                    <code
                      style={{
                        fontFamily: theme.fonts.monospace,
                        color: theme.colors.textSecondary,
                        marginLeft: 'auto',
                      }}
                    >
                      {sid.slice(0, 8)}
                    </code>
                  )}
                </button>
                {isOpen && (
                  <pre
                    style={{
                      margin: 0,
                      padding: '8px 16px 12px 34px',
                      fontFamily: theme.fonts.monospace,
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: theme.colors.textSecondary,
                      backgroundColor: theme.colors.backgroundTertiary,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(evt.raw, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
