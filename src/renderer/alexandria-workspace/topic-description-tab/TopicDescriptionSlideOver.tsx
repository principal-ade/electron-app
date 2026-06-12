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
import { ArrowDownToLine, Brain, Pencil, X } from 'lucide-react';
import {
  DATA_TYPES,
  useDropZone,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type {
  TopicAsset,
  TopicStatus,
} from '@principal-ai/alexandria-core-library';
import { TopicService } from '../../main-process-api/TopicService';
import {
  describeRejection,
  extractImageFiles,
  prepareImageAsset,
} from './topicImageDrop';
import { useMarkdownLinkHandler } from '../../hooks/useMarkdownLinkHandler';
import { useWorkspaceFileIndex } from '../../hooks/useWorkspaceFileIndex';
import { MarkdownLinkNotice } from '../../components/MarkdownLinkNotice';
import {
  TopicStatusControl,
  STATES,
  stateColor,
} from './TopicStatusControl';

const ASSET_SCHEME = 'asset://';

// Value-equality for the topic's inline assets. A background TOPIC_UPDATED
// broadcast re-fetches the topic and hands us a fresh array even when nothing
// changed; without this check `setAssets` would install a new reference, churn
// `resolveAssetUri`'s identity, and force IndustryMarkdownSlide to re-render —
// which collapses any live text selection in the preview.
const assetsEqual = (a: TopicAsset[], b: TopicAsset[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id || x.url !== y.url || x.mime !== y.mime || x.data !== y.data) {
      return false;
    }
  }
  return true;
};

// Matches a GFM task-list line: indentation, a list marker (-, *, +, or an
// ordered "1." / "1)"), then the `[ ]` / `[x]` checkbox. Groups 1 and 3 are the
// untouched scaffolding; group 2 is the toggle character we flip.
const CHECKBOX_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

