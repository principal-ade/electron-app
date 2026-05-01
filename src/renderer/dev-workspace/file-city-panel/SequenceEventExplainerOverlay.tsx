import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';

import type { FileCitySequenceEventDef } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';

export interface SequenceEventExplainerOverlayProps {
  event: FileCitySequenceEventDef;
  /** Bottom inset (number → px, string → CSS) so the panel sits above the sequence drawer. */
  bottomOffset: number | string;
}

const PANEL_WIDTH_PCT = 28;
const FLOAT_INSET = 16;
const MIN_WIDTH_PX = 280;

export const SequenceEventExplainerOverlay: React.FC<
  SequenceEventExplainerOverlayProps
> = ({ event, bottomOffset }) => {
  const { theme } = useTheme();
  const description = event.description?.trim() ?? '';

  const bottomOffsetCss =
    typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset;

  const [hasEntered, setHasEntered] = React.useState(false);

  if (!description) return null;

  return (
    <div
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
        width: `calc(${PANEL_WIDTH_PCT}% - ${FLOAT_INSET}px)`,
        minWidth: MIN_WIDTH_PX,
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1900,
        animation: hasEntered
          ? undefined
          : 'sequenceExplainerSlideIn 220ms ease-out',
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
          Change notes
        </span>
        <span
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={event.label ?? event.name}
        >
          {event.label ?? event.name}
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
            content={description}
            slideIdPrefix={`sequence-explainer-${event.id}`}
            slideIndex={0}
            isVisible
            theme={theme}
            transparentBackground
            enableKeyboardScrolling={false}
          />
        </div>
      </div>
    </div>
  );
};
