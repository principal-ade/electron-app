import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Network, RefreshCw, Search, X } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { SubsystemModelSummary } from '../../shared/tipc/subsystemModelRouterTypes';
import { SubsystemModelService } from '../main-process-api/SubsystemModelService';
import { emitSubsystemModelOpen } from '../events/portalIntents';
import { useDelayedLoading } from '../hooks/useDelayedLoading';

interface SubsystemModelsLeftPanelProps {
  events: PanelEventEmitter;
  activeTabId: string | null;
}

function timeAgo(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
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

export const SubsystemModelsLeftPanel: React.FC<
  SubsystemModelsLeftPanelProps
> = ({ events, activeTabId }) => {
  const { theme } = useTheme();
  const [models, setModels] = useState<SubsystemModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoading = useDelayedLoading(loading);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setModels(await SubsystemModelService.list());
    } catch (loadError) {
      console.error(
        '[SubsystemModelsLeftPanel] Failed to load models:',
        loadError,
      );
      setError('Could not load subsystem models.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return models;
    return models.filter(
      (model) =>
        model.title.toLowerCase().includes(normalizedQuery) ||
        (model.description ?? '').toLowerCase().includes(normalizedQuery),
    );
  }, [models, query]);

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

  const renderList = () => {
    if (loading && models.length === 0) {
      return showLoading ? emptyState('Loading…') : null;
    }
    if (error) return emptyState(error);
    if (models.length === 0) {
      return emptyState('No subsystem models found.');
    }
    if (visibleModels.length === 0) {
      return emptyState('No subsystem models match this filter.');
    }

    return visibleModels.map((model) => {
      const hovered = hoveredId === model.id;
      const active = activeTabId === `subsystem-model-${model.id}`;
      return (
        <button
          key={model.id}
          type="button"
          onClick={() =>
            emitSubsystemModelOpen(
              events,
              'subsystem-models-left-panel',
              {
                modelId: model.id,
                title: model.title,
              },
            )
          }
          onMouseEnter={() => setHoveredId(model.id)}
          onMouseLeave={() => setHoveredId(null)}
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
          <Network
            size={14}
            color={theme.colors.primary}
            style={{ flexShrink: 0, marginTop: 3 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: active ? 700 : 500,
                color: theme.colors.text,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {model.title}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: spacing.sm,
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textMuted,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {model.componentCount}{' '}
                {model.componentCount === 1 ? 'component' : 'components'}
              </span>
              <span style={{ flexShrink: 0 }}>{timeAgo(model.updatedAt)}</span>
            </div>
          </div>
        </button>
      );
    });
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
      {/* Header: title + refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          flexShrink: 0,
        }}
      >
        <Network
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
          Subsystem Models
        </span>
        <button
          type="button"
          onClick={() => void loadModels()}
          title="Refresh"
          aria-label="Refresh subsystem models"
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

      {/* Text filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `0 ${spacing.sm}px ${spacing.sm}px`,
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter subsystem models"
            aria-label="Filter subsystem models"
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
              type="button"
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
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {renderList()}
      </div>
    </div>
  );
};
