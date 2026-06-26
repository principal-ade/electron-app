import React, { useCallback, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Copy, List, PanelsTopLeft } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from '../topic-description-tab/TopicDescriptionBody';
import { TopicTrailsRail } from '../topic-description-tab/TopicTrailsRail';
import { TopicService } from '../../main-process-api/TopicService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { useOpenWorkspaceWindow } from '../../hooks/useOpenWorkspaceWindow';
import '../../styles/window-open-feedback.css';

/**
 * Renders an arbitrary topic (by id) inside the Alexandria window — the
 * read-only counterpart to the Topics view's `LocalTopicTabContent`, used when
 * the bridge's `POST /api/topics/:id/activate` targets this window.
 *
 * It reuses the same surface-agnostic pieces (`TopicDescriptionBody` +
 * `TopicTrailsRail`) but is decoupled from the principal window's
 * `TopicsTabsContext`: the host supplies `onOpenTrail`, so trail clicks open
 * an Alexandria `local-trail` tab instead of reaching for `useTopicsTabs`.
 *
 * The header's "Open in Workspace" button is hidden when the topic *is* this
 * workspace's own bound topic (`currentWorkspaceTopicId`) — you're already in
 * its workspace, so promoting it again is a no-op.
 */
export const AlexandriaTopicTabContent: React.FC<{
  topicId: string;
  title?: string;
  events: PanelEventEmitter;
  onOpenTrail: (trailId: string, title: string) => void;
  isTrailActive?: (trailId: string) => boolean;
  /** The topic this workspace window is bound to, if any. */
  currentWorkspaceTopicId?: string;
}> = ({
  topicId,
  title,
  events,
  onOpenTrail,
  isTrailActive,
  currentWorkspaceTopicId,
}) => {
  const { theme } = useTheme();

  // Table-of-contents drawer: the body reports whether the description has
  // headings (`hasToc`), this owns the open-state, and the body renders the
  // outline overlay (it has the heading DOM).
  const [tocOpen, setTocOpen] = useState(false);
  const [hasToc, setHasToc] = useState(false);
  const closeToc = useCallback(() => setTocOpen(false), []);

  // Copy the topic's on-disk JSON path to the clipboard, with a brief "copied"
  // confirmation. `getFilePath` is null while the legacy topics blob is the
  // backend (no per-topic file) — the click then no-ops.
  const [copiedPath, setCopiedPath] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTopicPath = useCallback(async () => {
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

  // Promote this topic to its own Alexandria workspace window. Hidden when the
  // topic is the one this window is already bound to.
  const showOpenInWorkspace =
    !currentWorkspaceTopicId || topicId !== currentWorkspaceTopicId;
  const { open, status, openTopicIds } = useOpenWorkspaceWindow();
  const isWorkspaceOpen = openTopicIds.has(topicId);
  const openInWorkspace = useCallback(() => {
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
        width: '100%',
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
        {showOpenInWorkspace && (
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
        )}
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
          onOpenTrail={onOpenTrail}
          isTrailActive={isTrailActive}
        />
      </div>
    </div>
  );
};

export default AlexandriaTopicTabContent;