// Mirror of IndustryMarkdownSlide's chunk split (parseMarkdownChunks): the
// slide splits content on fenced ```mermaid blocks and renders each markdown
// segment with its own ReactMarkdown, so the `lineNumber` onCheckboxChange
// reports is 1-based *within that segment*, not the whole document. We replay
// the same split, map the relative line back to an absolute document line, and
// toggle it. The guard (only flip a line that is actually a checkbox in the
// opposite-of-desired state) keeps a stale/misattributed line number from
// corrupting unrelated content — worst case it no-ops.
const toggleCheckboxAtLine = (
  content: string,
  lineNumber: number,
  checked: boolean,
): string | null => {
  if (lineNumber < 1) return null;
  const lines = content.split('\n');

  // 0-based document line index where each rendered markdown segment begins.
  const segmentStarts: number[] = [];
  const mermaidBlock = /^```mermaid\n[\s\S]*?\n^```$/gm;
  const newlinesBefore = (offset: number) =>
    content.slice(0, offset).split('\n').length - 1;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = mermaidBlock.exec(content)) !== null) {
    if (match.index > lastIndex && content.slice(lastIndex, match.index).trim()) {
      segmentStarts.push(newlinesBefore(lastIndex));
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length && content.slice(lastIndex).trim()) {
    segmentStarts.push(newlinesBefore(lastIndex));
  }
  if (segmentStarts.length === 0) segmentStarts.push(0);

  for (const start of segmentStarts) {
    const idx = start + (lineNumber - 1);
    const line = lines[idx];
    if (line === undefined) continue;
    const m = CHECKBOX_LINE.exec(line);
    if (!m) continue;
    const isChecked = m[2] !== ' ';
    if (isChecked === checked) continue; // already in the desired state here
    lines[idx] = line.replace(CHECKBOX_LINE, `$1${checked ? 'x' : ' '}$3`);
    return lines.join('\n');
  }
  return null;
};

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
  const [assets, setAssets] = useState<TopicAsset[]>([]);
  const [status, setStatus] = useState<TopicStatus | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  // The status editor is collapsed by default — the header pill reflects the
  // current state and toggles the full TopicStatusControl form open/closed.
  const [statusOpen, setStatusOpen] = useState(false);
  // Transient banner for a rejected image drop (too large / wrong type / attach
  // failure). Auto-clears so it doesn't linger over the notes.
  const [dropError, setDropError] = useState<string | null>(null);

  // Load the description when opened, and refresh whenever this topic changes
  // while open — so edits made in the MDX tab flow into the preview live.
  useEffect(() => {
    if (!open || !topicId) return;
    let cancelled = false;
    // `initial` is the first open-time fetch; later calls come from the
    // onTopicChange subscription. Only the initial load drives the loading
    // spinner, and every setter below preserves the existing reference when the
    // re-fetched value is unchanged — so a no-op broadcast doesn't re-render the
    // markdown preview and wipe a text selection out from under the user.
    const load = async (initial: boolean) => {
      if (initial) setLoading(true);
      try {
        const topic = await TopicService.getTopic(topicId);
        if (cancelled) return;
        const nextDescription = topic?.description ?? '';
        const nextAssets = topic?.assets ?? [];
        setDescription((prev) => (prev === nextDescription ? prev : nextDescription));
        setAssets((prev) => (assetsEqual(prev, nextAssets) ? prev : nextAssets));
        setStatus((prev) => (prev === topic?.status ? prev : topic?.status));
      } catch (err) {
        console.error('[TopicDescriptionSlideOver] load failed', err);
        if (!cancelled) {
          setDescription('');
          setAssets([]);
          setStatus(undefined);
        }
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };
    load(true);
    const off = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) load(false);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [open, topicId]);

  // Resolve `asset://<id>` references in the markdown to a renderable URL using
  // the topic's inline assets (prefer a hosted `url`, else build a data-URL from
  // the base64 bytes). Other schemes pass through untouched. Handed to
  // IndustryMarkdownSlide's `transformImageUri`.
  const resolveAssetUri = React.useCallback(
    (src: string): string => {
      if (!src.startsWith(ASSET_SCHEME)) return src;
      const id = src.slice(ASSET_SCHEME.length);
      const asset = assets.find((a) => a.id === id);
      if (!asset) return src;
      if (asset.url) return asset.url;
      if (asset.data) return `data:${asset.mime};base64,${asset.data}`;
      return src;
    },
    [assets],
  );

  // Stable handler for "open this mermaid block in a tab". Hoisted out of the
  // JSX so IndustryMarkdownSlide doesn't see a new `onOpenMermaidInTab` prop on
  // every render (which would re-render the markdown and drop a selection).
  const handleOpenMermaidInTab = React.useCallback(
    (code: string, title?: string) =>
      events.emit({
        type: 'mermaid:open-in-tab',
        source: 'topic-notes',
        timestamp: Date.now(),
        payload: { code, title: title ?? '' },
      }),
    [events],
  );

  // Auto-dismiss the drop-error banner a few seconds after it appears.
  useEffect(() => {
    if (!dropError) return;
    const timer = setTimeout(() => setDropError(null), 4000);
    return () => clearTimeout(timer);
  }, [dropError]);

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

  // Inline checkbox toggles. IndustryMarkdownSlide tracks the checked state in
  // its own internal `checkedItems`, which a background TOPIC_UPDATED refresh
  // would discard — so we rewrite the `[ ]`/`[x]` marker in the source markdown
  // and persist through the same sink as inline deletions.
  const handleCheckboxChange = React.useCallback(
    (_slideIndex: number, lineNumber: number, checked: boolean) => {
      setDescription((current) => {
        if (current == null) return current;
        const next = toggleCheckboxAtLine(current, lineNumber, checked);
        if (next == null || next === current) return current;
        if (topicId) {
          void TopicService.updateTopic(topicId, { description: next }).catch(
            (err) => {
              console.error(
                '[TopicDescriptionSlideOver] checkbox update failed',
                err,
              );
            },
          );
        }
        return next;
      });
    },
    [topicId],
  );

  // Screenshots dragged from the OS arrive as `dataTransfer.files`, which
  // useDropZone ignores (it only parses the panel protocol + text/plain). For
  // each image: validate (mime + size cap), hash, and hand to main, which
  // stores the bytes on the topic and appends the `asset://` reference. The
  // TOPIC_UPDATED broadcast then refreshes the preview.
  const handleImageDrop = React.useCallback(
    async (files: File[]) => {
      if (!topicId || files.length === 0) return;
      const prepared = await Promise.all(files.map(prepareImageAsset));
      const firstReject = prepared.find((p) => !p.ok);
      if (firstReject && !firstReject.ok) {
        setDropError(describeRejection(firstReject.reason));
      }
      for (const result of prepared) {
        if (!result.ok) continue;
        try {
          await TopicService.attachImageAsset(topicId, result.asset);
        } catch (err) {
          console.error('[TopicDescriptionSlideOver] image attach failed', err);
          setDropError(
            err instanceof Error ? err.message : 'Could not attach image',
          );
        }
      }
    },
    [topicId],
  );

  const { isDragOver, onDrop: panelOnDrop, ...dropZoneProps } = useDropZone({
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

  // Intercept image-file drops, then always delegate to the hook so it resets
  // its drag-over state and handles panel/text drops. Image drops carry no
  // text/plain payload, so the hook's text fallback no-ops for them.
  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      const images = extractImageFiles(e);
      if (images.length > 0) {
        void handleImageDrop(images);
      }
      panelOnDrop(e);
    },
    [handleImageDrop, panelOnDrop],
  );

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
        <Brain size={14} color={theme.colors.textSecondary} />
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
          Braindump
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
        onDrop={handleDrop}
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
        {dropError && (
          <div
            role="alert"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              padding: '8px 12px',
              background: theme.colors.error || '#ef4444',
              color: '#ffffff',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
            }}
          >
            {dropError}
          </div>
        )}
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
            Drop text or an image to add to notes
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
            onOpenMermaidInTab={handleOpenMermaidInTab}
            selectableBlocks
            deletionMode="text"
            onContentChange={handleContentChange}
            editable
            onCheckboxChange={handleCheckboxChange}
            transformImageUri={resolveAssetUri}
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
