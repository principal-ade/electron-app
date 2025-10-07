import React, { useState } from 'react';
import { FileText, Presentation } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { MarkdownDocumentViewer } from '../shared/MarkdownDocumentViewer';
import { PanelEmptyState } from './PanelEmptyState';

interface MarkdownViewerPanelProps {
  // Document data
  docPath: string | null;
  docContent: string | null;

  // Loading state
  loading?: boolean;

  // Close handler
  onClose?: () => void;
}

export const MarkdownViewerPanel: React.FC<MarkdownViewerPanelProps> = ({
  docPath,
  docContent,
  loading = false,
  onClose,
}) => {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<'document' | 'slides'>('slides');
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!docPath || !docContent) {
    return (
      <PanelEmptyState
        icon={FileText}
        title="No document selected"
        description="Select a markdown file to view it here"
      />
    );
  }

  const slides = docContent.split('\n\n---\n\n');
  const hasSlides = slides.length > 1;

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
      {/* Header with view mode toggle */}
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
          {viewMode === 'slides' ? (
            <Presentation size={16} color={theme.colors.primary} />
          ) : (
            <FileText size={16} color={theme.colors.primary} />
          )}
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
              {viewMode === 'slides'
                ? `Slide ${currentSlide + 1} of ${slides.length}`
                : docPath}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View mode toggle - only show if document has slides */}
          {hasSlides && (
            <div
              style={{
                display: 'flex',
                backgroundColor: theme.colors.background,
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  setViewMode('document');
                  setCurrentSlide(0);
                }}
                style={{
                  background: viewMode === 'document' ? theme.colors.primary : 'transparent',
                  color: viewMode === 'document' ? theme.colors.background : theme.colors.textSecondary,
                  border: 'none',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                Document
              </button>
              <button
                onClick={() => {
                  setViewMode('slides');
                  setCurrentSlide(0);
                }}
                style={{
                  background: viewMode === 'slides' ? theme.colors.primary : 'transparent',
                  color: viewMode === 'slides' ? theme.colors.background : theme.colors.textSecondary,
                  border: 'none',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                Slides
              </button>
            </div>
          )}

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
      </div>

      {/* Content */}
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
            Loading document...
          </div>
        ) : (
          <MarkdownDocumentViewer
            viewMode={viewMode}
            showEditor={false}
            content={docContent}
            slides={slides}
            currentSlide={currentSlide}
            theme={theme}
            showSegmented={true}
            onContentChange={() => {}}
            onSlideNavigate={setCurrentSlide}
            onCheckboxChange={() => {}}
          />
        )}
      </div>
    </div>
  );
};
