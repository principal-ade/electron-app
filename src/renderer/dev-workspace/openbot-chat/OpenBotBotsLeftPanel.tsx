/**
 * OpenBotBotsLeftPanel
 *
 * Bots side panel for the OpenBot surface. Follows the same shell convention as
 * the Projects, Topics, and Subsystem Models left panels: a docked column with
 * a title header, refresh/add actions, a filter field, and a list of rows.
 *
 * `OpenBotBotsPanel` supplies live data in the app; the stories use fixtures.
 */

import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';

export type OpenBotBotStatus = 'ready' | 'working' | 'offline';

/** A bot available to chat with. */
export interface OpenBotBot {
  id: string;
  /** OpenBot runtime agent id; matches `channel.agentIds[0]` in the adapter. */
  agentId?: string;
  name: string;
  summary?: string | null;
  status?: OpenBotBotStatus;
  conversations?: number;
  /** ISO timestamp of the last activity, shown on the right of the meta row. */
  updatedAt?: string;
}

export interface OpenBotBotsLeftPanelProps {
  bots: readonly OpenBotBot[];
  activeBotId?: string | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onAddBot?: () => void;
  onSelectBot?: (botId: string) => void;
}

/** Compact "x ago" relative time from an ISO timestamp. */
function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
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

function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

function statusLabel(status: OpenBotBotStatus = 'ready'): string {
  if (status === 'working') return 'Working';
  if (status === 'offline') return 'Offline';
  return 'Ready';
}

export const OpenBotBotsLeftPanel: React.FC<OpenBotBotsLeftPanelProps> = ({
  bots,
  activeBotId,
  loading = false,
  error,
  onRefresh,
  onAddBot,
  onSelectBot,
}) => {
  const { theme } = useTheme();
  const showLoading = useDelayedLoading(loading);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const visibleBots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return bots;
    return bots.filter(
      (bot) =>
        bot.name.toLowerCase().includes(normalizedQuery) ||
        (bot.summary ?? '').toLowerCase().includes(normalizedQuery),
    );
  }, [bots, query]);

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

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

  const statusColor = (status: OpenBotBotStatus = 'ready') => {
    if (status === 'working') return theme.colors.warning;
    if (status === 'offline') return theme.colors.textMuted;
    return theme.colors.success;
  };

  const renderList = () => {
    if (loading && bots.length === 0) {
      return showLoading ? emptyState('Loading…') : null;
    }
    if (error) return emptyState(error);
    if (bots.length === 0) {
      return emptyState(
        'No bots yet. Bots running in OpenBot appear here.',
      );
    }
    if (visibleBots.length === 0) {
      return emptyState('No bots match your search.');
    }

    return visibleBots.map((bot) => {
      const hovered = hoveredId === bot.id;
      const active = activeBotId === bot.id;
      const status = bot.status ?? 'ready';
      return (
        <button
          key={bot.id}
          aria-current={active ? 'true' : undefined}
          onClick={() => onSelectBot?.(bot.id)}
          onMouseEnter={() => setHoveredId(bot.id)}
          onMouseLeave={() => setHoveredId(null)}
          type="button"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing.sm,
            width: '100%',
            padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
            backgroundColor:
              active || hovered
                ? theme.colors.backgroundSecondary
                : 'transparent',
            border: 'none',
            borderBottom: `1px solid ${theme.colors.border}`,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.15s ease',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              flex: '0 0 auto',
              marginTop: 1,
              borderRadius: '50%',
              color: theme.colors.background,
              background: active
                ? theme.colors.primary
                : theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {initialsOf(bot.name)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                overflow: 'hidden',
                marginBottom: 2,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: active ? 700 : 500,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {bot.name}
            </div>
            {bot.summary ? (
              <div
                style={{
                  overflow: 'hidden',
                  marginBottom: 3,
                  color: theme.colors.textMuted,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {bot.summary}
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: spacing.sm,
                color: theme.colors.textMuted,
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[1],
              }}
            >
              <span
                style={{
                  display: 'flex',
                  flex: 1,
                  minWidth: 0,
                  alignItems: 'center',
                  gap: spacing.xs,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    flex: '0 0 auto',
                    borderRadius: '50%',
                    background: statusColor(status),
                  }}
                />
                {statusLabel(status)}
                {typeof bot.conversations === 'number'
                  ? ` · ${bot.conversations} ${
                      bot.conversations === 1 ? 'chat' : 'chats'
                    }`
                  : ''}
              </span>
              {bot.updatedAt ? (
                <span style={{ flexShrink: 0 }}>{timeAgo(bot.updatedAt)}</span>
              ) : null}
            </div>
          </div>
        </button>
      );
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header: title + add/refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          height: 40,
          boxSizing: 'border-box',
          padding: `0 ${spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <Bot
          size={16}
          color={theme.colors.text}
          style={{ marginLeft: 4 }}
        />
        <span
          style={{
            flex: 1,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
          }}
        >
          Bots
        </span>
        {onAddBot ? (
          <button
            onClick={onAddBot}
            title="Add bot"
            aria-label="Add bot"
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.xs,
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
          </button>
        ) : null}
        <button
          onClick={() => onRefresh?.()}
          title="Refresh"
          aria-label="Refresh bots"
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            border: 'none',
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Text filter */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            flex: 1,
            minWidth: 0,
            alignItems: 'center',
            gap: spacing.sm,
            height: 30,
            boxSizing: 'border-box',
            padding: `0 ${spacing.sm}px`,
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <Search size={14} color={theme.colors.textSecondary} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter bots"
            aria-label="Filter bots"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
            }}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              title="Clear filter"
              aria-label="Clear filter"
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {renderList()}
      </div>
    </div>
  );
};

export default OpenBotBotsLeftPanel;
