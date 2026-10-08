/**
 * DrawingsLeftPanel
 *
 * The Drawings surface's swappable left-panel slot in `WorkspaceShell` — a
 * launcher list of `.excalidraw` drawings. Clicking a row (or New) emits a
 * `drawing:open` intent on the shell's local bus; the canvas opens as a tab
 * (`DrawingTabContent`). Rescans when a drawing is saved or deleted.
 *
 * Extracted from the former `DrawingsView` overlay's master list.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  PenTool,
  Plus,
  Trash2,
  Search,
  X,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import {
  DRAWING_EVENTS,
  resolveDrawingsDir,
  scanDrawings,
  type DrawingItem,
  type DrawingOpenPayload,
  type DrawingDeleteRequestedPayload,
} from './drawingsStorage';

export interface DrawingsLeftPanelProps {
  /** Shell-local event bus (open/save/delete sync). */
  events: PanelEventEmitter;
}

export const DrawingsLeftPanel: React.FC<DrawingsLeftPanelProps> = ({
  events,
}) => {
  const { theme } = useTheme();

  const [drawingsDir, setDrawingsDir] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const showLoading = useDelayedLoading(listLoading);
  const [filterText, setFilterText] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Id of the drawing whose path was just copied, for transient button feedback.
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveDrawingsDir().then((dir) => {
      if (!cancelled) setDrawingsDir(dir);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rescan = useCallback(async () => {
    if (!drawingsDir) return;
    setListLoading(true);
    try {
      setDrawings(await scanDrawings(drawingsDir));
    } catch (err) {
      console.error('[DrawingsLeftPanel] Failed to scan drawings:', err);
      setDrawings([]);
    } finally {
      setListLoading(false);
    }
  }, [drawingsDir]);

  useEffect(() => {
    if (drawingsDir) void rescan();
  }, [drawingsDir, rescan]);

  // Rescan when a drawing is saved or deleted elsewhere (canvas tab / host).
  useEffect(() => {
    const onChange = () => {
      void rescan();
    };
    events.on(DRAWING_EVENTS.saved, onChange);
    events.on(DRAWING_EVENTS.deleted, onChange);
    return () => {
      events.off(DRAWING_EVENTS.saved, onChange);
      events.off(DRAWING_EVENTS.deleted, onChange);
    };
  }, [events, rescan]);

  const emitOpen = useCallback(
    (payload: DrawingOpenPayload) => {
      events.emit({
        type: DRAWING_EVENTS.open,
        source: 'drawings-left-panel',
        timestamp: Date.now(),
        payload,
      });
    },
    [events],
  );

  const handleOpen = useCallback(
    (item: DrawingItem) => {
      emitOpen({ drawingId: item.id, path: item.path, name: item.name });
    },
    [emitOpen],
  );

  const handleNew = useCallback(() => {
    const drawingId = `new-${crypto.randomUUID?.() ?? Date.now()}`;
    emitOpen({ drawingId, name: 'Untitled Diagram' });
  }, [emitOpen]);

  const handleDelete = useCallback(
    (item: DrawingItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Delete "${item.name}"?`)) return;
      events.emit<DrawingDeleteRequestedPayload>({
        type: DRAWING_EVENTS.deleteRequested,
        source: 'drawings-left-panel',
        timestamp: Date.now(),
        payload: { drawingId: item.id, path: item.path, name: item.name },
      });
    },
    [events],
  );

  const handleCopyPath = useCallback(
    async (item: DrawingItem, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(item.path);
        setCopiedId(item.id);
        setTimeout(() => {
          setCopiedId((prev) => (prev === item.id ? null : prev));
        }, 1500);
      } catch (err) {
        console.error('[DrawingsLeftPanel] Failed to copy path:', err);
      }
    },
    [],
  );

  const formatDate = (date?: Date) => {
    if (!date) return '';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filtered = filterText
    ? drawings.filter((d) =>
        d.name.toLowerCase().includes(filterText.toLowerCase()),
      )
    : drawings;

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
      {/* Header: title + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          flexShrink: 0,
        }}
      >
        <PenTool
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
          Drawings
        </span>
        <button
          type="button"
          onClick={handleNew}
          title="New drawing"
          aria-label="New drawing"
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
          type="button"
          onClick={() => void rescan()}
          title="Refresh"
          aria-label="Refresh drawings"
          disabled={listLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: listLoading ? 'default' : 'pointer',
          }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: listLoading ? 'spin 0.8s linear infinite' : undefined,
            }}
          />
        </button>
      </div>

      {/* Filter */}
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
            placeholder="Filter drawings"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            aria-label="Filter drawings"
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
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
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

      {/* List body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {listLoading && drawings.length === 0 ? (
          showLoading ? emptyState('Loading…') : null
        ) : filtered.length === 0 ? (
          emptyState(
            filterText
              ? 'No drawings match this filter.'
              : 'No drawings yet. Use + to create one.',
          )
        ) : (
          filtered.map((item) => {
            const hovered = hoveredId === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: spacing.sm,
                  width: '100%',
                  padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
                  backgroundColor:
                    hovered ? theme.colors.backgroundSecondary : 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    flex: 1,
                    minWidth: 0,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <PenTool
                    size={14}
                    color={theme.colors.primary}
                    style={{ flexShrink: 0, marginTop: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[2],
                        fontWeight: 500,
                        color: theme.colors.text,
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
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
                      <span style={{ flex: 1, minWidth: 0 }}>Drawing</span>
                      {item.lastModified && (
                        <span style={{ flexShrink: 0 }}>
                          {formatDate(item.lastModified)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => handleCopyPath(item, event)}
                    title={
                      copiedId === item.id ? 'Path copied' : 'Copy file path'
                    }
                    aria-label={`Copy path for ${item.name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: spacing.xs,
                      border: 'none',
                      background: 'transparent',
                      color:
                        copiedId === item.id
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedId === item.id ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => handleDelete(item, event)}
                    title="Delete drawing"
                    aria-label={`Delete ${item.name}`}
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
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DrawingsLeftPanel;
