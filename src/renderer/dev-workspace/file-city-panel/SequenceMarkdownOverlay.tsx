import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  IndustryMarkdownSlide,
  type Annotation,
  type AnnotationSelection,
} from 'themed-markdown';

import { MarkdownSelectionPill } from './MarkdownNotes';

export interface SequenceMarkdownOverlayProps {
  /** Small caps label shown above the title (e.g. "Overview", "Change notes"). */
  eyebrow: string;
  /** Bold heading shown under the eyebrow. */
  title: string;
  /** Markdown body. The overlay short-circuits to `null` when this is empty. */
  markdown: string;
  /** Stable prefix used by `IndustryMarkdownSlide` for slide ids. */
  slideIdPrefix: string;
  /** Bottom inset (number → px, string → CSS) so the panel sits above the sequence drawer. */
  bottomOffset: number | string;
  /** Position of the current event in the sequence; renders an "n / total" pill. */
  position?: { index: number; total: number };
  /** Called when the user clicks the previous-event chevron. Omit to disable. */
  onPrev?: () => void;
  /** Called when the user clicks the next-event chevron. Omit to disable. */
  onNext?: () => void;

  /** Inline annotations to render on the markdown body (highlights + badges). */
  annotations?: Annotation[];
  /** id of the annotation whose notes panel is currently open. */
  activeAnnotationId?: string | null;
  /** Click on a highlight → toggle its notes panel. */
  onAnnotationClick?: (annotationId: string) => void;
  /** Click the floating "Add note" pill on a fresh selection. */
  onCreateNoteForSelection?: (anchor: {
    exact: string;
    prefix?: string;
    suffix?: string;
  }) => void;
  /**
   * While a composer is in progress the floating pill is suppressed — the
   * selection highlight is owned by a draft annotation in `annotations`.
   */
  composerOpen?: boolean;
  /** Forward a ref to the panel container so siblings can position relative to it. */
  containerRef?: React.MutableRefObject<HTMLDivElement | null>;
}

const PANEL_WIDTH_PCT = 28;
const FLOAT_INSET = 16;
// Clears the FileCityExplorer focus bar (canvas mounts at top: 56) plus a
// small gap so the overlay reads as "below the top chrome".
const TOP_INSET = 72;
const MIN_WIDTH_PX = 280;
const RESIZE_HANDLE_WIDTH = 6;

