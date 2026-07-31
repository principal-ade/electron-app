/**
 * TrailsLeftPanel
 *
 * The Trails surface's swappable left-panel slot in `WorkspaceShell` — a
 * launcher list of saved trails from the on-disk library (cross-repo). Clicking
 * a row emits a `trail:open` portal intent (source `local`); the always-mounted
 * `PortalIntentBridge` materializes it into a `local-trail` tab in the shared
 * host (rendered by `renderProjectsTabContent`, the one trail/doc tab renderer).
 *
 * This replaced the monolithic `TrailsView` overlay (portal-unification
 * Increment 4). The intentionally-simple first cut: a flat trail list. The
 * richer File City map gallery / recent-files discovery the old view carried is
 * deferred to a future "All-Maps" surface (see docs/portal-unification.md).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Route,
  Search,
  X,
  RefreshCw,
  Clock,
  GitBranch,
  MapPin,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TrailLibraryService } from '../services/TrailLibraryService';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';
import { emitTrailOpen } from '../events/portalIntents';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';

export interface TrailsLeftPanelProps {
  /** Portal bus — `trail:open` intents are materialized by `PortalIntentBridge`. */
  events: PanelEventEmitter;
}

export const TrailsLeftPanel: React.FC<TrailsLeftPanelProps> = ({ events }) => {
  const { theme } = useTheme();
  const { activeTabId } = useWorkspaceTabs();

  const [trails, setTrails] = useState<TrailIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const rescan = useCallback(async () => {
    setLoading(true);
    try {
      const { entries } = await TrailLibraryService.list();
      // Newest-updated first.
      entries.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setTrails(entries);
    } catch (err) {
      console.error('[TrailsLeftPanel] Failed to list trails:', err);
      setTrails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void rescan();
  }, [rescan]);

  // Live-refresh when the trail library changes (a trail saved/removed in a dev
  // workspace, an inbox accept, etc.).
  useEffect(() => {
    const unsubscribe = TrailLibraryService.onLibraryChanged(() => {
      void rescan();
    });
    return unsubscribe;
  }, [rescan]);

  const handleOpen = useCallback(
    (entry: TrailIndexEntry) => {
      emitTrailOpen(events, 'trails-left-panel', {
        trailId: entry.id,
        source: 'local',
        surface: 'trails',
        title: entry.title,
      });
    },
    [events],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: TrailIndexEntry) => {
      if (!e.dataTransfer) return;
      const title = entry.title?.trim() || 'Untitled trail';
      const payload = `Use file-city trail "${title}" (id: ${entry.id}) as context — fetch via:\ncurl -s ${getPrincipalBridgeUrl()}/api/file-city/trail/${entry.id}`;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', payload);
    },
    [],
  );

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filtered = filterText
    ? trails.filter((t) => {
        const q = filterText.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.summaryPreview.toLowerCase().includes(q) ||
          t.repoNames.some((r) => r.toLowerCase().includes(q))
        );
      })
    : trails;

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
      {/* Header */}
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
          <Route size={16} color={theme.colors.primary} />
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Trails ({trails.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
            onClick={() => void rescan()}
            title="Refresh"
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
            <RefreshCw size={15} />
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
              placeholder="Filter trails…"
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

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px', minHeight: 0 }}>
        {loading ? (
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
            <Route size={40} style={{ opacity: 0.3 }} />
            <div style={{ fontWeight: theme.fontWeights.medium }}>
              {filterText ? 'No matching trails' : 'No trails yet'}
            </div>
            {!filterText && (
              <div style={{ fontSize: theme.fontSizes[0], maxWidth: 220 }}>
                Trails you save from a dev workspace, or accept from your inbox,
                show up here.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filtered.map((entry) => {
              const isActive = activeTabId === `local-trail-${entry.id}`;
              return (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, entry)}
                  onClick={() => handleOpen(entry)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                    backgroundColor: isActive
                      ? `${theme.colors.primary}14`
                      : theme.colors.backgroundSecondary,
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
                      gap: '8px',
                      minWidth: 0,
                    }}
                  >
                    <Route
                      size={14}
                      color={theme.colors.primary}
                      style={{ flexShrink: 0 }}
                    />
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
                      {entry.title || 'Untitled trail'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      flexWrap: 'wrap',
                    }}
                  >
                    {entry.repoNames.length > 0 && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          minWidth: 0,
                        }}
                      >
                        <GitBranch size={10} style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 120,
                          }}
                        >
                          {entry.repoNames.length === 1
                            ? entry.repoNames[0]
                            : `${entry.repoNames[0]} +${entry.repoNames.length - 1}`}
                        </span>
                      </span>
                    )}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <MapPin size={10} />
                      {entry.markerCount}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={10} />
                      {formatDate(entry.updatedAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrailsLeftPanel;
