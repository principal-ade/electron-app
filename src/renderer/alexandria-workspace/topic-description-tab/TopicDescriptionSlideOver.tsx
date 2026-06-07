/**
 * Left-column slide-over that renders the current topic's description as
 * markdown (via IndustryMarkdownSlide). It's anchored inside the left panel
 * column — toggled from the titlebar's Description button — and slides in over
 * whichever left segment (Projects/Trails/Sessions) is active.
 *
 * Full editing happens in the dedicated MDXEditor tab: the header "Edit"
 * button calls `onEdit`, which opens that tab (the slide-over stays open and
 * live-refreshes via `TopicService.onTopicChange`). The preview also supports
 * lightweight inline deletion — highlight text or click a list item's bullet
 * to remove it — persisted through the same `TopicService.updateTopic` sink.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { ArrowDownToLine, FileText, Pencil, X } from 'lucide-react';
import {
  DATA_TYPES,
  useDropZone,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { TopicStatus } from '@principal-ai/alexandria-core-library';
import { TopicService } from '../../main-process-api/TopicService';
import { useMarkdownLinkHandler } from '../../hooks/useMarkdownLinkHandler';
import { useWorkspaceFileIndex } from '../../hooks/useWorkspaceFileIndex';
import { MarkdownLinkNotice } from '../../components/MarkdownLinkNotice';
import {
  TopicStatusControl,
  STATES,
  stateColor,
} from './TopicStatusControl';

export interface TopicDescriptionSlideOverProps {
  open: boolean;
  /**
   * When true, the panel appears with no slide-in transition — used when the
   * notes are opened by default on window launch, so they're simply present
   * rather than animating in. Normal toggles leave this false and animate.
   */
  instant?: boolean;
  /** Topic whose description is shown. The slide-over no-ops without one. */
  topicId?: string;
  onClose: () => void;
  /** Opens the topic-description MDXEditor tab (current edit affordance). */
  onEdit: () => void;
  /** Event bus — used to open clicked doc links as tabs (`file:opened`). */
  events: PanelEventEmitter;
  /**
   * Workspace whose member repositories doc links resolve against. Topic notes
   * span projects and usually have no single "current repo", so links are
   * matched against the file trees of every repo in this workspace.
   */
  workspaceId?: string;
  /**
   * Fallback repo for resolving links before the workspace file index has
   * loaded (the currently selected repo, when there is one).
   */
  repositoryPath?: string;
}

export const TopicDescriptionSlideOver: React.FC<
  TopicDescriptionSlideOverProps
