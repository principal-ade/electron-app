/**
 * TopicTrailsRail
 *
 * The "Trails" rail shared by every topic-tab surface: it resolves a topic's
 * trail ids to titles against the local trail library and renders a clickable
 * list. It is behavior-agnostic — each surface supplies `onOpenTrail`, so the
 * Topics view can open a `local-trail` tab while the dev-workspace activates
 * the trail in File City. Returns `null` when the topic has no trails, letting
 * the description body take the full width.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Footprints } from 'lucide-react';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';

/** A topic trail resolved against the local library for its title. */
interface TrailEntry {
  id: string;
  title: string;
}

export interface TopicTrailsRailProps {
  topicId: string;
  /**
   * Invoked when a trail row is clicked. Each surface wires its own behavior:
   * the Topics view opens a `local-trail` tab; the dev-workspace activates the
   * trail in File City.
   */
  onOpenTrail: (trailId: string, title: string) => void;
  /** Predicate for active-row styling (e.g. the trail's tab is focused). */
  isTrailActive?: (trailId: string) => boolean;
  /** Rail width in px. */
  width?: number;
}

export const TopicTrailsRail: React.FC<TopicTrailsRailProps> = ({
  topicId,
  onOpenTrail,
  isTrailActive,
  width = 280,
}) => {
  const { theme } = useTheme();
  const [trails, setTrails] = React.useState<TrailEntry[]>([]);

  // Resolve the topic's trail ids to titles via the local trail library. Kept
  // live on `onTopicChange` so a trail added to the topic shows up here.
  React.useEffect(() => {
    let cancelled = false;
    const loadTrails = async () => {
      try {
        const [topic, listing] = await Promise.all([
          TopicService.getTopic(topicId),
          TrailLibraryService.list(),
        ]);
        if (cancelled) return;
        const byId = new Map(listing.entries.map((e) => [e.id, e.title]));
        const ids = topic?.trailIds ?? [];
        setTrails(
          ids.map((id) => ({ id, title: byId.get(id) ?? 'Untitled trail' })),
        );
      } catch (err) {
        console.error('[TopicTrailsRail] failed to load trails', err);
        if (!cancelled) setTrails([]);
      }
    };
    void loadTrails();
    const off = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) void loadTrails();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [topicId]);

  if (trails.length === 0) return null;

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
          color: theme.colors.textSecondary,
        }}
      >
        <Footprints size={14} />
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Trails ({trails.length})
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {trails.map((trail) => {
          const active = isTrailActive?.(trail.id) ?? false;
          return (
            <button
              key={trail.id}
              type="button"
              draggable
              onDragStart={(e) => {
                if (!e.dataTransfer) return;
                // Same agent-prompt payload the Trails panel uses, so an
                // individual trail can be dragged into a terminal as context.
                const payload = `Use file-city trail "${trail.title}" (id: ${trail.id}) as context — fetch via:\ncurl -s http://localhost:3054/api/file-city/trail/${trail.id}`;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', payload);
              }}
              onClick={() => onOpenTrail(trail.id, trail.title)}
              title={trail.title}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                marginBottom: 2,
                borderRadius: 6,
                border: `1px solid ${
                  active ? theme.colors.primary : 'transparent'
                }`,
                background: active
                  ? theme.colors.backgroundSecondary
                  : 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background =
                    theme.colors.backgroundSecondary;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Footprints
                size={14}
                style={{ flexShrink: 0, opacity: 0.8, marginTop: 2 }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  lineHeight: 1.35,
                }}
              >
                {trail.title}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default TopicTrailsRail;
