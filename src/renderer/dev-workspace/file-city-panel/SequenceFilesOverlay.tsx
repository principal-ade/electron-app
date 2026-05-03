import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';

export interface SequenceStep {
  /** Stable id of the underlying sequence event. */
  eventId: string;
  /** 1-based index of the event in the sequence. */
  stepIndex: number;
  /** Display label for the event (label, falling back to name). */
  eventLabel: string;
  /** Path as it appears in the sequence payload (relative to the repo root). */
  relativePath: string;
  /** Resolved absolute path; null when it can't be resolved (no repo path). */
  absolutePath: string | null;
}

export interface SequenceFilesOverlayProps {
  steps: SequenceStep[];
  /** Total event count, including events without a sourcePath. */
  totalEvents: number;
  /** Bottom inset (number → px, string → CSS) so the panel sits above the sequence drawer. */
  bottomOffset: number | string;
  /** Click on a step row → focuses that event in the sequence. */
  onSelectStep: (step: SequenceStep) => void;
  /** Open-in-tab button on a step row → opens the file without changing selection. */
  onOpenFile: (step: SequenceStep) => void;
}

const PANEL_WIDTH_PCT = 38;
const FLOAT_INSET = 16;
const MIN_WIDTH_PX = 360;
const MIN_LEFT_GAP_PX = 80;
const RESIZE_HANDLE_WIDTH = 6;

export const SequenceFilesOverlay: React.FC<SequenceFilesOverlayProps> = ({
  steps,
  totalEvents,
  bottomOffset,
  onSelectStep,
  onOpenFile,
}) => {
  const { theme } = useTheme();

  const bottomOffsetCss =
    typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [widthPx, setWidthPx] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const [hasEntered, setHasEntered] = React.useState(false);

  const onResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      const next = Math.max(
        MIN_WIDTH_PX,
        Math.min(
          parentRect.width - MIN_LEFT_GAP_PX - FLOAT_INSET,
          parentRect.right - FLOAT_INSET - ev.clientX,
        ),
      );
      setWidthPx(next);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={containerRef}
      onAnimationEnd={() => setHasEntered(true)}
      style={{
        position: 'absolute',
        top: FLOAT_INSET,
        right: FLOAT_INSET,
        bottom: `calc(${bottomOffsetCss} + ${FLOAT_INSET}px)`,
        width:
          widthPx != null
            ? `${widthPx}px`
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
        animation: hasEntered
          ? undefined
          : 'sequenceFilesSlideIn 220ms ease-out',
        userSelect: isResizing ? 'none' : undefined,
      }}
    >
      <style>{`
        @keyframes sequenceFilesSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .sequence-files-row {
          transition: background-color 120ms ease;
        }
        .sequence-files-row:not(:disabled):hover {
          background-color: ${theme.colors.border};
        }
        .sequence-files-open-btn {
          transition: background-color 120ms ease, color 120ms ease;
        }
        .sequence-files-open-btn:hover {
          background-color: color-mix(in srgb, ${theme.colors.primary} 25%, transparent);
          color: ${theme.colors.text};
        }
      `}</style>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sequence files overlay"
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -RESIZE_HANDLE_WIDTH / 2,
          width: RESIZE_HANDLE_WIDTH,
          cursor: 'col-resize',
          zIndex: 1,
          background: isResizing
            ? `color-mix(in srgb, ${theme.colors.primary} 40%, transparent)`
            : 'transparent',
        }}
      />

      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          flexShrink: 0,
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
          Steps in sequence
        </span>
        <span
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
          }}
        >
          {steps.length} of {totalEvents}{' '}
          {totalEvents === 1 ? 'step' : 'steps'} touch a file
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {steps.length === 0 ? (
          <div
            style={{
              padding: 16,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
            }}
          >
            No files referenced by this sequence.
          </div>
        ) : (
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {steps.map((step) => {
              const fileName =
                step.relativePath.split('/').pop() ?? step.relativePath;
              const dirPath = step.relativePath.includes('/')
                ? step.relativePath.slice(0, -fileName.length - 1)
                : '';
              const canOpen = !!step.absolutePath;
              return (
                <li
                  key={`${step.eventId}-${step.stepIndex}`}
                  style={{ borderBottom: `1px solid ${theme.colors.border}` }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                    }}
                  >
                    <button
                      type="button"
                      className="sequence-files-row"
                      onClick={() => onSelectStep(step)}
                      title={`Step ${step.stepIndex}: ${step.eventLabel}`}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          minWidth: 22,
                          height: 22,
                          padding: '0 6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 11,
                          backgroundColor: theme.colors.border,
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.monospace,
                          fontSize: theme.fontSizes[0],
                        }}
                      >
                        {step.stepIndex}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: theme.fontSizes[1],
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {step.eventLabel}
                        </div>
                        <div
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                            fontFamily: theme.fonts.monospace,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dirPath ? `${dirPath}/` : ''}
                          <span style={{ color: theme.colors.text }}>
                            {fileName}
                          </span>
                        </div>
                      </div>
                    </button>
                    {canOpen && (
                      <button
                        type="button"
                        className="sequence-files-open-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFile(step);
                        }}
                        aria-label={`Open ${step.relativePath} in a tab`}
                        title="Open in tab"
                        style={{
                          flexShrink: 0,
                          background: 'transparent',
                          border: 'none',
                          borderLeft: `1px solid ${theme.colors.border}`,
                          padding: '0 12px',
                          color: theme.colors.textSecondary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
