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

export const FileOverlay: React.FC<FileOverlayProps> = ({
  filePath,
  fileName,
  onClose,
  onOpenInTab,
}) => {
  const { theme } = useTheme();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '50%',
        backgroundColor: `color-mix(in srgb, ${theme.colors.background} 88%, transparent)`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderLeft: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        animation: 'fileCityOverlaySlideIn 220ms ease-out',
      }}
    >
      <style>{`
        @keyframes fileCityOverlaySlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
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
          transparent
        />
      </div>
    </div>
  );
};
