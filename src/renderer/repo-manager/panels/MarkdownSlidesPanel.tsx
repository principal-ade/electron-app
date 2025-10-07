import React from 'react';
import { Presentation } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { MarkdownDocumentViewer } from '../shared/MarkdownDocumentViewer';
import { PanelEmptyState } from './PanelEmptyState';

interface MarkdownSlidesPanelProps {
  // Document data
  docPath: string | null;
  docContent: string | null;

  // Slide navigation
  currentSlide?: number;
  onSlideNavigate?: (slide: number) => void;

  // Loading state
  loading?: boolean;

  // Close handler
  onClose?: () => void;
}

export const MarkdownSlidesPanel: React.FC<MarkdownSlidesPanelProps> = ({
  docPath,
  docContent,
  currentSlide = 0,
  onSlideNavigate,
  loading = false,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!docPath || !docContent) {
    return (
      <PanelEmptyState
        icon={Presentation}
        title="No slides selected"
        description="Select a markdown file and switch to slides mode to view it here"
      />
    );
  }

  const slides = docContent.split('\n\n---\n\n');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Slides header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Presentation size={16} color={theme.colors.primary} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              {docPath.split('/').pop()}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}
            >
              Slide {currentSlide + 1} of {slides.length}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: theme.colors.textSecondary,
              borderRadius: '4px',
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Slides content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            Loading slides...
          </div>
        ) : (
          <MarkdownDocumentViewer
            viewMode="slides"
            showEditor={false}
            content={docContent}
            slides={slides}
            currentSlide={currentSlide}
            theme={theme}
            showSegmented={true}
            onContentChange={() => {}}
            onSlideNavigate={onSlideNavigate || (() => {})}
            onCheckboxChange={() => {}}
          />
        )}
      </div>
    </div>
  );
};
