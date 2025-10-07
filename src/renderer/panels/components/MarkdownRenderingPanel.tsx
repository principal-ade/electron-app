import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Presentation } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { MarkdownDocumentViewer } from '../../repo-manager/shared/MarkdownDocumentViewer';
import { PanelEmptyState } from '../../repo-manager/panels/PanelEmptyState';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import type { FileTreeSource } from '../../types/file-tree-source';

interface MarkdownRenderingPanelProps {
  // File path
  filePath: string | null;

  // Source and content provider (like FilePreviewPanel)
  source?: FileTreeSource | null;
  contentProvider?: {
    readFileContent: (path: string) => Promise<string | null>;
  };

  // Close handler
  onClose?: () => void;
}

export const MarkdownRenderingPanel: React.FC<MarkdownRenderingPanelProps> = ({
  filePath,
  source,
  contentProvider,
  onClose,
}) => {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<'document' | 'slides'>('slides');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestFilePathRef = useRef<string | null>(null);

  const getAbsolutePath = useCallback(
    (path: string) => {
      // For local sources, construct absolute path
      if (source?.type === 'local') {
        return path.startsWith('/') ? path : `${source.location}/${path}`;
      }
      // For remote sources or no source, return as-is
      return path;
    },
    [source],
  );

  const isLocalFile = source?.type === 'local';

  const loadFile = useCallback(async () => {
    if (!filePath) {
      latestFilePathRef.current = null;
      setDocContent(null);
      setError(null);
      return;
    }

    const absolutePath = getAbsolutePath(filePath);
    latestFilePathRef.current = absolutePath;

    setIsLoading(true);
    setError(null);

    try {
      let content: string | null = null;

      // For local sources, read from filesystem
      if (isLocalFile) {
        const result = await FileSystemService.readFile(absolutePath);
        content = result?.content ?? null;
      }
      // For remote sources, use content provider if available
      else if (contentProvider) {
        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        content = await contentProvider.readFileContent(relativePath);
      }

      if (latestFilePathRef.current !== absolutePath) {
        return;
      }

      if (content !== null) {
        setDocContent(content);
        setError(null);
      } else {
        throw new Error('Failed to read file');
      }
    } catch (err) {
      console.error('Error loading markdown file:', err);
      if (latestFilePathRef.current === absolutePath) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
        setDocContent(null);
      }
    } finally {
      if (latestFilePathRef.current === absolutePath) {
        setIsLoading(false);
      }
    }
  }, [filePath, getAbsolutePath, isLocalFile, contentProvider]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  if (!filePath) {
    return (
      <PanelEmptyState
        icon={FileText}
        title="No document selected"
        description="Select a markdown file to view it here"
      />
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        Loading document...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.error,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        Error: {error}
      </div>
    );
  }

  if (!docContent) {
    return (
      <PanelEmptyState
        icon={FileText}
        title="No content available"
        description="The file could not be loaded"
      />
    );
  }

  const slides = docContent.split('\n\n---\n\n');
  const hasSlides = slides.length > 1;
  const fileName = filePath.split('/').pop() || filePath;

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
              {fileName}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}
            >
              {viewMode === 'slides'
                ? `Slide ${currentSlide + 1} of ${slides.length}`
                : filePath}
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
      </div>
    </div>
  );
};
