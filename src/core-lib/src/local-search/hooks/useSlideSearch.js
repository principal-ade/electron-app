import { useState, useEffect, useCallback, useRef } from 'react';
export function useSlideSearch(searchEngine, options = {}) {
    const { debounceMs = 300, searchOptions = {} } = options;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [totalDocuments, setTotalDocuments] = useState(0);
    const [error, setError] = useState();
    // Convert SearchResult to SlideSearchMatch
    const convertToSlideSearchMatch = useCallback((results) => {
        return results.map(result => {
            // Convert MatchInfo to MatchDetail
            const matchDetails = result.matches.map((match) => {
                // Determine match type based on field
                const type = match.field === 'title'
                    ? 'title'
                    : match.field === 'content' && result.type === 'code'
                        ? 'code'
                        : 'content';
                // Extract line and column from content
                const lines = result.content.split('\n');
                let lineNumber = 0;
                let columnNumber = 0;
                if (match.position) {
                    let currentPos = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const lineLength = lines[i].length + 1;
                        if (currentPos + lineLength > match.position.start) {
                            lineNumber = i;
                            columnNumber = match.position.start - currentPos;
                            break;
                        }
                        currentPos += lineLength;
                    }
                }
                return {
                    type,
                    searchTerm: searchQuery,
                    matchedText: match.matchedText,
                    position: {
                        start: match.position?.start || 0,
                        end: match.position?.end || 0,
                        line: lineNumber,
                        column: columnNumber,
                    },
                    context: {
                        before: match.context.before,
                        after: match.context.after,
                        fullLine: lines[lineNumber] || '',
                    },
                    metadata: result.type === 'code' ? { blockType: 'code', language: result.language } : undefined,
                };
            });
            // Determine relevance
            const relevance = {
                titleMatch: result.matches.some(m => m.field === 'title'),
                contentMatch: result.matches.some(m => m.field === 'content'),
                codeMatch: result.type === 'code' || matchDetails.some(m => m.type === 'code'),
            };
            // Convert to SlideSearchMatch
            return {
                slide: result, // SearchResult needs proper conversion to SlideDocument
                matches: matchDetails,
                score: result.score,
                relevance,
            };
        });
    }, []);
    // Store search function in a ref to avoid recreating it
    const searchEngineRef = useRef(searchEngine);
    const searchOptionsRef = useRef(searchOptions);
    const convertToSlideSearchMatchRef = useRef(convertToSlideSearchMatch);
    // Update refs when dependencies change
    useEffect(() => {
        searchEngineRef.current = searchEngine;
        searchOptionsRef.current = searchOptions;
        convertToSlideSearchMatchRef.current = convertToSlideSearchMatch;
    }, [searchEngine, searchOptions, convertToSlideSearchMatch]);
    // Perform search - stable function that doesn't change
    const performSearch = useCallback(async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            setError(undefined);
            return;
        }
        setIsSearching(true);
        setError(undefined);
        try {
            const results = await searchEngineRef.current.search(query, {
                limit: searchOptionsRef.current.limit || 50,
                fuzzyThreshold: searchOptionsRef.current.fuzzyThreshold,
                types: ['slide'], // For now, only search slides
                ...searchOptionsRef.current,
            });
            const slideMatches = convertToSlideSearchMatchRef.current(results);
            setSearchResults(slideMatches);
        }
        catch (err) {
            console.error('Search error:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
            setSearchResults([]);
        }
        finally {
            setIsSearching(false);
        }
    }, []);
    // Get total documents count
    useEffect(() => {
        const getStats = async () => {
            try {
                const stats = await searchEngine.getStats();
                if (stats) {
                    setTotalDocuments(stats.totalSlides);
                }
            }
            catch (err) {
                console.error('Failed to get search stats:', err);
            }
        };
        getStats();
    }, [searchEngine]);
    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch(searchQuery);
        }, debounceMs);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, debounceMs, performSearch]);
    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        totalDocuments,
        error,
        // Additional utilities
        performSearch,
        clearResults: () => {
            setSearchResults([]);
            setSearchQuery('');
        },
    };
}