> = ({
  open,
  instant,
  topicId,
  onClose,
  onEdit,
  events,
  workspaceId,
  repositoryPath,
}) => {
  const { theme } = useTheme();
  const { resolve } = useWorkspaceFileIndex(workspaceId);
  const { onLinkClick, notice, dismissNotice, openCandidate } =
    useMarkdownLinkHandler({
      events,
      resolve,
      repositoryPath,
      source: 'topic-notes',
    });
  const [description, setDescription] = useState<string | null>(null);
  const [status, setStatus] = useState<TopicStatus | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  // The status editor is collapsed by default — the header pill reflects the
  // current state and toggles the full TopicStatusControl form open/closed.
  const [statusOpen, setStatusOpen] = useState(false);

  // Load the description when opened, and refresh whenever this topic changes
  // while open — so edits made in the MDX tab flow into the preview live.
  useEffect(() => {
    if (!open || !topicId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const topic = await TopicService.getTopic(topicId);
        if (!cancelled) {
          setDescription(topic?.description ?? '');
          setStatus(topic?.status);
        }
      } catch (err) {
        console.error('[TopicDescriptionSlideOver] load failed', err);
        if (!cancelled) {
          setDescription('');
          setStatus(undefined);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const off = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [open, topicId]);

  // Append dropped text (e.g. a terminal selection dragged in via the
  // panel-framework drag protocol) to the bottom of the description. The
  // append is atomic in main and broadcasts TOPIC_UPDATED, which the
  // onTopicChange subscription above turns into a live refresh.
  const appendDroppedText = React.useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || !topicId) return;
      try {
        await TopicService.appendToDescription(topicId, value);
      } catch (err) {
        console.error('[TopicDescriptionSlideOver] append failed', err);
      }
    },
    [topicId],
  );

  // Inline deletion: highlighting text (or clicking a list item's bullet) in
  // the preview removes it and hands us the new content. Update optimistically
  // and persist through the same sink the MDX editor tab uses; the
  // TOPIC_UPDATED broadcast then reconciles via the onTopicChange subscription.
  const handleContentChange = React.useCallback(
    (next: string) => {
      if (!topicId) return;
      setDescription(next);
      void TopicService.updateTopic(topicId, { description: next }).catch(
        (err) => {
          console.error(
            '[TopicDescriptionSlideOver] description update failed',
            err,
          );
        },
      );
    },
    [topicId],
  );

  const { isDragOver, ...dropZoneProps } = useDropZone({
    handlers: [
      {
        dataType: DATA_TYPES.TEXT_SELECTION,
        onDrop: (data) => {
          void appendDroppedText(data.primaryData);
        },
      },
    ],
    onPlainTextDrop: (text) => {
      void appendDroppedText(text);
    },
    showVisualFeedback: true,
  });

  const trimmed = (description ?? '').trim();

  // Header status pill — color-coded by the structured state, labelled by the
  // topic's custom label when set (otherwise the state's display name).
  const pillState = status?.state ?? 'active';
  const pillColor = stateColor(pillState, theme);
  const pillLabel =
    status?.label?.trim() ||
    STATES.find((s) => s.value === pillState)?.label ||
    'Active';

  const iconButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    flexShrink: 0,
    padding: 0,
    borderRadius: 6,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.backgroundSecondary,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  };

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
        borderRight: `1px solid ${theme.colors.border}`,
        boxShadow: open ? '4px 0 16px rgba(0,0,0,0.2)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: instant ? 'none' : 'transform 0.25s ease',
        zIndex: 20,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <FileText size={14} color={theme.colors.textSecondary} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Topic Notes
        </span>
        {topicId && (
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            title="Topic status"
            aria-label="Topic status"
            aria-expanded={statusOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              maxWidth: 140,
              flexShrink: 0,
              padding: '0 10px',
              borderRadius: 6,
              border: `1px solid ${pillColor}`,
              background: statusOpen ? pillColor : 'transparent',
              color: statusOpen ? theme.colors.background : pillColor,
              cursor: 'pointer',
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                flexShrink: 0,
                borderRadius: '50%',
                background: statusOpen ? theme.colors.background : pillColor,
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pillLabel}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          title="Edit description"
          aria-label="Edit description"
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.text;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close description"
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.text;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          <X size={14} />
        </button>
      </div>

      {topicId && statusOpen && (
        <TopicStatusControl topicId={topicId} status={status} />
      )}

      <div
        {...dropZoneProps}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          outline: isDragOver ? `2px dashed ${theme.colors.primary}` : 'none',
          outlineOffset: -2,
          background: isDragOver ? `${theme.colors.primary}14` : undefined,
          transition: 'background 0.12s ease',
        }}
      >
        {isDragOver && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: theme.colors.primary,
              color: '#ffffff',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              pointerEvents: 'none',
            }}
          >
            <ArrowDownToLine size={14} />
            Drop to append to notes
          </div>
        )}
        {loading && description === null ? (
          <div
            style={{
              padding: '12px 16px',
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            Loading…
          </div>
        ) : trimmed ? (
          <IndustryMarkdownSlide
            content={description as string}
            slideIdPrefix="topic-description"
            slideIndex={0}
            isVisible={open}
            theme={theme}
            transparentBackground
            enableKeyboardScrolling={false}
            onLinkClick={onLinkClick}
            onOpenMermaidInTab={(code, title) =>
              events.emit({
                type: 'mermaid:open-in-tab',
                source: 'topic-notes',
                timestamp: Date.now(),
                payload: { code, title },
              })
            }
            selectableBlocks
            deletionMode="text"
            onContentChange={handleContentChange}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '16px',
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            <span>This topic has no description yet.</span>
            <button
              type="button"
              onClick={onEdit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.primary}`,
                background: 'transparent',
                color: theme.colors.primary,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
              }}
            >
              <Pencil size={13} />
              Add a description
            </button>
          </div>
        )}
      </div>

      {notice && (
        <MarkdownLinkNotice
          notice={notice}
          onDismiss={dismissNotice}
          onChoose={openCandidate}
        />
      )}
    </div>
  );
};

export default TopicDescriptionSlideOver;
