import React, { useState, useEffect, useRef } from 'react';
import { FileText, Copy, Check, X, Trash2 } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { MarkdownDocumentViewer } from '../../repo-manager/shared/MarkdownDocumentViewer';
import { PanelEmptyState } from '../../repo-manager/panels/PanelEmptyState';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { FileDeleteConfirmDialog } from '../../components/FileDeleteConfirmDialog';
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
  const [viewMode, setViewMode] = useState<'document' | 'book'>('book');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const latestFilePathRef = useRef<string | null>(null);

  const isLocalFile = source?.type === 'local';
  const sourceLocation = source?.type === 'local' ? source.location : null;

  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        latestFilePathRef.current = null;
        setDocContent(null);
        setError(null);
        return;
      }

      // Construct absolute path inline
      const absolutePath =
        isLocalFile && sourceLocation
          ? filePath.startsWith('/')
            ? filePath
            : `${sourceLocation}/${filePath}`
          : filePath;

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
          const relativePath = filePath.startsWith('/')
            ? filePath.substring(1)
            : filePath;
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
    };

    loadFile();
  }, [filePath, isLocalFile, sourceLocation, contentProvider]);

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

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const handleDelete = async () => {
    if (!filePath) return;

    // Construct absolute path for deletion
    const absolutePath =
      isLocalFile && sourceLocation
        ? filePath.startsWith('/')
          ? filePath
          : `${sourceLocation}/${filePath}`
        : filePath;

    try {
      const result = await FileSystemService.deleteFile(absolutePath);

      if (result?.success) {
        // Close the panel after successful deletion
        setShowDeleteConfirm(false);
        if (onClose) {
          onClose();
        }
      } else {
        throw new Error(result?.error || 'Failed to delete file');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(
        `Failed to delete file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      setShowDeleteConfirm(false);
    }
  };

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
      {/* Compact header with doc name, view toggle, and copy button */}
      <div
        style={{
          height: '41px',
          minHeight: '41px',
          maxHeight: '41px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '16px',
          paddingRight: '12px',
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fileName}
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/* Delete button - only show for local files */}
          {isLocalFile && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                border: 'none',
                background: 'none',
                color: theme.colors.error || '#ef4444',
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                fontSize: '11px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Delete file"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                border: 'none',
                background: 'none',
                color: theme.colors.textSecondary,
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                fontSize: '11px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={14} />
              <span>Close</span>
            </button>
          )}

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
                  background:
                    viewMode === 'document'
                      ? theme.colors.primary
                      : 'transparent',
                  color:
                    viewMode === 'document'
                      ? theme.colors.background
                      : theme.colors.textSecondary,
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
                  setViewMode('book');
                  setCurrentSlide(0);
                }}
                style={{
                  background:
                    viewMode === 'book' ? theme.colors.primary : 'transparent',
                  color:
                    viewMode === 'book'
                      ? theme.colors.background
                      : theme.colors.textSecondary,
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

          <button
            onClick={handleCopyPath}
            title={filePath}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: copiedPath
                ? theme.colors.success
                : theme.colors.textSecondary,
              borderRadius: '4px',
              transition: 'all 0.2s',
              fontSize: '11px',
            }}
            onMouseEnter={(e) => {
              if (!copiedPath) {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {copiedPath ? (
              <>
                <Check size={14} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy path</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        <MarkdownDocumentViewer
          viewMode={viewMode}
          showEditor={false}
          content={docContent}
          slides={slides}
          currentSlide={currentSlide}
          theme={theme}
          showSegmented={true}
          bookViewMode="single"
          onContentChange={() => {}}
          onSlideNavigate={setCurrentSlide}
          onCheckboxChange={() => {}}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && filePath && (
        <FileDeleteConfirmDialog
          filePath={
            isLocalFile && sourceLocation
              ? filePath.startsWith('/')
                ? filePath
                : `${sourceLocation}/${filePath}`
              : filePath
          }
          fileName={fileName}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export const MarkdownRenderingPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600 }}>Markdown Preview</div>
      <div
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}
      >
        Renders .md files with syntax highlighting
      </div>
    </div>
  );
};
