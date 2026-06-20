/**
 * LocalTopicTabContent
 *
 * Tab body for the Topics view — renders a single LOCAL topic (one from
 * `TopicService.getTopics`, not a published web-ade topic). The tab is a split:
 * the topic's markdown description (via the shared `TopicDescriptionBody`) fills
 * the left, and a "Trails" rail on the right lists the topic's curated trails.
 * The rail is omitted when the topic has no trails, so the description gets the
 * full width.
 *
 * Selecting a trail from the rail opens it as a `local-trail` tab in the Topics
 * view (via `TopicsTabsContext.openLocalTrail`), reusing the same
 * `LocalTrailTabContent` explorer the inbox/feed views use.
 *
 * No `workspaceId` is passed to the body: doc links resolve optimistically,
 * which is the right default for this cross-project reading surface.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Footprints, PanelsTopLeft } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from '../alexandria-workspace/topic-description-tab/TopicDescriptionBody';
import { TopicService } from '../main-process-api/TopicService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { TrailLibraryService } from '../services/TrailLibraryService';
import { useOpenWorkspaceWindow } from '../hooks/useOpenWorkspaceWindow';
import { useTopicsTabs } from '../principal-window/contexts/TopicsTabsContext';
import '../styles/window-open-feedback.css';

/** A topic trail resolved against the local library for its title. */
interface TrailEntry {
  id: string;
  title: string;
}

export const LocalTopicTabContent: React.FC<{
  topicId: string;
  title?: string;
  events: PanelEventEmitter;
}> = ({ topicId, title, events }) => {
  const { theme } = useTheme();
  const { openLocalTrail, activeTabId } = useTopicsTabs();
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
        console.error('[LocalTopicTabContent] failed to load trails', err);
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

  const hasTrails = trails.length > 0;

  // Promote this topic to a full Alexandria workspace window — the same path
  // HomeView's topic card uses, but routed through the shared open-with-feedback
  // hook. The resolver (find-or-create the topic's workspace) runs inside the
  // hook's `opening` phase, and `openTopicIds` tells us when a window for this
  // topic is already open so the button can show a persistent state.
  const { open, status, openTopicIds } = useOpenWorkspaceWindow();
  const isWorkspaceOpen = openTopicIds.has(topicId);
  const openInWorkspace = React.useCallback(() => {
    void open(async () => {
      const workspaces = await WorkspaceService.getWorkspaces();
      const existing = workspaces.find((w) => w.topicIds?.includes(topicId));
      if (existing) return existing.id;
      const topic = await TopicService.getTopic(topicId);
      const created = await WorkspaceService.createWorkspace({
        name: title || topic?.title || 'Topic',
        topicIds: [topicId],
      });
      return created.id;
    });
  }, [open, topicId, title]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontSize: theme.fontSizes[3],
            fontWeight: 700,
            color: theme.colors.primary,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title || 'Topic'}
        </h1>
        <button
          type="button"
          onClick={openInWorkspace}
          disabled={status === 'opening'}
          title={
            isWorkspaceOpen
              ? 'This topic has a workspace window open — click to focus it'
              : 'Open this topic in an Alexandria workspace window'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${
              isWorkspaceOpen || status === 'opened'
                ? theme.colors.primary
                : theme.colors.border
            }`,
            background: theme.colors.backgroundSecondary,
            color:
              isWorkspaceOpen || status === 'opened'
                ? theme.colors.primary
                : theme.colors.text,
            cursor: status === 'opening' ? 'default' : 'pointer',
            opacity: status === 'opening' ? 0.8 : 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            whiteSpace: 'nowrap',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
        >
          {status === 'opening' ? (
            <>
              <span
                className="wof-pulse-dot"
                style={{ background: theme.colors.primary }}
              />
              Opening…
            </>
          ) : status === 'opened' ? (
            <>
              <Check size={14} />
              Opened
            </>
          ) : isWorkspaceOpen ? (
            <>
              <span
                className="wof-open-dot"
                style={{ background: theme.colors.primary }}
              />
              Workspace open
            </>
          ) : (
            <>
              <PanelsTopLeft size={14} />
              Open in Workspace
            </>
          )}
        </button>
      </div>

      {/* Body: description on the left, trails rail on the right. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TopicDescriptionBody topicId={topicId} events={events} />
        </div>

        {hasTrails && (
          <aside
            style={{
              width: 280,
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
                const active = activeTabId === `local-trail-${trail.id}`;
                return (
                  <button
                    key={trail.id}
                    type="button"
                    onClick={() => openLocalTrail(trail.id, trail.title)}
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
        )}
      </div>
    </div>
  );
};

export default LocalTopicTabContent;
