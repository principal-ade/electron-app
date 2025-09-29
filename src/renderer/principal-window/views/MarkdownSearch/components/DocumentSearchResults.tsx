import React, { useState, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { FileText, Code, Hash, ChevronRight, ChevronDown, File } from 'lucide-react';
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
  // Start with first file expanded if there are results
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => {
    if (results.length > 0 && results[0].filePath) {
      return new Set([results[0].filePath]);
    }
    return new Set();
  });

  // Group results by file path
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();

    results.forEach(result => {
      const filePath = result.filePath || result.fileName;
      if (!groups.has(filePath)) {
        groups.set(filePath, []);
      }
      const fileResults = groups.get(filePath);
      if (fileResults) {
        fileResults.push(result);
      }
    });

    // Sort groups by total score of matches
    return Array.from(groups.entries()).sort((a, b) => {
      const scoreA = a[1].reduce((sum, r) => sum + r.score, 0);
      const scoreB = b[1].reduce((sum, r) => sum + r.score, 0);
      return scoreB - scoreA;
    });
  }, [results]);

  const toggleFileExpansion = (filePath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  };

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

    return parts.map((part, i) => {
      // Using index in key is safe here since the parts array order is stable and never reordered
      const key = `${i}-${part.slice(0, 20)}`;
      return regex.test(part) ? (
        <mark
          key={key}
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
        <span key={key}>{part}</span>
      );
    });
  };

  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // TODO: Repository information will come from document metadata once
  // @a24z/markdown-search supports metadata in indexing (see MARKDOWN_SEARCH_FEATURE_REQUEST.md)
  // For now, we don't display repository info in search results


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
    <div className="h-full overflow-y-auto overflow-x-hidden">
      {groupedResults.map(([filePath, fileResults]) => {
        const isExpanded = expandedFiles.has(filePath);
        const hasSelectedResult = fileResults.some(r => r.id === selectedDocument?.id);

        return (
          <div key={filePath} className="border-b" style={{ borderColor: theme.colors.border }}>
            {/* File Header */}
            <div
              className="px-4 py-3 cursor-pointer transition-colors flex items-center gap-2"
              style={{
                backgroundColor: hasSelectedResult ? `${theme.colors.primary}10` : theme.colors.backgroundSecondary,
              }}
              onClick={(e) => toggleFileExpansion(filePath, e)}
              onMouseEnter={(e) => {
                if (!hasSelectedResult) {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}05`;
                }
              }}
              onMouseLeave={(e) => {
                if (!hasSelectedResult) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                }
              }}
            >
              <button
                className="p-0.5 -m-0.5"
                style={{ color: theme.colors.textSecondary }}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <File size={16} style={{ color: theme.colors.primary }} />
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm" style={{ color: theme.colors.text }}>
                    {filePath.split('/').pop()}
                  </div>
                  <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    {filePath}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    {fileResults.length} {fileResults.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section Matches */}
            {isExpanded && (
              <div className="bg-opacity-50" style={{ backgroundColor: `${theme.colors.backgroundSecondary}50` }}>
                {fileResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => onDocumentSelect(result)}
                    className="px-4 py-2 ml-6 border-l-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: selectedDocument?.id === result.id ? theme.colors.primary : 'transparent',
                      backgroundColor:
                        selectedDocument?.id === result.id
                          ? `${theme.colors.primary}15`
                          : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDocument?.id !== result.id) {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedDocument?.id !== result.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* Section Title */}
                    <div className="flex items-start gap-2 mb-1">
                      <div className="mt-0.5" style={{ color: theme.colors.primary }}>
                        {getDocumentIcon(result.type)}
                      </div>
                      <div className="flex-1">
                        <h4
                          className="text-sm"
                          style={{ color: theme.colors.text }}
                        >
                          {result.title
                            ? highlightMatch(result.title, searchQuery)
                            : 'Document'}
                        </h4>
                        <div className="flex items-center gap-2">
                          {/* Show section info if available */}
                          {result.sectionIndex !== undefined && result.totalSectionsInFile && (
                            <span className="text-xs" style={{ color: theme.colors.accent }}>
                              Section {result.sectionIndex + 1}/{result.totalSectionsInFile}
                            </span>
                          )}
                          {/* Show if match is only in title */}
                          {result.matches.length > 0 &&
                           result.matches.every(m => m.field === 'title' || (!m.context.before.trim() && !m.context.after.trim())) && (
                            <span className="text-xs italic" style={{ color: theme.colors.textSecondary, opacity: 0.7 }}>
                              Match in title
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Match Preview - Only show if we have meaningful content */}
                    {result.matches.length > 0 && result.matches.some(m => m.field === 'content' && (m.context.before.trim() || m.context.after.trim())) && (
                      <div className="ml-6 space-y-1">
                        {result.matches
                          .filter(match => match.field === 'content' && (match.context.before.trim() || match.context.after.trim()))
                          .slice(0, 1)
                          .map((match) => (
                            <div
                              key={`match-${match.field}-${match.matchedText}-${match.context.before.slice(-10)}`}
                              className="text-xs"
                              style={{
                                color: theme.colors.textSecondary,
                                lineHeight: 1.5,
                              }}
                            >
                              <div className="truncate">
                                <span style={{ opacity: 0.7 }}>
                                  ...{match.context.before.slice(-40).trim()}
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
                                  {match.context.after.slice(0, 40).trim()}...
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
