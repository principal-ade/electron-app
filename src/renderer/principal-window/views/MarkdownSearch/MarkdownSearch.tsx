import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useTheme } from '@principal-ade/industry-theme';
import { Calendar, Filter, Search, Check, FolderOpen } from 'lucide-react';
import type { SearchResult } from '@principal-ai/markdown-search';
import { documentSearchService } from '../../../services/DocumentSearchService';
import type { GetIndexStatusResponse } from '../../../../shared/ipc/DocumentSearchIPC';
import { DocumentSearchResults } from './components/DocumentSearchResults';
import { DocumentViewer } from './components/DocumentViewer';
import { IndexRepositoryButton } from './components/IndexRepositoryButton';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';

export const MarkdownSearch: React.FC = () => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SearchResult | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [indexStatus, setIndexStatus] = useState<GetIndexStatusResponse | null>(
    null,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>(
    [],
  );
  const [allRepositories, setAllRepositories] = useState<
    Array<{ path: string; name: string }>
  >([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize service and index Alexandria repositories
  useEffect(() => {
    const init = async () => {
      try {
        await documentSearchService.initialize();

        // Get Alexandria repositories and index them
        const repositories = await AlexandriaService.getRepositories();

        // Use batch indexing for all repositories
        if (repositories.length > 0) {
          const reposToIndex = repositories
            .filter((r) => r.path) // Only repos with valid paths
            .map((r) => ({ path: r.path, name: r.name }));

          // Store all repositories for filtering
          setAllRepositories(reposToIndex);
          // By default, all repositories are selected
          setSelectedRepositories(reposToIndex.map((r) => r.path));

          if (reposToIndex.length > 0) {
            try {
              await documentSearchService.indexMultipleRepositories(
                reposToIndex,
              );
            } catch (_error) {
              // Batch indexing failed, continue silently
            }
          }
        }

        // Get updated status
        const status = await documentSearchService.getStatus();
        setIndexStatus(status);
        setIsInitialized(true);
      } catch (_error) {}
    };
    init();

    // Subscribe to index updates
    const unsubscribe = documentSearchService.onIndexUpdate((event) => {
      // Only log completion events, not every progress update
      if (event.type === 'completed' || event.type === 'failed') {
        // Refresh status after index completes
        documentSearchService.getStatus().then(setIndexStatus);
      }
      // For progress events, we could update a progress indicator if needed
      // but don't spam the console or refresh status constantly
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isInitialized) return;

    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        documentSearchService
          .search(searchQuery, {
            repositories:
              selectedRepositories.length > 0
                ? selectedRepositories
                : undefined,
          })
          .then((results) => {
            setSearchResults(results);
            setIsSearching(false);
            // Maintain focus on the search input after results load
            if (
              searchInputRef.current &&
              document.activeElement !== searchInputRef.current
            ) {
              searchInputRef.current.focus();
            }
          })
          .catch(() => {
            setSearchResults([]);
            setIsSearching(false);
            // Maintain focus on error too
            if (
              searchInputRef.current &&
              document.activeElement !== searchInputRef.current
            ) {
              searchInputRef.current.focus();
            }
          });
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isInitialized, selectedRepositories]);

  const handleDocumentSelect = useCallback((doc: SearchResult) => {
    setSelectedDocument(doc);
  }, []);

  // Extract the boolean expression for ESLint dependency tracking
  const isSearchEmpty = searchQuery.length === 0;

  // Keep focus on search input when component mounts or view changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const focusTimer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(focusTimer);
  }, [isSearchEmpty]); // Re-focus when switching between empty/non-empty states

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div style={{ width: '40%', minWidth: '300px' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${indexStatus?.totalDocuments || 0} markdown docs in ${indexStatus?.repositories?.length || 0} repos`}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
              autoFocus
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 rounded border transition-colors relative"
            style={{
              backgroundColor: showFilters
                ? theme.colors.primary
                : 'transparent',
              borderColor: theme.colors.border,
              color: showFilters ? theme.colors.background : theme.colors.text,
            }}
          >
            <Filter size={18} />
            {selectedRepositories.length > 0 &&
              selectedRepositories.length < allRepositories.length && (
                <div
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.colors.primary }}
                />
              )}
          </button>
          <div className="flex-1 flex items-center justify-end gap-4">
            <div
              className="flex items-center gap-4 text-xs"
              style={{ color: theme.colors.textSecondary }}
            >
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {indexStatus?.lastUpdate
                  ? `Updated ${new Date(indexStatus.lastUpdate).toLocaleTimeString()}`
                  : 'Not indexed'}
              </span>
            </div>
            <IndexRepositoryButton
              onIndexed={async () => {
                const status = await documentSearchService.getStatus();
                setIndexStatus(status);
              }}
            />
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div
          className="px-6 py-4 border-b"
          style={{
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.backgroundLight,
          }}
        >
          <div className="mb-3">
            <h3
              className="text-sm font-semibold flex items-center gap-2"
              style={{ color: theme.colors.text }}
            >
              <FolderOpen size={16} />
              Filter by Repository
              <span
                className="text-xs font-normal ml-2"
                style={{ color: theme.colors.textSecondary }}
              >
                ({selectedRepositories.length} of {allRepositories.length}{' '}
                selected)
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {allRepositories.map((repo) => {
              const isSelected = selectedRepositories.includes(repo.path);
              return (
                <div
                  key={repo.path}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedRepositories((prev) =>
                        prev.filter((p) => p !== repo.path),
                      );
                    } else {
                      setSelectedRepositories((prev) => [...prev, repo.path]);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}20`
                      : theme.colors.background,
                    border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : 'transparent',
                      border: isSelected
                        ? 'none'
                        : `1px solid ${theme.colors.border}`,
                    }}
                  >
                    {isSelected && (
                      <Check
                        size={12}
                        color={theme.colors.background}
                        strokeWidth={3}
                      />
                    )}
                  </div>
                  <span
                    className="text-xs truncate"
                    style={{
                      color: isSelected
                        ? theme.colors.primary
                        : theme.colors.text,
                    }}
                    title={repo.name}
                  >
                    {repo.name}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                setSelectedRepositories(allRepositories.map((r) => r.path))
              }
              className="text-xs px-3 py-1 rounded border transition-colors"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
              }}
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedRepositories([])}
              className="text-xs px-3 py-1 rounded border transition-colors"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {searchQuery ? (
          <PanelGroup direction="horizontal" className="h-full">
            {/* Search Results Panel */}
            <Panel defaultSize={40} minSize={30} maxSize={60}>
              <DocumentSearchResults
                results={searchResults}
                selectedDocument={selectedDocument}
                onDocumentSelect={handleDocumentSelect}
                isSearching={isSearching}
                searchQuery={searchQuery}
              />
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle
              className="w-1 hover:bg-opacity-50 transition-colors"
              style={{
                backgroundColor: theme.colors.border,
              }}
            />

            {/* Document Viewer Panel */}
            <Panel defaultSize={60} minSize={40} maxSize={70}>
              <DocumentViewer
                document={selectedDocument}
                searchQuery={searchQuery}
              />
            </Panel>
          </PanelGroup>
        ) : (
          /* Empty State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Search
                size={64}
                className="mx-auto mb-4"
                style={{
                  color: theme.colors.textSecondary,
                  opacity: 0.5,
                }}
              />
              <h2
                className="text-2xl font-semibold mb-2"
                style={{ color: theme.colors.text }}
              >
                Search Markdown Docs across all your repositories
              </h2>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
