/**
 * FlexSearch implementation of SearchEngineAdapter
 * High-performance full-text search library
 */
import * as FlexSearch from 'flexsearch';
// Debug logging utility - set to true to enable verbose FlexSearch logs
const DEBUG_FLEXSEARCH = false;
const debugLog = (...args) => {
    if (DEBUG_FLEXSEARCH) {
        console.log(...args);
    }
};
export class FlexSearchAdapter {
    constructor(options) {
        this.documents = new Map();
        this.indexCleared = false; // Track if index has been cleared for this session
        this.sessionId = Math.random().toString(36).substring(7); // Debug session tracking
        this.options = {
            preset: 'performance',
            tokenize: 'forward',
            resolution: 9,
            context: true,
            optimize: true,
            ...options,
        };
    }
    async initialize(options) {
        const mergedOptions = { ...this.options, ...options };
        // Create FlexSearch Document index with multiple fields
        this.index = new FlexSearch.Document({
            document: {
                id: 'id',
                index: [
                    {
                        field: 'content',
                        tokenize: mergedOptions.tokenize,
                        resolution: mergedOptions.resolution,
                        context: mergedOptions.context,
                    },
                    {
                        field: 'title',
                        tokenize: 'forward',
                    },
                    {
                        field: 'fileName',
                        tokenize: 'strict',
                    },
                ],
                store: ['id', 'type', 'fileUri', 'fileName', 'filePath', 'slideIndex'],
            },
        });
    }
    async addDocuments(documents) {
        const timestamp = new Date().toISOString();
        const logPrefix = `[FlexSearchAdapter:${this.sessionId}:${timestamp}]`;
        debugLog(`${logPrefix} ===== addDocuments() called with ${documents.length} documents =====`);
        debugLog(`${logPrefix} Current indexCleared status: ${this.indexCleared}`);
        if (!this.index) {
            throw new Error('Search engine not initialized');
        }
        // IMPORTANT: Only clear on the first call, not on every batch
        if (!this.indexCleared) {
            debugLog(`${logPrefix} 🔥 CLEARING INDEX - First batch detected! indexCleared=${this.indexCleared}`);
            await this.clear();
            this.indexCleared = true;
            debugLog(`${logPrefix} ✅ Index cleared, indexCleared now set to: ${this.indexCleared}`);
        }
        else {
            debugLog(`${logPrefix} ➕ Adding to existing index (subsequent batch), indexCleared=${this.indexCleared}`);
        }
        debugLog(`${logPrefix} About to process ${documents.length} documents...`);
        // Add documents to internal map and index (don't clear existing ones)
        for (const doc of documents) {
            debugLog(`[FlexSearchAdapter] Processing document: ${doc.id} - ${doc.title || doc.fileName}`);
            this.documents.set(doc.id, doc);
            debugLog(`[FlexSearchAdapter] Stored in documents Map with ID: "${doc.id}"`);
            // Prepare document for FlexSearch
            const indexDoc = {
                id: doc.id,
                content: doc.content,
                title: doc.title || '',
                type: doc.type,
                fileUri: doc.fileUri,
                fileName: doc.fileName,
                filePath: doc.filePath,
                slideIndex: doc.slideIndex ?? 0, // Ensure not undefined
            };
            // Debug logging - uncomment for debugging indexing issues
            // debugLog(`[FlexSearchAdapter] Adding to FlexSearch index:`, {
            //   id: indexDoc.id,
            //   contentLength: indexDoc.content.length,
            //   title: indexDoc.title,
            //   type: indexDoc.type,
            // });
            this.index.add(indexDoc);
        }
        debugLog(`[FlexSearchAdapter] Successfully added ${documents.length} documents to index`);
        debugLog(`[FlexSearchAdapter] Documents map size: ${this.documents.size}`);
        debugLog(`[FlexSearchAdapter] First 5 document IDs in Map:`, Array.from(this.documents.keys()).slice(0, 5));
    }
    async removeDocuments(ids) {
        if (!this.index) {
            throw new Error('Search engine not initialized');
        }
        for (const id of ids) {
            this.documents.delete(id);
            this.index.remove(id);
        }
    }
    async search(query, options) {
        debugLog('[FlexSearchAdapter] Starting search with query:', query, 'options:', options);
        if (!this.index) {
            console.error('[FlexSearchAdapter] Search engine not initialized');
            throw new Error('Search engine not initialized');
        }
        if (!query || query.trim().length === 0) {
            debugLog('[FlexSearchAdapter] Empty query, returning empty results');
            return [];
        }
        debugLog('[FlexSearchAdapter] Total documents in memory:', this.documents.size);
        debugLog('[FlexSearchAdapter] Document IDs:', Array.from(this.documents.keys()).slice(0, 5));
        // Prepare search options
        const searchOptions = {
            limit: options?.limit || 50,
            threshold: options?.fuzzyThreshold !== undefined ? options.fuzzyThreshold : 0.5,
            where: undefined,
        };
        // Add type filtering if specified
        if (options?.types && options.types.length > 0) {
            searchOptions.where = {
                type: options.types,
            };
        }
        debugLog('[FlexSearchAdapter] Search options:', searchOptions);
        // Perform search across all indexed fields
        const fields = options?.fields || ['content', 'title', 'fileName'];
        const results = new Map();
        debugLog('[FlexSearchAdapter] Searching fields:', fields);
        // Search each field
        for (const field of fields) {
            debugLog(`[FlexSearchAdapter] Searching field: ${field}`);
            const fieldResults = this.index.search(query, {
                ...searchOptions,
                index: field,
                suggest: true, // Enable suggestions for fuzzy matching
            });
            debugLog(`[FlexSearchAdapter] Field "${field}" returned:`, fieldResults);
            debugLog(`[FlexSearchAdapter] Field "${field}" results type:`, typeof fieldResults);
            if (Array.isArray(fieldResults) && fieldResults.length > 0) {
                debugLog(`[FlexSearchAdapter] First result structure:`, JSON.stringify(fieldResults[0]));
            }
            // Process results from this field
            if (Array.isArray(fieldResults)) {
                debugLog(`[FlexSearchAdapter] Processing ${fieldResults.length} results from field "${field}"`);
                for (const result of fieldResults) {
                    // FlexSearch Document search returns different formats depending on configuration
                    let resultId = '';
                    let resultScore = 1;
                    debugLog(`[FlexSearchAdapter] Processing result:`, result, 'type:', typeof result);
                    // Check if it's a Document search result with nested structure
                    if (typeof result === 'object' && result !== null) {
                        // Try different possible structures
                        if ('id' in result) {
                            // Standard document result: { id: string, ... }
                            resultId = String(result.id);
                            if ('score' in result && typeof result.score === 'number') {
                                resultScore = result.score;
                            }
                        }
                        else if ('result' in result && Array.isArray(result.result)) {
                            // Field-specific result: { field: string, result: string[] }
                            // Take the first result ID from the array
                            if (result.result.length > 0) {
                                resultId = String(result.result[0]);
                            }
                        }
                        else {
                            // Unknown object structure - log it for debugging
                            debugLog(`[FlexSearchAdapter] Unknown result object structure:`, JSON.stringify(result));
                        }
                        debugLog(`[FlexSearchAdapter] Document result ID: "${resultId}", score: ${resultScore}`);
                    }
                    else if (typeof result === 'string') {
                        // Simple string ID result (fallback)
                        resultId = result;
                        debugLog(`[FlexSearchAdapter] Simple string result: "${resultId}"`);
                    }
                    else if (typeof result === 'number') {
                        // Numeric ID result - convert to string
                        resultId = String(result);
                        debugLog(`[FlexSearchAdapter] Numeric result converted: "${resultId}"`);
                    }
                    if (resultId) {
                        debugLog(`[FlexSearchAdapter] Checking if document ID "${resultId}" exists in documents Map...`);
                        debugLog(`[FlexSearchAdapter] Documents Map has ID "${resultId}":`, this.documents.has(resultId));
                        const existingResult = results.get(resultId);
                        if (existingResult) {
                            // Combine scores and matches from multiple fields
                            existingResult.score = Math.max(existingResult.score, resultScore);
                            existingResult.matches.push({ field, result });
                            debugLog(`[FlexSearchAdapter] Updated existing result for "${resultId}", new score: ${existingResult.score}`);
                        }
                        else {
                            results.set(resultId, {
                                score: resultScore,
                                matches: [{ field, result }],
                            });
                            debugLog(`[FlexSearchAdapter] Added new result for "${resultId}", score: ${resultScore}`);
                        }
                    }
                }
            }
        }
        // Convert to SearchResult format
        const searchResults = [];
        debugLog(`[FlexSearchAdapter] Converting ${results.size} matched document IDs to SearchResults`);
        for (const [id, resultData] of results.entries()) {
            const { score, matches } = resultData;
            const doc = this.documents.get(id);
            if (!doc) {
                console.warn(`[FlexSearchAdapter] Document ${id} not found in documents map!`);
                continue;
            }
            debugLog(`[FlexSearchAdapter] Processing document ${id}: ${doc.title || doc.fileName}`);
            // Extract match information
            const matchInfos = [];
            for (const { field } of matches) {
                // FlexSearch doesn't provide detailed match info by default
                // We'll create a simple match based on the field content
                const fieldContent = field === 'content' ? doc.content : field === 'title' ? doc.title || '' : doc.fileName;
                const matchInfo = this.createMatchInfo(query, fieldContent, field);
                if (matchInfo) {
                    matchInfos.push(matchInfo);
                }
            }
            searchResults.push({
                ...doc,
                score,
                matches: matchInfos,
                highlights: this.createHighlights(doc.content, query),
            });
        }
        debugLog(`[FlexSearchAdapter] Final search results count: ${searchResults.length}`);
        debugLog(`[FlexSearchAdapter] Sample results:`, searchResults.slice(0, 2).map(r => ({ id: r.id, title: r.title, score: r.score })));
        // Sort by score
        searchResults.sort((a, b) => b.score - a.score);
        // Apply limit
        if (options?.limit) {
            return searchResults.slice(0, options.limit);
        }
        return searchResults;
    }
    async exportIndex() {
        if (!this.index) {
            throw new Error('Search engine not initialized');
        }
        // FlexSearch has export functionality that requires a callback
        debugLog('Exporting index...');
        return new Promise((resolve, reject) => {
            const exportedData = [];
            try {
                this.index.export((key, data) => {
                    exportedData.push({ key, data });
                });
                // Export is synchronous via callback, so we can resolve immediately
                debugLog('Index exported...');
                resolve({
                    index: exportedData,
                    documents: Array.from(this.documents.entries()),
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async importIndex(data) {
        if (!this.index) {
            await this.initialize();
        }
        // Type guard and import the index data
        if (this.isValidImportData(data)) {
            if (data.index && Array.isArray(data.index)) {
                // Handle the key-value pairs from export
                for (const item of data.index) {
                    if (item.key && item.data !== undefined) {
                        this.index.import(String(item.key), item.data);
                    }
                }
            }
            // Restore documents map
            if (data.documents) {
                this.documents.clear();
                for (const [id, doc] of data.documents) {
                    this.documents.set(id, doc);
                }
            }
        }
    }
    async clear() {
        if (!this.index) {
            return;
        }
        // Clear all documents
        const ids = Array.from(this.documents.keys());
        for (const id of ids) {
            this.index.remove(id);
        }
        this.documents.clear();
        // Don't reset indexCleared flag here - it should only be reset when starting a new indexing session
    }
    /**
     * Start a new indexing session - resets the indexCleared flag
     * This should be called before starting a new batch of addDocuments calls
     */
    startNewIndexingSession() {
        const timestamp = new Date().toISOString();
        this.sessionId = Math.random().toString(36).substring(7); // Generate new session ID
        const logPrefix = `[FlexSearchAdapter:${this.sessionId}:${timestamp}]`;
        debugLog(`${logPrefix} 🚀 STARTING NEW INDEXING SESSION`);
        debugLog(`${logPrefix} Previous indexCleared status: ${this.indexCleared}`);
        this.indexCleared = false;
        debugLog(`${logPrefix} Reset indexCleared to: ${this.indexCleared}`);
    }
    /**
     * Create match information for a query in content
     */
    createMatchInfo(query, content, field) {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);
        if (index === -1) {
            // Try to find partial matches
            const words = lowerQuery.split(/\s+/);
            for (const word of words) {
                const wordIndex = lowerContent.indexOf(word);
                if (wordIndex !== -1) {
                    return this.createMatchContext(content, word, wordIndex, field);
                }
            }
            return null;
        }
        return this.createMatchContext(content, query, index, field);
    }
    /**
     * Create match context with before/after text
     */
    createMatchContext(content, matchedText, index, field) {
        const contextLength = 50;
        const beforeStart = Math.max(0, index - contextLength);
        const afterEnd = Math.min(content.length, index + matchedText.length + contextLength);
        return {
            field,
            matchedText,
            context: {
                before: content.substring(beforeStart, index),
                after: content.substring(index + matchedText.length, afterEnd),
            },
            position: {
                start: index,
                end: index + matchedText.length,
            },
        };
    }
    /**
     * Create highlighted content snippet
     */
    createHighlights(content, query) {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);
        if (index === -1) {
            // Return first 150 characters if no match
            return content.substring(0, 150) + (content.length > 150 ? '...' : '');
        }
        // Extract a snippet around the match
        const snippetStart = Math.max(0, index - 50);
        const snippetEnd = Math.min(content.length, index + query.length + 50);
        let snippet = content.substring(snippetStart, snippetEnd);
        // Add ellipsis if needed
        if (snippetStart > 0)
            snippet = '...' + snippet;
        if (snippetEnd < content.length)
            snippet = snippet + '...';
        return snippet;
    }
    /**
     * Type guard for import data
     */
    isValidImportData(data) {
        return (typeof data === 'object' &&
            data !== null &&
            (!('index' in data) || Array.isArray(data.index)) &&
            (!('documents' in data) || Array.isArray(data.documents)));
    }
}
