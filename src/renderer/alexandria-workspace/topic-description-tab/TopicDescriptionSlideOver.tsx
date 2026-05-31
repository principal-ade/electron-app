/**
 * Left-column slide-over that renders the current topic's description as
 * read-only markdown (via IndustryMarkdownSlide). It's anchored inside the
 * left panel column — toggled from the titlebar's Description button — and
 * slides in over whichever left segment (Projects/Trails/Sessions) is active.
 *
 * Editing still happens in the dedicated MDXEditor tab: the header "Edit"
 * button calls `onEdit`, which opens that tab (the slide-over stays open and
 * live-refreshes via `TopicService.onTopicChange`).
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { FileText, Pencil, X } from 'lucide-react';
import { TopicService } from '../../main-process-api/TopicService';

export interface TopicDescriptionSlideOverProps {
  open: boolean;
  /** Topic whose description is shown. The slide-over no-ops without one. */
  topicId?: string;
  onClose: () => void;
  /** Opens the topic-description MDXEditor tab (current edit affordance). */
  onEdit: () => void;
}

export const TopicDescriptionSlideOver: React.FC<
  TopicDescriptionSlideOverProps
> = ({ open, topicId, onClose, onEdit }) => {
  const { theme } = useTheme();
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load the description when opened, and refresh whenever this topic changes
  // while open — so edits made in the MDX tab flow into the preview live.
  useEffect(() => {
    if (!open || !topicId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const topic = await TopicService.getTopic(topicId);
        if (!cancelled) setDescription(topic?.description ?? '');
      } catch (err) {
        console.error('[TopicDescriptionSlideOver] load failed', err);
        if (!cancelled) setDescription('');
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

  const trimmed = (description ?? '').trim();

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
        transition: 'transform 0.25s ease',
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
          Description
        </span>
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

      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
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
    </div>
  );
};

export default TopicDescriptionSlideOver;
