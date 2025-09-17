import React, { useEffect, useState } from 'react';
import { useTheme } from 'themed-markdown';
import { FileText, ExternalLink, Copy, Check } from 'lucide-react';
import type { SearchResult } from '@a24z/markdown-search';
import { MarkdownDocumentViewer } from '../RepoManager/shared/MarkdownDocumentViewer';

interface DocumentViewerProps {
  document: SearchResult | null;
  searchQuery?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  searchQuery
}) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [highlightedContent, setHighlightedContent] = useState<string>('');

  useEffect(() => {
    if (document?.content && searchQuery) {
      // Highlight search terms in the content
      const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
      const highlighted = document.content.replace(
        regex,
        '**<mark>$1</mark>**'
      );
      setHighlightedContent(highlighted);
    } else if (document?.content) {
      setHighlightedContent(document.content);
    }
  }, [document, searchQuery]);

  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const handleCopyPath = async () => {
    if (document?.filePath) {
      await navigator.clipboard.writeText(document.filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInEditor = () => {
    // TODO: Implement opening in IDE
    console.log('Open in editor:', document?.filePath);
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
              opacity: 0.3
            }}
          />
          <p
            className="text-sm"
            style={{ color: theme.colors.textSecondary }}
          >
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
          backgroundColor: theme.colors.backgroundSecondary
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
                color: theme.colors.text
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
                color: theme.colors.text
              }}
              title="Open in editor"
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          {document.metadata?.wordCount && (
            <span style={{ color: theme.colors.textSecondary }}>
              {document.metadata.wordCount} words
            </span>
          )}
          {document.metadata?.codeLanguages && document.metadata.codeLanguages.length > 0 && (
            <span style={{ color: theme.colors.textSecondary }}>
              Languages: {(document.metadata.codeLanguages as string[]).join(', ')}
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
                  color: theme.colors.primary
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <MarkdownDocumentViewer
            content={highlightedContent}
            slides={[highlightedContent]}
            currentSlide={0}
            theme={theme}
            showSegmented={false}
            onContentChange={() => {}}
            onSlideNavigate={() => {}}
            onCheckboxChange={() => {}}
            viewMode="document"
            showEditor={false}
          />
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