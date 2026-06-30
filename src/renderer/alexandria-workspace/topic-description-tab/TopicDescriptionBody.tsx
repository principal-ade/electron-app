/**
 * TopicDescriptionBody
 *
 * The reusable core of the topic-description preview: it fetches a local topic
 * by id (`TopicService.getTopic`), renders its markdown description via
 * `IndustryMarkdownSlide`, and supports the lightweight inline edits the
 * preview offers (text deletion, checkbox toggles, drag-to-append text, and
 * dragged-in image assets). It live-refreshes via `TopicService.onTopicChange`.
 *
 * This is the chrome-less body shared by:
 * - `TopicDescriptionSlideOver` (the Alexandria workspace "Braindump" slide-over,
 *   which wraps this in its absolute-positioned panel + header + Edit button), and
 * - `LocalTopicTabContent` (the Topics view tab, which wraps it in a title header).
 *
 * Renders a scrollable, full-height drop-zone (so a parent flex column should
 * give it `flex: 1`), plus the markdown link-resolution notice.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { ArrowDownToLine, Pencil, X } from 'lucide-react';
import {
  DATA_TYPES,
  useDropZone,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { TopicAsset } from '@principal-ai/principal-view-core';
import { TopicService } from '../../main-process-api/TopicService';
import {
  describeRejection,
  extractImageFiles,
  prepareImageAsset,
} from './topicImageDrop';
import { useMarkdownLinkHandler } from '../../hooks/useMarkdownLinkHandler';
import { useWorkspaceFileIndex } from '../../hooks/useWorkspaceFileIndex';
import { useRepoPurlResolver } from '../../hooks/useRepoPurlResolver';

/**
 * Extra URI scheme to keep on link hrefs through markdown sanitize, so
 * purl-qualified doc links (`pkg:type/owner/repo#path`) reach the click handler
 * instead of having their href stripped. Module-level for a stable identity.
 */
