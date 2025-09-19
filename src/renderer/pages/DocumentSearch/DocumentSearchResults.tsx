import React from 'react';
import { useTheme } from 'themed-markdown';
import { FileText, Code, Hash, ChevronRight, Folder } from 'lucide-react';
import type { SearchResult, DocumentType } from '@a24z/markdown-search';

interface DocumentSearchResultsProps {
  results: SearchResult[];
  selectedDocument: SearchResult | null;
  onDocumentSelect: (doc: SearchResult) => void;
  isSearching: boolean;
  searchQuery: string;
}

export const DocumentSearchResults: React.FC<DocumentSearchResultsProps> = ({
  results,
  selectedDocument,
  onDocumentSelect,
  isSearching,
  searchQuery,
}) => {
  const { theme } = useTheme();

  const getDocumentIcon = (type: DocumentType) => {
    switch (type) {
      case 'code':
        return <Code size={16} />;
      case 'section':
      case 'heading':
        return <Hash size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          style={{
            backgroundColor: `${theme.colors.primary}30`,
            color: theme.colors.text,
            padding: '0 2px',
            borderRadius: '2px',
          }}
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // TODO: Repository information will come from document metadata once
  // @a24z/markdown-search supports metadata in indexing (see MARKDOWN_SEARCH_FEATURE_REQUEST.md)
  // For now, we don't display repository info in search results

  const renderBreadcrumb = (doc: SearchResult) => {
    if (!doc.breadcrumb || doc.breadcrumb.length === 0) return null;

    return (
      <div
        className="flex items-center gap-1 text-xs mb-1"
        style={{
          color: theme.colors.textSecondary,
        }}
      >
        <Folder size={12} />
        {doc.breadcrumb.slice(-3).map((segment, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} />}
            <span>{segment}</span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (isSearching) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-2 mx-auto"
            style={{ borderColor: theme.colors.primary }}
          />
          <p style={{ color: theme.colors.textSecondary }}>Searching...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0 && searchQuery) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <FileText
            size={48}
            className="mx-auto mb-3"
            style={{
              color: theme.colors.textSecondary,
              opacity: 0.3,
            }}
          />
          <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
            No results found for "{searchQuery}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onDocumentSelect(result)}
          className="px-4 py-3 border-b cursor-pointer transition-colors"
          style={{
            borderColor: theme.colors.border,
            backgroundColor:
              selectedDocument?.id === result.id
                ? `${theme.colors.primary}15`
                : 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor =
              selectedDocument?.id === result.id
                ? `${theme.colors.primary}15`
                : 'transparent';
          }}
        >
          {/* Breadcrumb */}
          {renderBreadcrumb(result)}

          {/* Title and Icon */}
          <div className="flex items-start gap-2 mb-1">
            <div className="mt-0.5" style={{ color: theme.colors.primary }}>
              {getDocumentIcon(result.type)}
            </div>
            <div className="flex-1">
              <h3
                className="font-medium text-sm"
                style={{ color: theme.colors.text }}
              >
                {result.title
                  ? highlightMatch(result.title, searchQuery)
                  : result.fileName}
              </h3>
            </div>
            {/* Score Badge */}
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: `${theme.colors.primary}20`,
                color: theme.colors.primary,
              }}
            >
              {Math.round(result.score)}%
            </span>
          </div>

          {/* Matches Preview */}
          {result.matches.length > 0 && (
            <div className="ml-6 space-y-1">
              {result.matches.slice(0, 2).map((match, i) => (
                <div
                  key={i}
                  className="text-xs"
                  style={{
                    color: theme.colors.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  {match.field === 'content' && (
                    <div>
                      <span style={{ opacity: 0.7 }}>
                        {match.context.before.slice(-30)}
                      </span>
                      <span
                        style={{
                          backgroundColor: `${theme.colors.primary}30`,
                          padding: '0 2px',
                          borderRadius: '2px',
                        }}
                      >
                        {match.matchedText}
                      </span>
                      <span style={{ opacity: 0.7 }}>
                        {match.context.after.slice(0, 30)}
                      </span>
                      ...
                    </div>
                  )}
                  {match.field === 'title' && (
                    <div>
                      Found in title:{' '}
                      {highlightMatch(match.matchedText, searchQuery)}
                    </div>
                  )}
                  {match.field === 'metadata' && (
                    <div>
                      Tag: {highlightMatch(match.matchedText, searchQuery)}
                    </div>
                  )}
                </div>
              ))}
              {result.matches.length > 2 && (
                <div
                  className="text-xs"
                  style={{
                    color: theme.colors.primary,
                    opacity: 0.8,
                  }}
                >
                  +{result.matches.length - 2} more matches
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {result.tags && result.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2 ml-6">
              {result.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${theme.colors.backgroundSecondary}`,
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