export const SequenceMarkdownOverlay: React.FC<SequenceMarkdownOverlayProps> = ({
  eyebrow,
  title,
  markdown,
  slideIdPrefix,
  bottomOffset,
  position,
  onPrev,
  onNext,
  annotations,
  activeAnnotationId,
  onAnnotationClick,
  onCreateNoteForSelection,
  composerOpen,
  containerRef: externalContainerRef,
}) => {
  const { theme } = useTheme();
  const body = markdown.trim();

  React.useEffect(() => {
    // Alt+arrow mirrors browser back/forward semantics — plain arrow keys are
    // reserved for the snippet pane's own scrolling.
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.altKey && e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext]);

  const bottomOffsetCss =
    typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset;

  const [hasEntered, setHasEntered] = React.useState(false);
  // Drag-resize: null = use the responsive default (`PANEL_WIDTH_PCT`% min
  // `MIN_WIDTH_PX`); a number = explicit px override set by the user.
  const [widthPx, setWidthPx] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const setContainerRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (externalContainerRef) externalContainerRef.current = node;
    },
    [externalContainerRef],
  );
  const dragStateRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

  // Last non-null selection inside the markdown body. The floating pill
  // anchors to its rect; clicking the pill bubbles the anchor up.
  const [pendingSelection, setPendingSelection] =
    React.useState<AnnotationSelection | null>(null);
  const handleSelectionChange = React.useCallback(
    (selection: AnnotationSelection | null) => {
      setPendingSelection(selection);
    },
    [],
  );
  // themed-markdown is React.memo'd; pass a stable click handler so the
  // slide doesn't re-mount on parent state churn.
  const handleAnnotationClick = React.useCallback(
    (annotationId: string) => {
      onAnnotationClick?.(annotationId);
    },
    [onAnnotationClick],
  );

  // themed-markdown's default amber is too subtle on dark backgrounds — pin
  // the highlight to the theme's primary color so it matches the snippet
  // pill aesthetic and is unambiguously visible.
  const annotationStyleVars = React.useMemo(
    () => ({
      backgroundColor: `color-mix(in srgb, ${theme.colors.primary} 22%, transparent)`,
      activeBackgroundColor: `color-mix(in srgb, ${theme.colors.primary} 45%, transparent)`,
    }),
    [theme.colors.primary],
  );

  const handleResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Left button only.
      if (e.button !== 0) return;
      const el = containerRef.current;
      if (!el) return;
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startWidth: el.getBoundingClientRect().width,
      };
      setIsResizing(true);
      // Capture so we keep getting move/up even if the cursor strays off the
      // 6px handle while dragging.
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleResizePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const parent = containerRef.current?.parentElement;
      const parentWidth = parent?.clientWidth ?? window.innerWidth;
      // Cap so we never push past the panel's right edge minus the inset.
      const maxWidth = Math.max(MIN_WIDTH_PX, parentWidth - FLOAT_INSET * 2);
      const dx = e.clientX - drag.startX;
      const next = Math.min(maxWidth, Math.max(MIN_WIDTH_PX, drag.startWidth + dx));
      setWidthPx(next);
    },
    [],
  );

  const handleResizePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      setIsResizing(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  if (!body) return null;

  return (
    <div
      ref={setContainerRef}
      onAnimationEnd={() => setHasEntered(true)}
      style={{
        position: 'absolute',
        top: TOP_INSET,
        left: FLOAT_INSET,
        // Anchor the bottom edge too so the column has a *definite* height —
        // `IndustryMarkdownSlide` renders with `height: 100%` and only
        // engages its internal scroll when the chain of ancestors hands it a
        // resolvable pixel height. A `maxHeight`-only cap on a content-sized
        // flex column doesn't qualify across browsers.
        bottom: `calc(${bottomOffsetCss} + ${FLOAT_INSET}px)`,
        width:
          widthPx != null
            ? widthPx
            : `calc(${PANEL_WIDTH_PCT}% - ${FLOAT_INSET}px)`,
        minWidth: MIN_WIDTH_PX,
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1900,
        // Suppress the entry slide-in once a drag is in progress; otherwise
        // an in-flight animation can fight the width updates visually.
        animation:
          hasEntered || isResizing
            ? undefined
            : 'sequenceExplainerSlideIn 220ms ease-out',
        userSelect: isResizing ? 'none' : undefined,
      }}
    >
      <style>{`
        @keyframes sequenceExplainerSlideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .sequence-md-nav-btn {
          transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
        }
        .sequence-md-nav-btn:not(:disabled):hover {
          background-color: ${theme.colors.border};
          color: ${theme.colors.text};
        }
        .sequence-md-nav-btn:not(:disabled):active {
          background-color: color-mix(in srgb, ${theme.colors.primary} 18%, transparent);
          border-color: ${theme.colors.primary};
        }
        .sequence-md-start-btn {
          transition: background-color 120ms ease, transform 80ms ease;
        }
        .sequence-md-start-btn:hover {
          background-color: color-mix(in srgb, ${theme.colors.primary} 88%, white);
        }
        .sequence-md-start-btn:active {
          transform: translateY(1px);
        }
      `}</style>

      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={title}
        >
          {title}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* IndustryMarkdownSlide renders with `height: 100%` and runs its own
         * `overflow-y: auto`. For its `height: 100%` to resolve, the parent
         * needs a *definite* height — `flex: 1` alone doesn't always count
         * across flex contexts. Anchoring this inner box with `position:
         * absolute; inset: 0` gives the slide a concrete height, which lets
         * its internal scroll container engage. */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <IndustryMarkdownSlide
            content={body}
            slideIdPrefix={slideIdPrefix}
            slideIndex={0}
            isVisible
            theme={theme}
            transparentBackground
            enableKeyboardScrolling={false}
            annotations={annotations}
            activeAnnotationId={activeAnnotationId ?? null}
            onAnnotationClick={
              onAnnotationClick ? handleAnnotationClick : undefined
            }
            onSelectionChange={
              onCreateNoteForSelection ? handleSelectionChange : undefined
            }
            annotationStyle={annotationStyleVars}
          />
        </div>
        {!composerOpen && pendingSelection && onCreateNoteForSelection && (
          <MarkdownSelectionPill
            rect={{
              left: pendingSelection.rect.left,
              top: pendingSelection.rect.top,
              right: pendingSelection.rect.right,
              bottom: pendingSelection.rect.bottom,
            }}
            onClick={() => {
              onCreateNoteForSelection(pendingSelection.anchor);
              setPendingSelection(null);
            }}
          />
        )}
      </div>

      {position && position.index === 0 && onNext ? (
        <div
          style={{
            padding: '8px 14px',
            borderTop: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onNext}
            title="Start sequence (Alt+→)"
            className="sequence-md-start-btn"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              fontWeight: 600,
            }}
          >
            Start
          </button>
        </div>
      ) : (
        (onPrev || onNext || position) && (
          <div
            style={{
              padding: '8px 14px',
              borderTop: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'stretch',
              gap: 0,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label="Previous event"
              title="Previous event (Alt+←)"
              className="sequence-md-nav-btn"
              style={navButtonStyle(theme, !onPrev, 'left')}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              style={{
                flex: '0 0 30%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              {position ? `${position.index} / ${position.total}` : ''}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              aria-label="Next event"
              title="Next event (Alt+→)"
              className="sequence-md-nav-btn"
              style={navButtonStyle(theme, !onNext, 'right')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )
      )}

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize markdown panel"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: RESIZE_HANDLE_WIDTH,
          cursor: 'ew-resize',
          // Subtle painted line on hover/drag so users discover it without
          // bias-distracting the rest of the time.
          backgroundColor: isResizing ? theme.colors.accent : 'transparent',
          transition: isResizing ? undefined : 'background-color 120ms ease',
          touchAction: 'none',
        }}
        onMouseEnter={(e) => {
          if (isResizing) return;
          e.currentTarget.style.backgroundColor = theme.colors.border;
        }}
        onMouseLeave={(e) => {
          if (isResizing) return;
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />
    </div>
  );
};

const navButtonStyle = (
  theme: ReturnType<typeof useTheme>['theme'],
  disabled: boolean,
  _side: 'left' | 'right',
): React.CSSProperties => ({
  flex: '0 0 35%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 6,
  color: disabled ? theme.colors.border : theme.colors.textSecondary,
  cursor: disabled ? 'default' : 'pointer',
  padding: '6px 0',
  opacity: disabled ? 0.5 : 1,
});