const PURL_LINK_PROTOCOLS = ['pkg'];
import { MarkdownLinkNotice } from '../../components/MarkdownLinkNotice';

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
    if (
      x.id !== y.id ||
      x.url !== y.url ||
      x.mime !== y.mime ||
      x.data !== y.data
    ) {
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
    if (
      match.index > lastIndex &&
      content.slice(lastIndex, match.index).trim()
    ) {
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

// One entry in the description's table of contents, read straight off a
// rendered heading element. `id` is rehype-slug's anchor id (so clicking it can
// scrollIntoView the real node), `level` is the heading depth (1–6) used to
// indent the outline.
interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export interface TopicDescriptionBodyProps {
  /** Topic whose description is shown. The body no-ops without one. */
  topicId?: string;
  /**
   * Gates the open-time fetch and `IndustryMarkdownSlide`'s `isVisible`. The
   * slide-over passes its `open` flag; a tab that's always mounted passes true.
   * Defaults to true.
   */
  visible?: boolean;
  /** Event bus — used to open clicked doc links / mermaid blocks as tabs. */
  events: PanelEventEmitter;
  /**
   * Workspace whose member repositories doc links resolve against. Topic notes
   * span projects and usually have no single "current repo", so links are
   * matched against the file trees of every repo in this workspace. Safe to
   * omit (e.g. the Topics view tab) — links then open optimistically.
   */
  workspaceId?: string;
  /**
   * Fallback repo for resolving links before the workspace file index has
   * loaded (the currently selected repo, when there is one).
   */
  repositoryPath?: string;
  /**
   * Optional edit affordance. When provided, the empty state shows an "Add a
   * description" button that calls it. The Topics view tab omits it (there's no
   * MDX editor to open there), so the empty state is text-only.
   */
  onEdit?: () => void;
  /** Source tag for the link/mermaid handlers. Defaults to `topic-notes`. */
  linkSource?: string;
  /**
   * Controlled open-state for the table-of-contents overlay. A wrapper (e.g. the
   * Braindump slide-over) owns the toggle button and renders the panel here,
   * since only this body has the live heading DOM to outline. Omit to keep the
   * TOC hidden.
   */
  tocOpen?: boolean;
  /** Close the TOC overlay — called when a heading is clicked or the panel's X. */
  onCloseToc?: () => void;
  /**
   * Reports whether the current description has any headings, so a wrapper can
   * show/enable its "Contents" button only when there's an outline to jump to.
   */
  onTocAvailableChange?: (available: boolean) => void;
}

export const TopicDescriptionBody: React.FC<TopicDescriptionBodyProps> = ({
  topicId,
  visible = true,
  events,
  workspaceId,
  repositoryPath,
  onEdit,
  linkSource = 'topic-notes',
  tocOpen = false,
  onCloseToc,
  onTocAvailableChange,
}) => {
  const { theme } = useTheme();
  const { resolve } = useWorkspaceFileIndex(workspaceId);
  const { resolvePurl } = useRepoPurlResolver();
  const { onLinkClick, notice, dismissNotice, openCandidate } =
    useMarkdownLinkHandler({
      events,
      resolve,
      resolvePurl,
      repositoryPath,
      source: linkSource,
    });
  const [description, setDescription] = useState<string | null>(null);
  // Latest description, readable synchronously from event handlers. Checkbox
  // toggles need the current markdown to rewrite a `[ ]`/`[x]` marker, and may
  // fire several times before a re-render flushes `description` — the ref keeps
  // each toggle building on the previous one rather than a stale render value.
  const descriptionRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    descriptionRef.current = description;
  }, [description]);
  const [assets, setAssets] = useState<TopicAsset[]>([]);
  const [loading, setLoading] = useState(false);
  // Only surface the "Loading…" placeholder once a load has been running long
  // enough to be worth acknowledging. The topic is a fast local file read that
  // usually resolves in a few ms, so binding the placeholder straight to
  // `loading` flashes "Loading…" for a single frame — more jarring than showing
  // nothing. Delaying reveal means fast loads (the common case) never flash.
  const [showLoadingDelay, setShowLoadingDelay] = useState(false);
  // Transient banner for a rejected image drop (too large / wrong type / attach
  // failure). Auto-clears so it doesn't linger over the notes.
  const [dropError, setDropError] = useState<string | null>(null);

  // Load the description when visible, and refresh whenever this topic changes
  // while visible — so edits made elsewhere flow into the preview live.
  useEffect(() => {
    if (!visible || !topicId) return;
    let cancelled = false;
    // `initial` is the first visible-time fetch; later calls come from the
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
        setDescription((prev) =>
          prev === nextDescription ? prev : nextDescription,
        );
        setAssets((prev) =>
          assetsEqual(prev, nextAssets) ? prev : nextAssets,
        );
      } catch (err) {
        console.error('[TopicDescriptionBody] load failed', err);
        if (!cancelled) {
          setDescription('');
          setAssets([]);
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
  }, [visible, topicId]);

  // Reveal the loading placeholder only if `loading` stays true past a short
  // grace period; a load that finishes first clears the timer and nothing
  // flashes. Resetting to false the moment loading clears keeps a later refresh
  // from inheriting a stale "show" flag.
  useEffect(() => {
    if (!loading) {
      setShowLoadingDelay(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingDelay(true), 200);
    return () => clearTimeout(timer);
  }, [loading]);

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
        source: linkSource,
        timestamp: Date.now(),
        payload: { code, title: title ?? '' },
      }),
    [events, linkSource],
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
        console.error('[TopicDescriptionBody] append failed', err);
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
            '[TopicDescriptionBody] description update failed',
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
      const current = descriptionRef.current;
      if (current == null || !topicId) return;
      const next = toggleCheckboxAtLine(current, lineNumber, checked);
      if (next == null || next === current) return;
      descriptionRef.current = next;
      setDescription(next);
      void TopicService.updateTopic(topicId, { description: next }).catch(
        (err) => {
          console.error('[TopicDescriptionBody] checkbox update failed', err);
        },
      );
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
          console.error('[TopicDescriptionBody] image attach failed', err);
          setDropError(
            err instanceof Error ? err.message : 'Could not attach image',
          );
        }
      }
    },
    [topicId],
  );

  const {
    isDragOver,
    onDrop: panelOnDrop,
    ...dropZoneProps
  } = useDropZone({
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

  // The scrollable description region. We read rendered headings out of it to
  // build the outline and to scrollIntoView a clicked entry.
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);

  // Build the outline from the rendered heading nodes (rather than re-parsing
  // the markdown) so each entry's id is exactly rehype-slug's anchor id — that's
  // what lets a click scrollIntoView the real node. Recompute a frame after the
  // markdown (re)paints; keep the same array reference when nothing changed so
  // the availability effect below doesn't churn.
  React.useEffect(() => {
    if (!visible) return;
    const root = wrapperRef.current;
    if (!root) return;
    const raf = requestAnimationFrame(() => {
      const nodes = root.querySelectorAll<HTMLElement>(
        '.markdown-slide :is(h1, h2, h3, h4, h5, h6)[id]',
      );
      const next: TocEntry[] = [];
      nodes.forEach((node) => {
        const text = (node.textContent ?? '').trim();
        if (text) {
          next.push({ id: node.id, text, level: Number(node.tagName[1]) });
        }
      });
      setToc((prev) =>
        prev.length === next.length &&
        prev.every((p, i) => p.id === next[i].id && p.text === next[i].text)
          ? prev
          : next,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [description, visible]);

  // Let a wrapper show/enable its "Contents" button only when there's an
  // outline. Parents should pass a stable callback so this fires only on change.
  React.useEffect(() => {
    onTocAvailableChange?.(toc.length > 0);
  }, [toc.length, onTocAvailableChange]);

  const scrollToHeading = React.useCallback(
    (id: string) => {
      const root = wrapperRef.current;
      // CSS.escape: slug ids can contain characters that need escaping in a
      // selector (digits-first, punctuation from non-ASCII headings, etc.).
      const target = root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onCloseToc?.();
    },
    [onCloseToc],
  );

  const trimmed = (description ?? '').trim();

  return (
    <>
      <div
        {...dropZoneProps}
        ref={wrapperRef}
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
        {toc.length > 0 && (
          <nav
            aria-label="Table of contents"
            aria-hidden={!tocOpen}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '100%',
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              background: theme.colors.background,
              borderRight: `1px solid ${theme.colors.border}`,
              boxShadow: tocOpen ? '4px 0 16px rgba(0,0,0,0.25)' : 'none',
              transform: tocOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.2s ease',
              pointerEvents: tocOpen ? 'auto' : 'none',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 8px 8px 12px',
                borderBottom: `1px solid ${theme.colors.border}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: theme.fontSizes[0],
                  fontWeight: theme.fontWeights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: theme.colors.textSecondary,
                }}
              >
                Contents
              </span>
              <button
                type="button"
                onClick={onCloseToc}
                title="Close"
                aria-label="Close table of contents"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 0' }}>
              {toc.map((entry) => (
                <button
                  key={`${entry.level}:${entry.id}:${entry.text}`}
                  type="button"
                  onClick={() => scrollToHeading(entry.id)}
                  title={entry.text}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color:
                      entry.level <= 1
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    fontWeight:
                      entry.level <= 1
                        ? theme.fontWeights.medium
                        : theme.fontWeights.body,
                    padding: '6px 16px',
                    paddingLeft: 16 + (entry.level - 1) * 14,
                    lineHeight: theme.lineHeights.body,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      theme.colors.backgroundSecondary;
                    e.currentTarget.style.color = theme.colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color =
                      entry.level <= 1
                        ? theme.colors.text
                        : theme.colors.textSecondary;
                  }}
                >
                  {entry.text}
                </button>
              ))}
            </div>
          </nav>
        )}
        {showLoadingDelay && description === null ? (
          <div
            style={{
              padding: '12px 16px',
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            Loading…
          </div>
        ) : description === null ? (
          // Load in flight but still inside the grace period — render nothing
          // rather than briefly flashing the "no description yet" empty state
          // before the real content arrives.
          null
        ) : trimmed ? (
          <IndustryMarkdownSlide
            content={description as string}
            slideIdPrefix="topic-description"
            slideIndex={0}
            isVisible={visible}
            theme={theme}
            enableKeyboardScrolling={false}
            onLinkClick={onLinkClick}
            // Let purl doc links (`pkg:…#path`) survive href sanitize so they
            // reach onLinkClick / the purl resolver instead of being stripped.
            allowedLinkProtocols={PURL_LINK_PROTOCOLS}
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
            {onEdit && (
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
            )}
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
    </>
  );
};

export default TopicDescriptionBody;
