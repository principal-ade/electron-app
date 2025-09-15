import FlexSearch from 'flexsearch';
import { LocalFileSystemProvider } from './ContentProviders';
class LocalSearchService {
    fileIndex; // FlexSearch.Document<FileDocument>
    initialized = false;
    documentsMap = new Map();
    baseDirectory = '';
    contentProvider;
    constructor() {
        // Default to local filesystem provider
        this.contentProvider = new LocalFileSystemProvider();
        // Initialize FlexSearch with optimized settings for code search
        this.fileIndex = new FlexSearch.Document({
            document: {
                id: 'id',
                index: [
                    {
                        field: 'name',
                        tokenize: 'forward', // Good for filename matching
                        resolution: 9,
                        minlength: 1,
                    },
                    {
                        field: 'path',
                        tokenize: 'forward', // Good for path matching
                        resolution: 7,
                        minlength: 2,
                    },
                    {
                        field: 'content',
                        tokenize: 'forward',
                        resolution: 5,
                        minlength: 3,
                        context: {
                            depth: 2,
                            resolution: 3,
                        },
                    },
                ],
            },
            tokenize: 'forward',
            cache: true,
            resolution: 9,
            context: true,
        });
    }
    /**
     * Set the content provider for this search service
     */
    setContentProvider(provider) {
        this.contentProvider = provider;
    }
    /**
     * Get current content provider
     */
    getContentProvider() {
        return this.contentProvider;
    }
    /**
     * Check if content search is available
     */
    canSearchContent() {
        return this.contentProvider.canProvideContent();
    }
    /**
     * Index files from FileTree
     */
    async indexFileSystemTree(tree, baseDirectory) {
        this.baseDirectory = baseDirectory;
        // Clear existing index and map
        this.fileIndex.clear();
        this.documentsMap.clear();
        // Index all files
        let index = 0;
        for (const file of tree.allFiles) {
            // Construct absolute path by joining baseDirectory with the file path
            const absolutePath = file.path.startsWith('/')
                ? file.path
                : `${baseDirectory}/${file.path}`.replace(/\/+/g, '/');
            const doc = {
                id: index.toString(),
                path: absolutePath,
                name: file.name,
                relativePath: file.relativePath,
                content: '', // Content will be loaded on-demand
            };
            this.fileIndex.add(doc);
            this.documentsMap.set(doc.id, doc);
            index++;
        }
        this.initialized = true;
    }
    /**
     * Convert glob pattern to regex
     */
    globToRegex(pattern) {
        const escapedPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and ?
            .replace(/\*/g, '.*') // * matches any characters
            .replace(/\?/g, '.'); // ? matches single character
        return new RegExp(`^${escapedPattern}$`, 'i');
    }
    /**
     * Check if query contains wildcards
     */
    hasWildcards(query) {
        return query.includes('*') || query.includes('?');
    }
    /**
     * Search files using FlexSearch or wildcard matching
     */
    search(query, options) {
        if (!this.initialized || !query.trim()) {
            return [];
        }
        const limit = options?.limit || 100;
        const searchIn = options?.searchIn || ['name', 'path'];
        // Handle wildcard queries
        if (this.hasWildcards(query)) {
            return this.wildcardSearch(query, options);
        }
        // Regular FlexSearch query
        const results = [];
        const seen = new Set();
        // Search in each specified field
        searchIn.forEach((field) => {
            const fieldResults = this.fileIndex.search(query, {
                index: field,
                limit,
                enrich: true,
            });
            fieldResults.forEach((result) => {
                if (result.result) {
                    result.result.forEach((item) => {
                        // FlexSearch might return just IDs or documents
                        const docId = typeof item === 'string' ? item : item.id;
                        const doc = typeof item === 'string'
                            ? this.documentsMap.get(docId)
                            : item.doc || this.documentsMap.get(docId);
                        if (!doc) {
                            return; // Skip if document not found
                        }
                        // Apply filters
                        if (!this.matchesFilters(doc, options)) {
                            return;
                        }
                        if (!seen.has(doc.path)) {
                            seen.add(doc.path);
                            results.push({
                                path: doc.path,
                                name: doc.name,
                                relativePath: doc.relativePath,
                                score: 100 - results.length, // Higher score for earlier results
                                matches: [
                                    {
                                        field: field,
                                        positions: [], // FlexSearch doesn't provide exact positions
                                    },
                                ],
                            });
                        }
                    });
                }
            });
        });
        return results.slice(0, limit);
    }
    /**
     * Perform wildcard search using regex
     */
    wildcardSearch(pattern, options) {
        const regex = this.globToRegex(pattern);
        const results = [];
        const limit = options?.limit || 100;
        // Iterate through our stored documents
        this.documentsMap.forEach((doc) => {
            if (doc && doc.name && regex.test(doc.name)) {
                // Apply filters
                if (!this.matchesFilters(doc, options)) {
                    return;
                }
                results.push({
                    path: doc.path,
                    name: doc.name,
                    relativePath: doc.relativePath,
                    score: 90, // Good score for wildcard matches
                    matches: [
                        {
                            field: 'name',
                            positions: [],
                        },
                    ],
                });
            }
        });
        return results.slice(0, limit);
    }
    /**
     * Check if document matches filter options
     */
    matchesFilters(doc, options) {
        // Directory filter - use relative path for filtering
        if (options?.directoryFilter) {
            const shouldInclude = options.excludeDirectory
                ? !doc.relativePath.includes(options.directoryFilter)
                : doc.relativePath.includes(options.directoryFilter);
            if (!shouldInclude)
                return false;
        }
        // File type filter
        if (options?.fileType) {
            const fileExtension = doc.name.split('.').pop()?.toLowerCase() || '';
            if (fileExtension !== options.fileType.toLowerCase()) {
                return false;
            }
        }
        return true;
    }
    /**
     * Search file contents using Electron's file reading
     */
    async searchFileContents(query, files, options) {
        try {
            const results = new Map();
            const maxResults = options?.maxResults || 100;
            const contextLines = options?.contextLines || 2;
            let totalMatches = 0;
            // Return early with empty results to test if the method is being called
            if (!query || files.length === 0) {
                return results;
            }
            // Create regex for searching
            const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            for (const filePath of files) {
                if (totalMatches >= maxResults)
                    break;
                try {
                    // Skip binary files based on extension
                    const ext = filePath.split('.').pop()?.toLowerCase() || '';
                    const binaryExtensions = [
                        'png',
                        'jpg',
                        'jpeg',
                        'gif',
                        'bmp',
                        'ico',
                        'pdf',
                        'zip',
                        'tar',
                        'gz',
                        'exe',
                        'dll',
                        'so',
                        'dylib',
                        'woff',
                        'woff2',
                        'ttf',
                        'eot',
                        'mp3',
                        'mp4',
                        'avi',
                        'mov',
                        'bin',
                        'dat',
                        'db',
                        'sqlite',
                        'protos',
                    ];
                    if (binaryExtensions.includes(ext)) {
                        continue;
                    }
                    // Use content provider to read file
                    const textContent = await this.contentProvider.readFileContent(filePath);
                    if (!textContent) {
                        continue;
                    }
                    const lines = textContent.split('\n');
                    const fileMatches = [];
                    lines.forEach((line, index) => {
                        if (totalMatches >= maxResults)
                            return;
                        const matches = [...line.matchAll(searchRegex)];
                        if (matches.length > 0) {
                            // Get context lines
                            const startLine = Math.max(0, index - contextLines);
                            const endLine = Math.min(lines.length - 1, index + contextLines);
                            const contextSnippet = lines
                                .slice(startLine, endLine + 1)
                                .join('\n');
                            fileMatches.push({
                                snippet: contextSnippet,
                                lineNumber: index + 1, // 1-based line numbers
                                matchedText: matches[0][0],
                            });
                            totalMatches++;
                        }
                    });
                    if (fileMatches.length > 0) {
                        results.set(filePath, fileMatches);
                        console.log(`[LocalSearchService] Found ${fileMatches.length} matches in ${filePath}`);
                    }
                }
                catch (error) {
                    console.error(`Error reading file ${filePath}:`, error);
                }
            }
            console.log(`[LocalSearchService] Content search complete. Found matches in ${results.size} files, total matches: ${totalMatches}`);
            return results;
        }
        catch (error) {
            console.error('[LocalSearchService] CAUGHT ERROR in searchFileContents:', error);
            console.error('[LocalSearchService] Error stack:', error instanceof Error ? error.stack : 'No stack');
            return new Map();
        }
    }
    /**
     * Get suggestions for partial queries
     */
    suggest(query, field = 'name', limit = 10) {
        if (!this.initialized || !query.trim()) {
            return [];
        }
        const results = this.fileIndex.search(query, {
            index: field,
            limit,
            suggest: true,
        });
        const suggestions = [];
        results.forEach((result) => {
            if (result.result) {
                result.result.forEach((item) => {
                    const doc = this.documentsMap.get(item.id || item);
                    if (doc) {
                        if (field === 'name') {
                            suggestions.push(doc.name);
                        }
                        else {
                            suggestions.push(doc.relativePath);
                        }
                    }
                });
            }
        });
        return [...new Set(suggestions)].slice(0, limit);
    }
    /**
     * Clear the search index
     */
    clear() {
        this.fileIndex.clear();
        this.documentsMap.clear();
        this.initialized = false;
    }
    /**
     * Get all indexed files
     */
    getAllFiles() {
        return Array.from(this.documentsMap.values());
    }
}
// Export singleton instance
export const localSearchService = new LocalSearchService();
