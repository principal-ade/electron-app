import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';

import { PierreFileView } from './PierreFileView';

export interface FileOverlayProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
  onOpenInTab?: () => void;
}

const MIN_WIDTH_PX = 320;
const MIN_LEFT_GAP_PX = 80;
const RESIZE_HANDLE_WIDTH = 6;

export const FileOverlay: React.FC<FileOverlayProps> = ({
  filePath,
  fileName,
  onClose,
  onOpenInTab,
}) => {
  const { theme } = useTheme();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [widthPx, setWidthPx] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const [hasEntered, setHasEntered] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      const next = Math.max(
        MIN_WIDTH_PX,
        Math.min(parentRect.width - MIN_LEFT_GAP_PX, parentRect.right - ev.clientX),
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
        top: 0,
        right: 0,
        bottom: 0,
        width: widthPx != null ? `${widthPx}px` : '50%',
        backgroundColor: theme.colors.background,
        borderLeft: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        animation: hasEntered
          ? undefined
          : 'fileCityOverlaySlideIn 220ms ease-out',
        userSelect: isResizing ? 'none' : undefined,
      }}
    >
      <style>{`
        @keyframes fileCityOverlaySlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize file overlay"
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
          alignItems: 'center',
          justifyContent: 'space-between',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: theme.fonts.monospace,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={filePath}
        >
          {fileName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onOpenInTab && (
            <button
              type="button"
              onClick={onOpenInTab}
              aria-label="Open in tab"
              title="Open in tab"
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                lineHeight: 0,
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: theme.fontSizes[3],
              lineHeight: 1,
              padding: '2px 8px',
            }}
          >
            ×
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <PierreFileView
          filePath={filePath}
          fileName={fileName}
          background={theme.colors.background}
        />
      </div>
    </div>
  );
};
