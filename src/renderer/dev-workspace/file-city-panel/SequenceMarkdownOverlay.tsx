import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';

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
}

const PANEL_WIDTH_PCT = 28;
const FLOAT_INSET = 16;
const MIN_WIDTH_PX = 280;
const RESIZE_HANDLE_WIDTH = 6;

export const SequenceMarkdownOverlay: React.FC<SequenceMarkdownOverlayProps> = ({
  eyebrow,
  title,
  markdown,
  slideIdPrefix,
  bottomOffset,
}) => {
  const { theme } = useTheme();
  const body = markdown.trim();

  const bottomOffsetCss =
    typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset;

  const [hasEntered, setHasEntered] = React.useState(false);
  // Drag-resize: null = use the responsive default (`PANEL_WIDTH_PCT`% min
  // `MIN_WIDTH_PX`); a number = explicit px override set by the user.
  const [widthPx, setWidthPx] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

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
      ref={containerRef}
      onAnimationEnd={() => setHasEntered(true)}
      style={{
        position: 'absolute',
        top: FLOAT_INSET,
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
          />
        </div>
      </div>

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
