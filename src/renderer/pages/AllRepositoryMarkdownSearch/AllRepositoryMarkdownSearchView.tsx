import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useTheme } from 'themed-markdown';
import { FileText, Tag, Calendar, Filter, Search } from 'lucide-react';
import type { SearchResult } from '@a24z/markdown-search';
import { documentSearchService } from '../../services/DocumentSearchService';
import type { GetIndexStatusResponse } from '../../../shared/ipc/DocumentSearchIPC';
import { DocumentSearchResults } from './DocumentSearchResults';
import { DocumentViewer } from './DocumentViewer';
import { IndexRepositoryButton } from './IndexRepositoryButton';

interface AllRepositoryMarkdownSearchViewProps {
  onClose?: () => void;
}

export const AllRepositoryMarkdownSearchView: React.FC<AllRepositoryMarkdownSearchViewProps> = ({
  onClose,
}) => {
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize service and index Alexandria repositories
  useEffect(() => {
    const init = async () => {
      try {
        await documentSearchService.initialize();

        // Get Alexandria repositories and index them
        console.log(
          '[AllRepositoryMarkdownSearchView] Getting Alexandria repositories for indexing...',
        );
        const { AlexandriaService } = await import(
          '../../main-process-api/AlexandriaService'
        );
        const repositories = await AlexandriaService.getRepositories();

        console.log(
          `[AllRepositoryMarkdownSearchView] Found ${repositories.length} Alexandria repositories`,
        );

        // Use batch indexing for all repositories
        if (repositories.length > 0) {
          const reposToIndex = repositories
            .filter((r) => r.path) // Only repos with valid paths
            .map((r) => ({ path: r.path, name: r.name }));

          if (reposToIndex.length > 0) {
            console.log(
              `[AllRepositoryMarkdownSearchView] Batch indexing ${reposToIndex.length} repositories`,
            );
            try {
              const result =
                await documentSearchService.indexMultipleRepositories(
                  reposToIndex,
                );
              console.log(
                '[AllRepositoryMarkdownSearchView] Batch indexing complete:',
                result,
              );
            } catch (error) {
              console.error(
                '[AllRepositoryMarkdownSearchView] Batch indexing failed:',
                error,
              );
            }
          }
        }

        // Get updated status
        const status = await documentSearchService.getStatus();
        setIndexStatus(status);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize search service:', error);
      }
    };
    init();

    // Subscribe to index updates
    const unsubscribe = documentSearchService.onIndexUpdate((event) => {
      // Only log completion events, not every progress update
      if (event.type === 'completed' || event.type === 'failed') {
        console.log('Index update completed:', event.type);
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
          .search(searchQuery)
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
          .catch((error) => {
            console.error('Search failed:', error);
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
  }, [searchQuery, isInitialized]);

  const handleDocumentSelect = useCallback((doc: SearchResult) => {
    setSelectedDocument(doc);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    },
    [onClose],
  );

  // Keep focus on search input when component mounts or view changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const focusTimer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(focusTimer);
  }, [searchQuery.length === 0]); // Re-focus when switching between empty/non-empty states

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100%',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
      onKeyDown={handleKeyDown}
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
              placeholder="Search documentation, code, and markdown files..."
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
            className="px-3 py-2 rounded border transition-colors"
            style={{
              backgroundColor: showFilters
                ? theme.colors.primary
                : 'transparent',
              borderColor: theme.colors.border,
              color: showFilters ? theme.colors.background : theme.colors.text,
            }}
          >
            <Filter size={18} />
          </button>
          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
              <span className="flex items-center gap-1">
                <FileText size={14} />
                {indexStatus?.totalDocuments || 0} documents indexed
              </span>
              <span className="flex items-center gap-1">
                <Tag size={14} />
                {indexStatus?.repositories?.length || 0} repositories
              </span>
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
                Search Your Knowledge Base
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: theme.colors.textSecondary }}
              >
                Find documentation, code snippets, planning notes, and more
                across all your repositories
              </p>
              <div
                className="text-xs space-y-2"
                style={{ color: theme.colors.textSecondary }}
              >
                <p>
                  <strong>Tip:</strong> Use quotes for exact phrases: "search
                  engine"
                </p>
                <p>
                  <strong>Filter:</strong> Use tags like <code>tag:api</code> or{' '}
                  <code>type:code</code>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
