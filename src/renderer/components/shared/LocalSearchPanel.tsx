import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import { FileTree } from '@principal-ai/repository-abstraction';
import { FileText, Sparkles, Search, ExternalLink } from 'lucide-react';
import {
  localSearchService,
  LocalSearchResult,
  ContentMatch,
} from '../../services/LocalSearchService';

export interface DirectoryFilter {
  id: string;
  path: string;
  mode: 'include' | 'exclude';
}

interface LocalSearchPanelProps {
  fileSystemTree: FileTree;
  baseDirectory: string;
  onFileSelect: (
    filePath: string,
    lineNumbers?: number[],
    searchQuery?: string,
  ) => void;
  selectedFile?: string | null;
  onDirectoryFilterChange?: (filter: string) => void;
  onDirectoryFiltersChange?: (filters: DirectoryFilter[]) => void;
  onSearchResultsChange?: (results: LocalSearchResult[]) => void;
  onSearchQueryChange?: (query: string) => void;
  onSearchResultHover?: (filePath: string | null) => void;
  className?: string;
  headerExtra?: React.ReactNode;
  onOpenInEditor?: (filePath: string) => void;
  selectedEditor?: string;
}

export const LocalSearchPanel: React.FC<LocalSearchPanelProps> = ({
  fileSystemTree,
  baseDirectory,
  onFileSelect,
  selectedFile,
  onDirectoryFilterChange,
  onDirectoryFiltersChange,
  onSearchResultsChange,
  onSearchQueryChange,
  onSearchResultHover,
  className = '',
  headerExtra,
  onOpenInEditor,
  selectedEditor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('');
  const [directoryFilters, setDirectoryFilters] = useState<DirectoryFilter[]>(
    [],
  );
  const [searchResults, setSearchResults] = useState<LocalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedDirectoryIndex, setSelectedDirectoryIndex] = useState(0);
  const [showDirectoryDropdown, setShowDirectoryDropdown] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [isSearchResultsFocused, setIsSearchResultsFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Additional search filters
  const [searchType, setSearchType] = useState<'content' | 'filename' | 'both'>(
    'both',
  );
  const [excludeDirectory, setExcludeDirectory] = useState(false);
  const [searchFileType, setSearchFileType] = useState<string>('');
  const [showSearchOptions, setShowSearchOptions] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suppressDropdownRef = useRef<boolean>(false);

  const { theme } = useTheme();

  // Notify parent when directory filters change
  useEffect(() => {
    if (onDirectoryFiltersChange) {
      onDirectoryFiltersChange(directoryFilters);
    }
  }, [directoryFilters, onDirectoryFiltersChange]);

  // Add a new directory filter
  const addDirectoryFilter = useCallback(
    (path: string, mode: 'include' | 'exclude' = 'include') => {
      if (!path.trim()) return;

      // Check if this path already exists in filters
      const existingFilter = directoryFilters.find((f) => f.path === path);
      if (existingFilter) {
        // Toggle mode if already exists
        setDirectoryFilters((filters) =>
          filters.map((f) =>
            f.path === path
              ? { ...f, mode: f.mode === 'include' ? 'exclude' : 'include' }
              : f,
          ),
        );
      } else {
        // Add new filter
        const newFilter: DirectoryFilter = {
          id: `filter-${Date.now()}`,
          path: path.trim(),
          mode,
        };
        setDirectoryFilters((filters) => [...filters, newFilter]);
      }
    },
    [directoryFilters],
  );

  // Remove a directory filter
  const removeDirectoryFilter = useCallback((filterId: string) => {
    setDirectoryFilters((filters) => filters.filter((f) => f.id !== filterId));
  }, []);

  // Toggle filter mode
  const toggleFilterMode = useCallback((filterId: string) => {
    setDirectoryFilters((filters) =>
      filters.map((f) =>
        f.id === filterId
          ? { ...f, mode: f.mode === 'include' ? 'exclude' : 'include' }
          : f,
      ),
    );
  }, []);

  // Focus search input when panel opens
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Initialize search index when fileSystemTree changes
  useEffect(() => {
    if (fileSystemTree && baseDirectory) {
      localSearchService.indexFileSystemTree(fileSystemTree, baseDirectory);
    }
  }, [fileSystemTree, baseDirectory]);

  // Notify parent when search results change
  useEffect(() => {
    onSearchResultsChange?.(searchResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults]); // Only depend on searchResults, not the callback

  // Get matching directories for dropdown
  const getMatchingDirectories = useCallback(() => {
    if (!directoryFilter || !fileSystemTree) return [];

    // Get unique directories
    const directories = new Set<string>();
    fileSystemTree.allDirectories.forEach((dir) => {
      directories.add(dir.relativePath);
    });

    // Filter directories
    return Array.from(directories)
      .filter((dir) => {
        const lowerDir = dir.toLowerCase();
        const lowerFilter = directoryFilter.toLowerCase();
        return lowerDir.includes(lowerFilter) && lowerDir !== lowerFilter;
      })
      .map((dir) => ({
        path: dir,
        displayPath: dir,
        score: dir.toLowerCase().startsWith(directoryFilter.toLowerCase())
          ? 100
          : 80,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [directoryFilter, fileSystemTree]);

  const matchingDirectories = getMatchingDirectories();

  // Update dropdown visibility
  useEffect(() => {
    if (suppressDropdownRef.current) {
      suppressDropdownRef.current = false;
      return;
    }
    setShowDirectoryDropdown(
      directoryFilter.length > 0 && matchingDirectories.length > 0,
    );
    setSelectedDirectoryIndex(0);
  }, [directoryFilter, matchingDirectories.length]);

  // Handle keyboard navigation for directory dropdown
  const handleDirectoryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          if (showDirectoryDropdown && matchingDirectories.length > 0) {
            e.preventDefault();
            setSelectedDirectoryIndex((prev) =>
              prev < matchingDirectories.length - 1 ? prev + 1 : prev,
            );
          }
          break;
        case 'ArrowUp':
          if (showDirectoryDropdown && matchingDirectories.length > 0) {
            e.preventDefault();
            setSelectedDirectoryIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
          break;
        case 'Enter':
          e.preventDefault();
          setShowDirectoryDropdown(false);
          suppressDropdownRef.current = true;

          // Check if directoryFilter is an exact match to an existing directory
          const allDirectories = fileSystemTree
            ? Array.from(
                new Set(
                  fileSystemTree.allDirectories.map((dir) => dir.relativePath),
                ),
              )
            : [];
          const exactMatch = allDirectories.find(
            (dir) => dir.toLowerCase() === directoryFilter.toLowerCase(),
          );

          if (exactMatch) {
            // Use the exact match
            console.log(
              '[LocalSearchPanel] Adding exact match filter:',
              exactMatch,
            );
            addDirectoryFilter(
              exactMatch,
              excludeDirectory ? 'exclude' : 'include',
            );
            setDirectoryFilter(''); // Clear input after adding
            onDirectoryFilterChange?.(exactMatch); // Keep backward compatibility
          } else if (
            matchingDirectories.length > 0 &&
            matchingDirectories[selectedDirectoryIndex]
          ) {
            // Use the selected dropdown option
            const dir = matchingDirectories[selectedDirectoryIndex];
            console.log(
              '[LocalSearchPanel] Adding dropdown selection filter:',
              dir.path,
            );
            addDirectoryFilter(
              dir.path,
              excludeDirectory ? 'exclude' : 'include',
            );
            setDirectoryFilter(''); // Clear input after adding
            onDirectoryFilterChange?.(dir.path); // Keep backward compatibility
          } else if (directoryFilter.trim()) {
            // Use the typed value as-is
            console.log(
              '[LocalSearchPanel] Adding typed filter:',
              directoryFilter,
            );
            addDirectoryFilter(
              directoryFilter,
              excludeDirectory ? 'exclude' : 'include',
            );
            setDirectoryFilter(''); // Clear input after adding
            onDirectoryFilterChange?.(directoryFilter); // Keep backward compatibility
          }
          break;
        case 'Escape':
          if (showDirectoryDropdown) {
            e.preventDefault();
            setShowDirectoryDropdown(false);
          }
          break;
      }
    },
    [
      showDirectoryDropdown,
      matchingDirectories,
      selectedDirectoryIndex,
      directoryFilter,
      onDirectoryFilterChange,
      addDirectoryFilter,
      excludeDirectory,
      fileSystemTree,
    ],
  );

  // Apply multiple directory filters to a path
  const matchesDirectoryFilters = useCallback(
    (relativePath: string): boolean => {
      if (directoryFilters.length === 0) return true;

      const includeFilters = directoryFilters.filter(
        (f) => f.mode === 'include',
      );
      const excludeFilters = directoryFilters.filter(
        (f) => f.mode === 'exclude',
      );

      // Check excludes first (they take precedence)
      for (const filter of excludeFilters) {
        if (relativePath.toLowerCase().includes(filter.path.toLowerCase())) {
          return false;
        }
      }

      // If we have includes, must match at least one
      if (includeFilters.length > 0) {
        return includeFilters.some((filter) =>
          relativePath.toLowerCase().includes(filter.path.toLowerCase()),
        );
      }

      // No includes means include everything (except excludes)
      return true;
    },
    [directoryFilters],
  );

  // Local filename search
  const searchInFileTree = useCallback(
    (query: string): LocalSearchResult[] => {
      if (!query.trim()) return [];

      // For backward compatibility, use single directoryFilter if no multi-filters
      const useLegacyFilter = directoryFilters.length === 0 && directoryFilter;

      const results = localSearchService.search(query, {
        searchIn:
          searchType === 'content' ? ['name', 'path'] : ['name', 'path'],
        directoryFilter: useLegacyFilter ? directoryFilter : '',
        excludeDirectory: useLegacyFilter ? excludeDirectory : false,
        fileType: searchFileType,
        limit: 1000, // Increase limit since we'll filter client-side
      });

      // Apply multi-directory filters if present
      const filteredResults =
        directoryFilters.length > 0
          ? results.filter((result) =>
              matchesDirectoryFilters(result.relativePath),
            )
          : results;

      return filteredResults.slice(0, 100).map((result) => ({
        path: result.path,
        name: result.name,
        relativePath: result.relativePath,
        matchTypes: new Set(['filename'] as ('filename' | 'content')[]),
        filenameMatch: {
          matchedPart: query,
          startIndex: 0,
          endIndex: query.length,
        },
        relevanceScore: result.score,
      }));
    },
    [
      directoryFilter,
      excludeDirectory,
      searchFileType,
      searchType,
      directoryFilters,
      matchesDirectoryFilters,
    ],
  );

  // Merge filename and content search results
  const mergeSearchResults = useCallback(
    (
      filenameResults: LocalSearchResult[],
      contentResults: Map<string, ContentMatch[]>,
    ): LocalSearchResult[] => {
      const mergedMap = new Map<string, LocalSearchResult>();

      // Add filename results
      filenameResults.forEach((result) => {
        mergedMap.set(result.path, result);
      });

      // Add/merge content results
      contentResults.forEach((matches, filePath) => {
        const existing = mergedMap.get(filePath);

        if (existing) {
          // File matches both filename and content
          existing.matchTypes.add('content');
          existing.contentMatches = matches;
          existing.relevanceScore += 50; // Boost score for dual matches
        } else {
          // Content-only match
          const fileName = filePath.split('/').pop() || '';
          const relativePath = filePath
            .replace(baseDirectory, '')
            .replace(/^\//, '');

          mergedMap.set(filePath, {
            path: filePath,
            name: fileName,
            relativePath,
            matchTypes: new Set(['content']),
            contentMatches: matches,
            relevanceScore: 60,
          });
        }
      });

      // Sort by relevance score
      return Array.from(mergedMap.values()).sort(
        (a, b) => b.relevanceScore - a.relevanceScore,
      );
    },
    [baseDirectory],
  );

  // Perform local search
  const performLocalSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setTotalResults(0);
        return;
      }

      if (searchType === 'filename' || searchType === 'both') {
        const filenameResults = searchInFileTree(query);

        if (searchType === 'filename') {
          setSearchResults(filenameResults);
          setTotalResults(filenameResults.length);
        } else {
          // Show filename results immediately, content will come later
          setSearchResults(filenameResults);
          setTotalResults(filenameResults.length);
        }
      }
    },
    [searchType, searchInFileTree],
  );

  // Perform content search
  const performContentSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || searchType === 'filename') {
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        let results: LocalSearchResult[] = [];

        // Get existing filename results if in 'both' mode
        if (searchType === 'both') {
          results = searchInFileTree(query);
        }

        // Get files to search content in
        const allFiles = localSearchService.getAllFiles();
        console.log(
          `[LocalSearchPanel] Total indexed files: ${allFiles.length}`,
        );

        const filesToSearch = allFiles
          .filter((file) => {
            // Skip hidden directories unless explicitly searching in them
            if (
              !directoryFilter &&
              directoryFilters.length === 0 &&
              file.relativePath.startsWith('.')
            ) {
              return false;
            }

            // Apply multi-directory filters if present
            if (directoryFilters.length > 0) {
              if (!matchesDirectoryFilters(file.relativePath)) {
                return false;
              }
            } else if (directoryFilter) {
              // Fallback to single directory filter for backward compatibility
              const shouldInclude = excludeDirectory
                ? !file.relativePath.includes(directoryFilter)
                : file.relativePath.includes(directoryFilter);
              if (!shouldInclude) return false;
            }

            // Apply file type filter
            if (searchFileType) {
              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              if (ext !== searchFileType.toLowerCase()) return false;
            }

            return true;
          })
          .sort((a, b) => {
            // Prioritize source code files
            const sourceExtensions = [
              'ts',
              'tsx',
              'js',
              'jsx',
              'vue',
              'py',
              'java',
              'cpp',
              'c',
              'h',
              'hpp',
              'cs',
              'go',
              'rs',
              'swift',
              'kt',
            ];
            const aExt = a.name.split('.').pop()?.toLowerCase() || '';
            const bExt = b.name.split('.').pop()?.toLowerCase() || '';
            const aIsSource = sourceExtensions.includes(aExt);
            const bIsSource = sourceExtensions.includes(bExt);

            if (aIsSource && !bIsSource) return -1;
            if (!aIsSource && bIsSource) return 1;
            return 0;
          })
          .map((file) => file.path)
          .slice(0, 100); // Limit files to search

        console.log(
          `[LocalSearchPanel] Files to search after filtering: ${filesToSearch.length}`,
        );
        console.log(
          `[LocalSearchPanel] First few files:`,
          filesToSearch.slice(0, 5),
        );

        // Search content in files
        console.log(
          `[LocalSearchPanel] Calling searchFileContents with query: "${query}"`,
        );
        console.log(
          '[LocalSearchPanel] localSearchService available?',
          !!localSearchService,
        );
        console.log(
          '[LocalSearchPanel] searchFileContents method available?',
          !!localSearchService?.searchFileContents,
        );

        let contentResults: Map<string, ContentMatch[]>;
        try {
          contentResults = await localSearchService.searchFileContents(
            query,
            filesToSearch,
            { maxResults: 100, contextLines: 2 },
          );
        } catch (searchError) {
          console.error(
            '[LocalSearchPanel] Error during content search:',
            searchError,
          );
          console.error(
            '[LocalSearchPanel] Error stack:',
            searchError instanceof Error ? searchError.stack : 'No stack',
          );
          contentResults = new Map();
        }

        console.log(
          `[LocalSearchPanel] Content search returned ${contentResults.size} files with matches`,
        );

        // Merge results
        if (searchType === 'both') {
          results = mergeSearchResults(results, contentResults);
        } else {
          // Content-only search
          const contentOnlyResults: LocalSearchResult[] = [];
          contentResults.forEach((matches, filePath) => {
            const fileName = filePath.split('/').pop() || '';
            const relativePath = filePath
              .replace(baseDirectory, '')
              .replace(/^\//, '');

            contentOnlyResults.push({
              path: filePath,
              name: fileName,
              relativePath,
              matchTypes: new Set(['content']),
              contentMatches: matches,
              relevanceScore: 60,
            });
          });
          results = contentOnlyResults;
        }

        setSearchResults(results);
        setTotalResults(results.length);
      } catch (err: any) {
        console.error('Search error:', err);
        setSearchError('Failed to search content. Please try again.');
      } finally {
        setIsSearching(false);
      }
    },
    [
      searchType,
      searchInFileTree,
      mergeSearchResults,
      directoryFilter,
      excludeDirectory,
      searchFileType,
      baseDirectory,
      directoryFilters,
      matchesDirectoryFilters,
    ],
  );

  // Handle search input changes
  useEffect(() => {
    onSearchQueryChange?.(searchQuery);

    // Perform instant local search
    performLocalSearch(searchQuery);

    // Clear any existing timeout for content search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set up delayed content search (1 second for local files)
    if (
      searchQuery.trim() &&
      (searchType === 'content' || searchType === 'both')
    ) {
      searchTimeoutRef.current = setTimeout(() => {
        performContentSearch(searchQuery);
      }, 1000);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [
    searchQuery,
    searchType,
    performLocalSearch,
    performContentSearch,
    onSearchQueryChange,
  ]);

  // Reset search selection when results change
  useEffect(() => {
    setSelectedSearchIndex(-1);
    setIsSearchResultsFocused(false);
  }, [searchResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (
      isSearchResultsFocused &&
      selectedSearchIndex >= 0 &&
      searchResultsRef.current
    ) {
      const selectedElement = searchResultsRef.current.querySelector(
        `.search-result-item:nth-child(${selectedSearchIndex + 1})`,
      );
      selectedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSearchIndex, isSearchResultsFocused]);

  // Handle keyboard navigation for search results
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          if (
            e.target === searchInputRef.current &&
            !e.shiftKey &&
            searchResults.length > 0
          ) {
            e.preventDefault();
            setIsSearchResultsFocused(true);
            setSelectedSearchIndex(0);
            searchResultsRef.current?.focus();
          }
          break;
        case 'ArrowDown':
          if (isSearchResultsFocused && searchResults.length > 0) {
            e.preventDefault();
            setSelectedSearchIndex((prev) =>
              prev < searchResults.length - 1 ? prev + 1 : prev,
            );
          }
          break;
        case 'ArrowUp':
          if (isSearchResultsFocused && searchResults.length > 0) {
            e.preventDefault();
            setSelectedSearchIndex((prev) => (prev > 0 ? prev - 1 : 0));
          }
          break;
        case 'Enter':
          if (e.target === searchInputRef.current) {
            e.preventDefault();
            if (
              searchQuery.trim() &&
              (searchType === 'content' || searchType === 'both')
            ) {
              if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
              }
              performContentSearch(searchQuery);
            }
          } else if (isSearchResultsFocused && selectedSearchIndex >= 0) {
            e.preventDefault();
            const result = searchResults[selectedSearchIndex];
            const lineNumbers = result.contentMatches
              ?.map((match) => match.lineNumber)
              .filter(Boolean);
            // Use relativePath for remote repositories, path for local
            const pathToUse = result.relativePath || result.path;
            onFileSelect(pathToUse, lineNumbers, searchQuery);
          }
          break;
        case 'Escape':
          if (isSearchResultsFocused) {
            e.preventDefault();
            setIsSearchResultsFocused(false);
            setSelectedSearchIndex(-1);
            searchInputRef.current?.focus();
          }
          break;
      }
    },
    [
      searchResults,
      isSearchResultsFocused,
      selectedSearchIndex,
      onFileSelect,
      searchQuery,
      searchType,
      performContentSearch,
    ],
  );

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }, []);

  // Handle copy path
  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard
      .writeText(path)
      .then(() => {
        console.log('Path copied to clipboard:', path);
        setCopiedPath(path);
        setTimeout(() => setCopiedPath(null), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy path:', err);
      });
    setContextMenu(null);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Highlight matched text
  const highlightMatch = (text: string, match: string): React.ReactNode => {
    if (!match) return text;

    const escapedMatch = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedMatch})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span
          key={i}
          style={{
            backgroundColor: `${theme.colors.primary}40`,
            fontWeight: 'bold',
          }}
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Search Inputs */}
      <div style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
        {/* Directory Filter Input */}
        <div className="p-3 pb-2 relative">
          <div
            className="mb-1 text-xs flex items-center justify-between"
            style={{ color: theme.colors.textSecondary }}
          >
            <span>Directory Filter</span>
            {headerExtra && <div>{headerExtra}</div>}
          </div>
          <div className="relative flex items-center gap-2">
            <input
              ref={directoryInputRef}
              type="text"
              value={directoryFilter}
              onChange={(e) => {
                const { value } = e.target;
                setDirectoryFilter(value);
                suppressDropdownRef.current = false;
                onDirectoryFilterChange?.(value);
              }}
              onKeyDown={handleDirectoryKeyDown}
              onFocus={() =>
                setShowDirectoryDropdown(
                  directoryFilter.length > 0 && matchingDirectories.length > 0,
                )
              }
              onBlur={(e) => {
                setTimeout(() => {
                  if (
                    !directoryInputRef.current?.contains(document.activeElement)
                  ) {
                    setShowDirectoryDropdown(false);
                  }
                }, 200);
              }}
              placeholder="Type to filter by directory path"
              className="flex-1 px-3 py-2 text-sm rounded border transition-colors"
              style={{
                backgroundColor:
                  theme.colors.backgroundSecondary || theme.colors.background,
                borderColor:
                  directoryFilter && showDirectoryDropdown
                    ? theme.colors.primary
                    : theme.colors.border,
                color: theme.colors.text,
              }}
            />
            {directoryFilter && (
              <button
                onClick={() => setExcludeDirectory(!excludeDirectory)}
                className="px-3 py-2 text-xs font-medium rounded border transition-all"
                style={{
                  backgroundColor: excludeDirectory
                    ? `${theme.colors.primary}20`
                    : theme.colors.backgroundSecondary ||
                      theme.colors.background,
                  borderColor: excludeDirectory
                    ? theme.colors.primary
                    : theme.colors.border,
                  color: excludeDirectory
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                }}
                title={
                  excludeDirectory
                    ? 'Excluding files in this directory'
                    : 'Including only files in this directory'
                }
              >
                {excludeDirectory ? 'Exclude' : 'Include'}
              </button>
            )}
          </div>

          {/* Directory Dropdown */}
          {showDirectoryDropdown && matchingDirectories.length > 0 && (
            <div
              className="absolute z-10 w-full mt-1 rounded border shadow-lg max-h-64 overflow-y-auto"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.primary,
                boxShadow: `0 4px 6px -1px ${theme.colors.border}40`,
              }}
            >
              {matchingDirectories.map((dir, index) => (
                <div
                  key={dir.path}
                  className="px-3 py-2 cursor-pointer transition-colors text-sm"
                  style={{
                    backgroundColor:
                      index === selectedDirectoryIndex
                        ? `${theme.colors.primary}20`
                        : 'transparent',
                    color:
                      index === selectedDirectoryIndex
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                  }}
                  onMouseEnter={() => setSelectedDirectoryIndex(index)}
                  onClick={() => {
                    setDirectoryFilter(dir.displayPath);
                    onDirectoryFilterChange?.(dir.path);
                    setShowDirectoryDropdown(false);
                    directoryInputRef.current?.focus();
                  }}
                >
                  {dir.displayPath}
                </div>
              ))}
            </div>
          )}

          {/* Active Directory Filters */}
          {directoryFilters.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {directoryFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor:
                      filter.mode === 'include'
                        ? `${theme.colors.primary}20`
                        : `${theme.colors.error}20`,
                    border: `1px solid ${
                      filter.mode === 'include'
                        ? theme.colors.primary
                        : theme.colors.error
                    }`,
                    color: theme.colors.text,
                  }}
                >
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => toggleFilterMode(filter.id)}
                    title="Click to toggle include/exclude"
                  >
                    {filter.mode === 'include' ? '✓' : '✗'} {filter.path}
                  </span>
                  <button
                    onClick={() => removeDirectoryFilter(filter.id)}
                    className="ml-1 hover:opacity-70"
                    style={{ color: theme.colors.textSecondary }}
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Search Input */}
        <div
          className="p-3 pt-2"
          style={{ borderTop: `1px solid ${theme.colors.border}40` }}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search files and contents..."
                className="w-full px-3 py-2 pr-10 text-sm rounded border transition-colors"
                style={{
                  backgroundColor:
                    theme.colors.backgroundSecondary || theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <div
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: theme.colors.primary }}
                  />
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.colors.textSecondary}
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowSearchOptions(!showSearchOptions)}
              className="px-3 py-2 rounded border text-sm transition-all"
              style={{
                backgroundColor: showSearchOptions
                  ? `${theme.colors.primary}20`
                  : theme.colors.backgroundSecondary || theme.colors.background,
                borderColor: showSearchOptions
                  ? theme.colors.primary
                  : theme.colors.border,
                color: showSearchOptions
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              }}
              title="Advanced search options"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
            </button>
          </div>

          {/* Search hints */}
          <div
            className="mt-1 text-xs"
            style={{ color: theme.colors.textSecondary }}
          >
            {searchType === 'filename'
              ? 'Searching filenames only • Supports wildcards: *.tsx, test?.js'
              : searchType === 'content'
                ? 'Press Enter to search file contents or wait 1 second'
                : 'Filename search is instant • Press Enter for content search'}
          </div>
          {searchError && (
            <div className="mt-1 text-xs" style={{ color: theme.colors.error }}>
              {searchError}
            </div>
          )}

          {/* Advanced Options Panel */}
          {showSearchOptions && (
            <div
              className="mt-2 space-y-2 p-2 rounded"
              style={{
                backgroundColor: `${theme.colors.backgroundSecondary}50`,
              }}
            >
              {/* Search Type */}
              <div className="flex items-center gap-2">
                <label
                  className="text-xs"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Search in:
                </label>
                <select
                  value={searchType}
                  onChange={(e) =>
                    setSearchType(
                      e.target.value as 'content' | 'filename' | 'both',
                    )
                  }
                  className="text-xs px-2 py-1 rounded border"
                  style={{
                    backgroundColor:
                      theme.colors.backgroundSecondary ||
                      theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  }}
                >
                  <option value="both">Files & Content</option>
                  <option value="filename">Filenames Only</option>
                  <option value="content">Content Only</option>
                </select>
              </div>

              {/* File Type Filter */}
              <div className="flex items-center gap-2">
                <label
                  className="text-xs"
                  style={{ color: theme.colors.textSecondary }}
                >
                  File type:
                </label>
                <input
                  type="text"
                  value={searchFileType}
                  onChange={(e) => setSearchFileType(e.target.value)}
                  placeholder="e.g., tsx, js, md"
                  className="text-xs px-2 py-1 rounded border flex-1"
                  style={{
                    backgroundColor:
                      theme.colors.backgroundSecondary ||
                      theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div
        ref={searchResultsRef}
        className="flex-1 overflow-y-auto focus:outline-none"
        tabIndex={-1}
        onKeyDown={handleSearchKeyDown}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement !== searchInputRef.current) {
              setIsSearchResultsFocused(false);
              setSelectedSearchIndex(-1);
            }
          }, 100);
        }}
      >
        {!searchQuery && searchResults.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              {/* Animated search icon */}
              <div className="mb-6 relative inline-block">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="animate-pulse"
                  style={{ color: theme.colors.primary }}
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    className="animate-spin"
                    style={{ animationDuration: '8s' }}
                  />
                  <path
                    d="m21 21-4.35-4.35"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Floating dots */}
                <div
                  className="absolute top-2 right-0 w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: theme.colors.primary,
                    animationDelay: '0s',
                    animationDuration: '2s',
                  }}
                />
                <div
                  className="absolute bottom-0 left-2 w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{
                    backgroundColor: theme.colors.primary,
                    opacity: 0.6,
                    animationDelay: '0.5s',
                    animationDuration: '2s',
                  }}
                />
                <div
                  className="absolute top-4 left-0 w-1 h-1 rounded-full animate-bounce"
                  style={{
                    backgroundColor: theme.colors.primary,
                    opacity: 0.4,
                    animationDelay: '1s',
                    animationDuration: '2s',
                  }}
                />
              </div>

              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: theme.colors.text }}
              >
                Start searching your code
              </h3>

              <p
                className="text-sm mb-4"
                style={{ color: theme.colors.textSecondary }}
              >
                Search through filenames and content to find what you need
              </p>

              <div className="space-y-3 text-left">
                <div className="flex items-start gap-2">
                  <span
                    className="text-xs mt-0.5"
                    style={{ color: theme.colors.primary }}
                  >
                    💡
                  </span>
                  <div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: theme.colors.text }}
                    >
                      Quick filename search
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Type to instantly filter by filename
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span
                    className="text-xs mt-0.5"
                    style={{ color: theme.colors.primary }}
                  >
                    🔍
                  </span>
                  <div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: theme.colors.text }}
                    >
                      Deep content search
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Press Enter or wait 1 second to search inside files
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span
                    className="text-xs mt-0.5"
                    style={{ color: theme.colors.primary }}
                  >
                    📁
                  </span>
                  <div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: theme.colors.text }}
                    >
                      Filter by directory
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Use the directory filter above to narrow your search
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="mt-6 pt-4 border-t"
                style={{ borderColor: `${theme.colors.border}40` }}
              >
                <div
                  className="text-xs"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Pro tip: Use{' '}
                  <code
                    className="px-1 py-0.5 rounded"
                    style={{ backgroundColor: `${theme.colors.primary}20` }}
                  >
                    *.tsx
                  </code>{' '}
                  for wildcards
                </div>
              </div>
            </div>
          </div>
        ) : searchQuery && searchResults.length === 0 && !isSearching ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              {/* Empty state icon */}
              <div className="mb-4">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mx-auto opacity-50"
                  style={{ color: theme.colors.textSecondary }}
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="m21 21-4.35-4.35"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 11h6M11 8v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h3
                className="text-base font-medium mb-2"
                style={{ color: theme.colors.text }}
              >
                No results found
              </h3>

              <p
                className="text-sm mb-4"
                style={{ color: theme.colors.textSecondary }}
              >
                No files match{' '}
                <span
                  className="font-mono"
                  style={{ color: theme.colors.primary }}
                >
                  "{searchQuery}"
                </span>
              </p>

              <div
                className="space-y-2 text-sm"
                style={{ color: theme.colors.textSecondary }}
              >
                <p>Try:</p>
                <ul className="text-left space-y-1">
                  <li>• Checking your spelling</li>
                  <li>• Using different keywords</li>
                  <li>• Removing directory filters</li>
                  {searchType === 'filename' && (
                    <li>• Searching in file contents instead</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {searchResults.map((result, index) => {
              const isCurrentFile = selectedFile === result.path;
              const isSelected =
                isSearchResultsFocused && index === selectedSearchIndex;

              return (
                <div
                  key={`${result.path}-${index}`}
                  className="search-result-item group px-3 py-2 hover:bg-opacity-10 cursor-pointer transition-colors relative"
                  style={{
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}25`
                      : isCurrentFile
                        ? `${theme.colors.primary}15`
                        : 'transparent',
                    borderLeft: isCurrentFile
                      ? `3px solid ${theme.colors.primary}`
                      : isSelected
                        ? `3px solid ${theme.colors.primary}80`
                        : '3px solid transparent',
                    borderBottom: `1px solid ${theme.colors.border}20`,
                  }}
                  onClick={() => {
                    const lineNumbers = result.contentMatches
                      ?.map((match) => match.lineNumber)
                      .filter(Boolean);
                    // Use relativePath for remote repositories, path for local
                    const pathToUse = result.relativePath || result.path;
                    onFileSelect(pathToUse, lineNumbers, searchQuery);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, result.path)}
                  onMouseEnter={() => {
                    if (isSearchResultsFocused) {
                      setSelectedSearchIndex(index);
                    }
                    // Notify parent about hover
                    onSearchResultHover?.(result.relativePath);
                  }}
                  onMouseLeave={() => {
                    // Clear hover when leaving
                    onSearchResultHover?.(null);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {result.matchTypes.has('filename') &&
                      result.matchTypes.has('content') ? (
                        <span
                          title="Matches in both filename and content"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <FileText size={14} />
                          <Sparkles size={12} />
                        </span>
                      ) : result.matchTypes.has('filename') ? (
                        <span title="Filename match">
                          <FileText size={14} />
                        </span>
                      ) : (
                        <span title="Content match">
                          <Search size={14} />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className="text-sm font-medium"
                              style={{ color: theme.colors.text }}
                            >
                              {result.filenameMatch
                                ? highlightMatch(result.name, searchQuery)
                                : result.name}
                            </div>
                            {isCurrentFile && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${theme.colors.primary}20`,
                                  color: theme.colors.primary,
                                  fontSize: '10px',
                                }}
                              >
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div
                            className="text-xs mt-0.5"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            {result.relativePath}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {/* Open in IDE button */}
                          {onOpenInEditor && (
                            <button
                              className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-all"
                              style={{
                                backgroundColor:
                                  theme.colors.backgroundSecondary ||
                                  theme.colors.background,
                                border: `1px solid ${theme.colors.border}`,
                                color: theme.colors.textSecondary,
                                opacity:
                                  isSelected || isCurrentFile ? 0.7 : undefined,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
                                e.currentTarget.style.borderColor =
                                  theme.colors.primary;
                                e.currentTarget.style.color =
                                  theme.colors.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '';
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.backgroundSecondary ||
                                  theme.colors.background;
                                e.currentTarget.style.borderColor =
                                  theme.colors.border;
                                e.currentTarget.style.color =
                                  theme.colors.textSecondary;
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenInEditor(result.path);
                              }}
                              title={`Open in ${selectedEditor || 'IDE'}`}
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}
                          {/* Copy path button */}
                          <button
                            className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-all"
                            style={{
                              backgroundColor:
                                copiedPath === result.path
                                  ? `${theme.colors.success}20`
                                  : theme.colors.backgroundSecondary ||
                                    theme.colors.background,
                              border: `1px solid ${copiedPath === result.path ? theme.colors.success : theme.colors.border}`,
                              color:
                                copiedPath === result.path
                                  ? theme.colors.success
                                  : theme.colors.textSecondary,
                              opacity:
                                isSelected ||
                                isCurrentFile ||
                                copiedPath === result.path
                                  ? 0.7
                                  : undefined,
                            }}
                            onMouseEnter={(e) => {
                              if (copiedPath !== result.path) {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
                                e.currentTarget.style.borderColor =
                                  theme.colors.primary;
                                e.currentTarget.style.color =
                                  theme.colors.primary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (copiedPath !== result.path) {
                                e.currentTarget.style.opacity = '';
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.backgroundSecondary ||
                                  theme.colors.background;
                                e.currentTarget.style.borderColor =
                                  theme.colors.border;
                                e.currentTarget.style.color =
                                  theme.colors.textSecondary;
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPath(result.path);
                            }}
                            title={
                              copiedPath === result.path
                                ? 'Copied!'
                                : 'Copy full path'
                            }
                          >
                            {copiedPath === result.path ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      {result.contentMatches &&
                        result.contentMatches.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {result.contentMatches
                              .slice(0, 2)
                              .map((match, i) => (
                                <div
                                  key={i}
                                  className="text-xs p-1 rounded font-mono"
                                  style={{
                                    backgroundColor:
                                      theme.colors.backgroundSecondary ||
                                      theme.colors.background,
                                    color: theme.colors.textSecondary,
                                  }}
                                >
                                  <span
                                    style={{
                                      color: theme.colors.textSecondary,
                                    }}
                                  >
                                    L{match.lineNumber}:
                                  </span>{' '}
                                  {highlightMatch(
                                    match.snippet.length > 100
                                      ? `${match.snippet.substring(0, 100)}...`
                                      : match.snippet,
                                    searchQuery,
                                  )}
                                </div>
                              ))}
                            {result.contentMatches.length > 2 && (
                              <div
                                className="text-xs"
                                style={{ color: theme.colors.textSecondary }}
                              >
                                +{result.contentMatches.length - 2} more matches
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {searchQuery && totalResults > 0 && (
        <div
          className="px-3 py-2 border-t text-xs"
          style={{
            borderColor: theme.colors.border,
            color: theme.colors.textSecondary,
            backgroundColor:
              theme.colors.backgroundSecondary || theme.colors.background,
          }}
        >
          <div className="flex items-center justify-between">
            <span>
              Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "
              {searchQuery}"
            </span>
            {(searchType !== 'both' ||
              searchFileType ||
              directoryFilter ||
              directoryFilters.length > 0) && (
              <span className="flex items-center gap-2">
                {searchType !== 'both' && (
                  <span
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${theme.colors.primary}20`,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {searchType}
                  </span>
                )}
                {searchFileType && (
                  <span
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${theme.colors.primary}20`,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    .{searchFileType}
                  </span>
                )}
                {directoryFilters.length > 0 ? (
                  <span
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${theme.colors.primary}20`,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {directoryFilters.length} filter
                    {directoryFilters.length !== 1 ? 's' : ''}
                  </span>
                ) : (
                  directoryFilter && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${theme.colors.primary}20`,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {excludeDirectory ? 'outside' : 'in'} {directoryFilter}
                    </span>
                  )
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '200px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 hover:bg-opacity-10 text-sm transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.colors.text,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => handleCopyPath(contextMenu.path)}
          >
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy Full Path</span>
            </div>
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-opacity-10 text-sm transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.colors.text,
              borderTop: `1px solid ${theme.colors.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => {
              const relativePath = contextMenu.path
                .replace(baseDirectory, '')
                .replace(/^\//, '');
              handleCopyPath(relativePath);
            }}
          >
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <span>Copy Relative Path</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
