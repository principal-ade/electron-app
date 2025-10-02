import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { FileText, ExternalLink, Copy, Check } from 'lucide-react';
import type { SearchResult } from '@a24z/markdown-search';
import { MarkdownDocumentViewer } from '../../../../pages/RepoManager/shared/MarkdownDocumentViewer';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';

interface DocumentViewerProps {
  document: SearchResult | null;
  searchQuery?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  searchQuery: _searchQuery,
}) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [fullContent, setFullContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Load full content when document changes
  useEffect(() => {
    const loadContent = async () => {
      if (!document) {
        setFullContent('');
        return;
      }

      // Check if content is already loaded (backward compatibility)
      if (document.content && !document.content.startsWith('[Content')) {
        setFullContent(document.content);
        return;
      }

      // Load content from file using the file path
      if (document.filePath) {
        setIsLoadingContent(true);
        try {
          // Use the FileSystemService abstraction layer
          const result = await FileSystemService.readFile(document.filePath);
          // Handle the result object that contains { content, filePath }
          if (result && typeof result === 'object' && 'content' in result) {
            setFullContent(result.content || '');
          } else if (typeof result === 'string') {
            // In case it returns a string directly
            setFullContent(result);
          } else {
            setFullContent('');
          }
        } catch (_error) {
          // Fallback to the content field if available
          setFullContent(document.content || 'Failed to load document content');
        } finally {
          setIsLoadingContent(false);
        }
      } else {
        // No file path available, use whatever content we have
        setFullContent(document.content || '');
      }
    };

    loadContent();
  }, [document]);

  // Navigate to the matched section when document changes
  useEffect(() => {
    if (document?.sectionIndex !== undefined) {
      setCurrentSlide(document.sectionIndex);
    } else {
      setCurrentSlide(0);
    }
  }, [document?.sectionIndex]);


  const handleCopyPath = async () => {
    if (document?.filePath) {
      await navigator.clipboard.writeText(document.filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInEditor = () => {
    // TODO: Implement opening in IDE
    // TODO: Implement opening in IDE
  };

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText
            size={64}
            className="mx-auto mb-4"
            style={{
              color: theme.colors.textSecondary,
              opacity: 0.3,
            }}
          />
          <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
            Select a document to view
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Document Header */}
      <div
        className="px-6 py-4 border-b"
        style={{
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2
              className="text-lg font-semibold mb-1"
              style={{ color: theme.colors.text }}
            >
              {document.title || document.fileName}
            </h2>
            <div
              className="text-sm flex items-center gap-2"
              style={{ color: theme.colors.textSecondary }}
            >
              <span className="font-mono text-xs">{document.filePath}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPath}
              className="p-2 rounded hover:opacity-80 transition-all"
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                color: theme.colors.text,
              }}
              title="Copy file path"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button
              onClick={handleOpenInEditor}
              className="p-2 rounded hover:opacity-80 transition-all"
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                color: theme.colors.text,
              }}
              title="Open in editor"
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          {document.sectionIndex !== undefined && document.totalSectionsInFile && (
            <span style={{ color: theme.colors.primary }}>
              Section {document.sectionIndex + 1} of {document.totalSectionsInFile}
            </span>
          )}
          {document.metadata?.wordCount && (
            <span style={{ color: theme.colors.textSecondary }}>
              {document.metadata.wordCount} words
            </span>
          )}
          {document.metadata?.codeLanguages &&
            Array.isArray(document.metadata.codeLanguages) &&
            document.metadata.codeLanguages.length > 0 && (
              <span style={{ color: theme.colors.textSecondary }}>
                Languages:{' '}
                {(document.metadata.codeLanguages as string[]).join(', ')}
              </span>
            )}
          {document.indexedAt && (
            <span style={{ color: theme.colors.textSecondary }}>
              Indexed: {new Date(document.indexedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {document.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: `${theme.colors.primary}20`,
                  color: theme.colors.primary,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6">
          {isLoadingContent ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div
                  className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4"
                  style={{ borderColor: theme.colors.primary }}
                ></div>
                <p style={{ color: theme.colors.textSecondary }}>
                  Loading document content...
                </p>
              </div>
            </div>
          ) : (
            <MarkdownDocumentViewer
              content={fullContent}
              slides={[fullContent]} // Let MarkdownDocumentViewer handle slide parsing
              currentSlide={currentSlide}
              theme={theme}
              showSegmented={document?.totalSectionsInFile ? document.totalSectionsInFile > 1 : false}
              onContentChange={() => {}}
              onSlideNavigate={(slideNum: number) => setCurrentSlide(slideNum)}
              onCheckboxChange={() => {}}
              viewMode="slides"
              showEditor={false}
            />
          )}
        </div>
      </div>

      {/* Custom styles for search highlighting */}
      <style>{`
        mark {
          background-color: ${theme.colors.primary}30 !important;
          color: ${theme.colors.text} !important;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};
