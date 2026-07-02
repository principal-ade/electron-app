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
 * Selecting a trail from the rail emits a `trail:open` intent (source `local`)
 * on the portal bus; the always-mounted PortalIntentBridge opens it as a
 * `local-trail` tab (hosted by the persistent WorkspaceShell), reusing the same
 * `LocalTrailTabContent` explorer the inbox/feed views use.
 *
 * No `workspaceId` is passed to the body: doc links resolve optimistically,
 * which is the right default for this cross-project reading surface.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Copy, List, PanelsTopLeft } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from '../alexandria-workspace/topic-description-tab/TopicDescriptionBody';
import { TopicStatusHeaderButton } from '../alexandria-workspace/topic-description-tab/TopicStatusHeaderButton';
import { TopicTrailsRail } from '../alexandria-workspace/topic-description-tab/TopicTrailsRail';
import { TopicService } from '../main-process-api/TopicService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { useOpenWorkspaceWindow } from '../hooks/useOpenWorkspaceWindow';
import { emitTrailOpen } from '../events/portalIntents';
import { usePortalEvents } from '../principal-window/PortalEventContext';
import { useTopicsTabs } from '../principal-window/contexts/TopicsTabsContext';
import '../styles/window-open-feedback.css';

export const LocalTopicTabContent: React.FC<{
  topicId: string;
  title?: string;
  events: PanelEventEmitter;
}> = ({ topicId, title, events }) => {
  const { theme } = useTheme();
  // `activeTabId` (read-only highlight) still comes from the tab context; the
  // open path is decoupled — selecting a trail emits `trail:open` on the portal
  // bus and the single PortalIntentBridge listener turns it into a tab. (The
  // per-view `events` prop stays — it's the bus the markdown body uses for link
  // handling.)
  const { activeTabId } = useTopicsTabs();
  const { events: portalEvents } = usePortalEvents();

  // When the topic has no projects and no trails the rail collapses; centering
  // the (capped) description in the full view then reads better than pinning it
  // to the left beside empty space. The rail reports this via `onEmptyChange`.
  const [railEmpty, setRailEmpty] = React.useState(false);

  // Table-of-contents drawer: the body reports whether the description has
  // headings (`hasToc`), this owns the open-state, and the body renders the
  // outline overlay (it has the heading DOM).
  const [tocOpen, setTocOpen] = React.useState(false);
  const [hasToc, setHasToc] = React.useState(false);
  const closeToc = React.useCallback(() => setTocOpen(false), []);

  // Copy the topic's on-disk JSON path to the clipboard, with a brief "copied"
  // confirmation. `getFilePath` is null while the legacy topics blob is the
  // backend (no per-topic file) — the click then no-ops.
  const [copiedPath, setCopiedPath] = React.useState(false);
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTopicPath = React.useCallback(async () => {
    const filePath = await TopicService.getFilePath(topicId);
    if (!filePath) return;
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedPath(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopiedPath(false), 1500);
    } catch {
      // navigator.clipboard can reject in restricted webviews; no-op.
    }
  }, [topicId]);
  React.useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

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
          onClick={() => void copyTopicPath()}
          title="Copy topic file path"
          aria-label="Copy topic file path"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            flexShrink: 0,
            padding: 0,
            borderRadius: 6,
            border: `1px solid ${
              copiedPath ? theme.colors.primary : theme.colors.border
            }`,
            background: theme.colors.backgroundSecondary,
            color: copiedPath ? theme.colors.primary : theme.colors.text,
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
        >
          {copiedPath ? <Check size={16} /> : <Copy size={16} />}
        </button>
        {hasToc && (
          <button
            type="button"
            onClick={() => setTocOpen((o) => !o)}
            title="Table of contents"
            aria-label="Table of contents"
            aria-expanded={tocOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              flexShrink: 0,
              padding: 0,
              borderRadius: 6,
              border: `1px solid ${
                tocOpen ? theme.colors.primary : theme.colors.border
              }`,
              background: theme.colors.backgroundSecondary,
              color: tocOpen ? theme.colors.primary : theme.colors.text,
              cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <List size={16} />
          </button>
        )}
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
        <TopicStatusHeaderButton topicId={topicId} />
      </div>

      {/* Body: description (capped for readability) on the left, trails/projects
          rail filling the remaining space on the right. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{
            // With a rail present, hold at 800 on the left; when the rail
            // collapses, fill the view so the (centered) description sits in
            // the middle instead of pinned left beside empty space.
            ...(railEmpty
              ? { flex: 1 }
              : { flex: '0 1 800px', maxWidth: 800 }),
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Match the markdown slide's own background (theme.colors.backgroundDark)
            // so the area reads uniform when the centered prose leaves side gaps.
            backgroundColor: theme.colors.backgroundDark,
          }}
        >
          <TopicDescriptionBody
            topicId={topicId}
            events={events}
            tocOpen={tocOpen}
            onCloseToc={closeToc}
            onTocAvailableChange={setHasToc}
          />
        </div>

        <TopicTrailsRail
          topicId={topicId}
          fill
          onEmptyChange={setRailEmpty}
          onOpenTrail={(trailId, trailTitle) =>
            emitTrailOpen(portalEvents, 'local-topic-tab', {
              trailId,
              source: 'local',
              surface: 'topics',
              title: trailTitle,
            })
          }
          isTrailActive={(id) => activeTabId === `local-trail-${id}`}
        />
      </div>
    </div>
  );
};

export default LocalTopicTabContent;
