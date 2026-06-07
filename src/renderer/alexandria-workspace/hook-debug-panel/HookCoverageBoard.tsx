import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { HookDebugEvent } from '../../../shared/ipc-events/HookDebugEvents';
import {
  HOOK_EVENT_CATALOG,
  HOOK_FAMILIES,
  TOTAL_HOOK_EVENTS,
  type HookEventSpec,
} from './hookEventCatalog';

/**
 * HookCoverageBoard — a high-level "are the events actually firing?" board for
 * the Claude Hooks Audit. Renders all 30 documented hook events grouped by
 * family. Each tile lights up the first time its event is observed, shows a
 * running count + relative last-seen time, and briefly glows when it fires.
 *
 * Greyed tiles are documented-but-never-seen. This makes the 10 → 30 audit win
 * watchable: run a briefed agent and the board fills in live.
 *
 * Presentational: it derives all coverage from the `events` array it's handed,
 * so a Storybook story can feed a scripted stream and the real panel can pass
 * the rolling list it collects off HOOK_DEBUG_CHANNEL.
 */

const RECENT_GLOW_MS = 1500;

interface CoverageEntry {
  spec: HookEventSpec;
  count: number;
  /** ms-since-epoch of the most recent matching event, or null. */
  lastSeen: number | null;
}

const extractHookEventName = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return null;
  const name = (raw as Record<string, unknown>).hook_event_name;
  return typeof name === 'string' ? name : null;
};

const formatAgo = (lastSeen: number | null, now: number): string => {
  if (lastSeen == null) return '';
  const delta = Math.max(0, now - lastSeen);
  if (delta < 1000) return 'now';
  const secs = Math.floor(delta / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

export interface HookCoverageBoardProps {
  /** Raw hook events received so far (newest-first or oldest-first; order-agnostic). */
  events: HookDebugEvent[];
}

export const HookCoverageBoard: React.FC<HookCoverageBoardProps> = ({
  events,
}) => {
  const { theme } = useTheme();

  // Re-render on a slow tick so relative times and the recent-glow decay stay
  // fresh even when no new events arrive.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const coverage = useMemo(() => {
    const byName = new Map<string, CoverageEntry>();
    for (const spec of HOOK_EVENT_CATALOG) {
      byName.set(spec.name, { spec, count: 0, lastSeen: null });
    }
    for (const evt of events) {
      const name = extractHookEventName(evt.raw);
      if (!name) continue;
      const entry = byName.get(name);
      if (!entry) continue;
      entry.count += 1;
      entry.lastSeen =
        entry.lastSeen == null
          ? evt.receivedAt
          : Math.max(entry.lastSeen, evt.receivedAt);
    }
    return byName;
  }, [events]);

  const seenCount = useMemo(() => {
    let n = 0;
    for (const entry of coverage.values()) if (entry.count > 0) n += 1;
    return n;
  }, [coverage]);

  const pct = Math.round((seenCount / TOTAL_HOOK_EVENTS) * 100);

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
      {/* Header + progress */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.medium,
            }}
          >
            Claude Hooks Coverage
          </div>
          <div
            style={{
              fontFamily: theme.fonts.monospace,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
            }}
          >
            <span style={{ color: theme.colors.primary }}>{seenCount}</span>
            {` / ${TOTAL_HOOK_EVENTS} seen · ${pct}%`}
          </div>
        </div>
        <div
          style={{
            height: '6px',
            borderRadius: '999px',
            background: theme.colors.backgroundTertiary,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: theme.colors.primary,
              borderRadius: '999px',
              transition: 'width 320ms ease',
            }}
          />
        </div>
      </div>

      {/* Family groups */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 14px 18px' }}>
        {HOOK_FAMILIES.map((family) => {
          const specs = HOOK_EVENT_CATALOG.filter((s) => s.family === family);
          return (
            <div key={family} style={{ marginTop: '14px' }}>
              <div
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                }}
              >
                {family}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(168px, 1fr))',
                  gap: '8px',
                }}
              >
                {specs.map((spec) => {
                  const entry = coverage.get(spec.name) ?? {
                    spec,
                    count: 0,
                    lastSeen: null,
                  };
                  const seen = entry.count > 0;
                  const glowing =
                    entry.lastSeen != null &&
                    now - entry.lastSeen < RECENT_GLOW_MS;
                  return (
                    <Tile
                      key={spec.name}
                      spec={spec}
                      count={entry.count}
                      ago={formatAgo(entry.lastSeen, now)}
                      seen={seen}
                      glowing={glowing}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TileProps {
  spec: HookEventSpec;
  count: number;
  ago: string;
  seen: boolean;
  glowing: boolean;
}

const Tile: React.FC<TileProps> = ({ spec, count, ago, seen, glowing }) => {
  const { theme } = useTheme();

  const borderColor = glowing
    ? theme.colors.primary
    : seen
      ? theme.colors.border
      : theme.colors.border;

  return (
    <div
      title={`${spec.name} — ${spec.description}`}
      style={{
        position: 'relative',
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${borderColor}`,
        background: seen
          ? theme.colors.backgroundTertiary
          : 'transparent',
        opacity: seen ? 1 : 0.45,
        boxShadow: glowing
          ? `0 0 0 2px ${theme.colors.primary}55, 0 0 14px ${theme.colors.primary}55`
          : 'none',
        transition: 'box-shadow 240ms ease, opacity 240ms ease, background 240ms ease',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
        }}
      >
        <span
          aria-hidden
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '999px',
            flexShrink: 0,
            background: seen ? theme.colors.primary : theme.colors.border,
          }}
        />
        <span
          style={{
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.medium,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {spec.displayName}
        </span>
        {spec.isNew && (
          <span
            style={{
              fontSize: '9px',
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: '4px',
              background: `${theme.colors.primary}22`,
              color: theme.colors.primary,
              border: `1px solid ${theme.colors.primary}55`,
              flexShrink: 0,
            }}
          >
            NEW
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: theme.fonts.monospace,
          fontSize: `${theme.fontSizes[0]}px`,
          color: theme.colors.textSecondary,
        }}
      >
        <span>{seen ? `×${count}` : '—'}</span>
        <span>{ago}</span>
      </div>
    </div>
  );
};
