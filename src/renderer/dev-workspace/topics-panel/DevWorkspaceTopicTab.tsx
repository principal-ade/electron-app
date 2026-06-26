import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Copy, List, PanelsTopLeft } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from '../../alexandria-workspace/topic-description-tab/TopicDescriptionBody';
import { TopicTrailsRail } from '../../alexandria-workspace/topic-description-tab/TopicTrailsRail';
import { TopicService } from '../../main-process-api/TopicService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { useOpenWorkspaceWindow } from '../../hooks/useOpenWorkspaceWindow';
import { TRAIL_EVENT, type TrailOpenEvent } from '../trail-events';
import '../../styles/window-open-feedback.css';

export interface DevWorkspaceTopicTabProps {
  topicId: string;
  /** Tab label / heading; also seeds a new workspace's name. */
  title?: string;
  /** Gates the description body's open-time fetch; pass the tab's active flag. */
  isActive: boolean;
  events: PanelEventEmitter;
  /** Workspace whose repos the topic's doc links resolve against (optional). */
  workspaceId?: string;
  /** Current repo, used as a link-resolution fallback (optional). */
  repositoryPath?: string;
}

/**
 * Tab content for a topic opened from the dev-workspace Topics panel. Reuses
 * the chrome-less {@link TopicDescriptionBody} for the markdown description and
 * the shared {@link TopicTrailsRail} for the trails list. Clicking a trail
 * opens it as its own `local-trail` tab — the panel framework listens for the
 * {@link TRAIL_EVENT.open} emit — mirroring how the Topics view opens a trail
 * tab rather than activating it in File City.
 *
 * The header mirrors the Topics view's `LocalTopicTabContent`: title, an
 * optional table-of-contents toggle, and an "Open in Workspace" button that
 * promotes the topic into an Alexandria workspace window — a *different* window
 * from this dev-workspace, so the affordance is meaningful here.
 */
export const DevWorkspaceTopicTab: React.FC<DevWorkspaceTopicTabProps> = ({
  topicId,
  title,
  isActive,
  events,
  workspaceId,
  repositoryPath,
}) => {
  const { theme } = useTheme();

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

  // Promote this topic to a full Alexandria workspace window — a distinct
  // window from this dev-workspace. The resolver (find-or-create the topic's
  // workspace) runs inside the hook's `opening` phase, and `openTopicIds` tells
  // us when a window for this topic is already open so the button can show a
  // persistent state.
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

  const openTrail = useCallback(
    (id: string, trailTitle: string) => {
      events.emit<TrailOpenEvent>({
        type: TRAIL_EVENT.open,
        source: 'topic-tab',
        timestamp: Date.now(),
        payload: { trailId: id, title: trailTitle },
      });
    },
    [events],
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: theme.colors.background,
        color: theme.colors.text,
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
            fontFamily: theme.fonts.heading,
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
      </div>

      {/* Body: description on the left, trails rail on the right. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}
        >
          <TopicDescriptionBody
            topicId={topicId}
            visible={isActive}
            events={events}
            workspaceId={workspaceId}
            repositoryPath={repositoryPath}
            tocOpen={tocOpen}
            onCloseToc={closeToc}
            onTocAvailableChange={setHasToc}
          />
        </div>

        <TopicTrailsRail
          topicId={topicId}
          onOpenTrail={openTrail}
          width={260}
        />
      </div>
    </div>
  );
};
