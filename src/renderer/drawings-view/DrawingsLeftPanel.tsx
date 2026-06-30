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
import { PenTool, Plus, Trash2, Clock, Search, X, Copy, Check, RefreshCw } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
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
  const [filterText, setFilterText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        backgroundColor: theme.colors.background,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* List header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: theme.colors.backgroundLight,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
        >
          <PenTool size={16} color={theme.colors.primary} />
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Drawings ({drawings.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => void rescan()}
            title="Refresh"
            disabled={listLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              cursor: listLoading ? 'default' : 'pointer',
            }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: listLoading ? 'spin 0.8s linear infinite' : undefined,
              }}
            />
          </button>
          <button
            onClick={() => setShowSearch((s) => !s)}
            title="Search"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: showSearch
                ? `${theme.colors.primary}20`
                : 'transparent',
              color: showSearch
                ? theme.colors.primary
                : theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <Search size={16} />
          </button>
          <button
            onClick={handleNew}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              cursor: 'pointer',
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.medium,
            }}
          >
            <Plus size={14} />
            New
          </button>
        </div>
        {showSearch && (
          <div
            style={{
              width: '100%',
              marginTop: '8px',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="Filter drawings…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                padding: '6px 10px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: theme.fontSizes[0],
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* List body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px', minHeight: 0 }}>
        {listLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[0],
            }}
          >
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '32px 20px',
              color: theme.colors.textSecondary,
              textAlign: 'center',
            }}
          >
            <PenTool size={40} style={{ opacity: 0.3 }} />
            <div style={{ fontWeight: theme.fontWeights.medium }}>
              {filterText ? 'No matching drawings' : 'No drawings yet'}
            </div>
            {!filterText && (
              <button
                onClick={handleNew}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                }}
              >
                <Plus size={16} />
                Create Drawing
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpen(item)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: 0,
                    }}
                  >
                    <PenTool size={14} color={theme.colors.primary} />
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={(e) => handleCopyPath(item, e)}
                      title={
                        copiedId === item.id ? 'Path copied' : 'Copy file path'
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
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
                      onClick={(e) => handleDelete(item, e)}
                      title="Delete drawing"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        color: theme.colors.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {item.lastModified && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <Clock size={10} />
                    <span>{formatDate(item.lastModified)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingsLeftPanel;
