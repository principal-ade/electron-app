"use strict";
/**
 * SlideSearchEngine - Main search engine implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlideSearchEngine = void 0;
const SearchEngineFactory_1 = require("./SearchEngineFactory");
const SlideIndexer_1 = require("./SlideIndexer");
class SlideSearchEngine {
    constructor(config, indexKey = 'search-index') {
        this.storage = config.storage;
        this.fileSystem = config.fileSystem;
        this.searchEngine = config.searchEngine || SearchEngineFactory_1.SearchEngineFactory.create('flexsearch');
        this.indexer = new SlideIndexer_1.SlideIndexer();
        this.indexKey = indexKey;
    }
    /**
     * Initialize the search engine, loading any existing index
     */
    async initialize() {
        try {
            // Initialize the search engine adapter
            await this.searchEngine.initialize();
            // Try to load existing index
            const savedIndex = await this.storage.loadIndex(this.indexKey);
            if (savedIndex) {
                await this.searchEngine.importIndex(savedIndex);
            }
        }
        catch (error) {
            console.error('Failed to initialize search engine:', error);
            // Continue with empty index
        }
    }
    /**
     * Index all markdown files in the workspace
     */
    async indexFiles(options) {
        console.log('Indexing files...');
        const startTime = Date.now();
        console.log('Start time:', startTime);
        const errors = [];
        console.log('Errors:', errors);
        let filesIndexed = 0;
        console.log('Files indexed:', filesIndexed);
        let slidesIndexed = 0;
        console.log('Slides indexed:', slidesIndexed);
        let documentsIndexed = 0;
        console.log('Documents indexed:', documentsIndexed);
        try {
            // Phase 1: Discovering files
            console.log('Phase 1: Discovering files');
            if (options?.onProgress) {
                options.onProgress({
                    phase: 'discovering',
                    filesProcessed: 0,
                    totalFiles: 0,
                    documentsIndexed: 0,
                    percentage: 0,
                });
            }
            // Find all markdown files
            const files = await this.fileSystem.findMarkdownFiles(options?.fileOptions);
            const totalFiles = files.length;
            console.log('Total files:', totalFiles);
            // Report discovered files to UI
            if (options?.onProgress) {
                options.onProgress({
                    phase: 'discovering',
                    filesProcessed: 0,
                    totalFiles: totalFiles,
                    documentsIndexed: 0,
                    percentage: 5,
                    foundFiles: {
                        list: files.slice(0, Math.min(10, files.length)).map(f => f.path), // Show first 10 files
                        total: totalFiles,
                        hasMore: totalFiles > 10,
                    },
                });
            }
            // Start a new indexing session - this will ensure the first addDocuments call clears the index
            console.log('[SlideSearchEngine] 🎯 About to start new indexing session...');
            if (this.searchEngine.startNewIndexingSession) {
                this.searchEngine.startNewIndexingSession();
                console.log('[SlideSearchEngine] ✅ Successfully called startNewIndexingSession()');
            }
            else {
                console.log('[SlideSearchEngine] ⚠️  WARNING: startNewIndexingSession method not available on search engine');
            }
            // Process files in batches
            const batchSize = options?.batchSize || 10;
            const allDocuments = [];
            console.log('All documents:', allDocuments);
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, Math.min(i + batchSize, files.length));
                console.log('Batch:', batch);
                const batchDocuments = [];
                console.log('Batch documents:', batchDocuments);
                // Process each file in the batch
                for (const file of batch) {
                    try {
                        // Phase 2: Parsing
                        if (options?.onProgress) {
                            options.onProgress({
                                phase: 'parsing',
                                currentFile: file.name,
                                filesProcessed: filesIndexed,
                                totalFiles: totalFiles,
                                documentsIndexed: documentsIndexed,
                                percentage: 10 + Math.round((filesIndexed / totalFiles) * 35), // 10-45%
                            });
                        }
                        console.log('Reading file content...');
                        // Read file content
                        const content = await this.fileSystem.readFile(file.path);
                        console.log('File content:', content);
                        // Parse and create search documents
                        const documents = await this.indexer.parseAndIndex(content, file, options);
                        console.log('Documents:', documents);
                        // Count slides (documents of type 'slide')
                        const slideCount = documents.filter(doc => doc.type === 'slide').length;
                        slidesIndexed += slideCount;
                        documentsIndexed += documents.length;
                        console.log('Documents indexed:', documentsIndexed);
                        batchDocuments.push(...documents);
                        filesIndexed++;
                        console.log('Files indexed:', filesIndexed);
                    }
                    catch (error) {
                        errors.push({
                            file: file.path,
                            error: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined,
                        });
                    }
                }
                console.log('Batch documents:', batchDocuments);
                // Phase 3: Indexing
                if (batchDocuments.length > 0) {
                    if (options?.onProgress) {
                        options.onProgress({
                            phase: 'indexing',
                            filesProcessed: filesIndexed,
                            totalFiles: totalFiles,
                            documentsIndexed: documentsIndexed,
                            percentage: 45 + Math.round((filesIndexed / totalFiles) * 35), // 45-80%
                        });
                    }
                    console.log('Adding documents to search engine...');
                    console.log(`[SlideSearchEngine] About to add ${batchDocuments.length} documents to search engine (batch)`);
                    console.log(`[SlideSearchEngine] Total documents so far: ${allDocuments.length + batchDocuments.length}`);
                    await this.searchEngine.addDocuments(batchDocuments);
                    console.log('Documents added to search engine...');
                    allDocuments.push(...batchDocuments);
                    console.log('All documents:', allDocuments);
                }
            }
            console.log('All documents:', allDocuments);
            // Phase 4: Persisting
            if (options?.onProgress) {
                options.onProgress({
                    phase: 'persisting',
                    filesProcessed: filesIndexed,
                    totalFiles: totalFiles,
                    documentsIndexed: documentsIndexed,
                    percentage: 85,
                });
            }
            console.log('Exporting Index ...');
            // Save the index
            const indexData = await this.searchEngine.exportIndex();
            const stats = {
                totalFiles: filesIndexed,
                totalSlides: slidesIndexed,
                totalDocuments: documentsIndexed,
                indexedAt: new Date().toISOString(),
            };
            console.log('Saving index...');
            await this.storage.saveIndex(this.indexKey, {
                data: indexData,
                metadata: {
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    stats,
                },
            });
            console.log('Index saved...');
            // Complete
            if (options?.onProgress) {
                options.onProgress({
                    phase: 'persisting',
                    filesProcessed: filesIndexed,
                    totalFiles: totalFiles,
                    documentsIndexed: documentsIndexed,
                    percentage: 100,
                });
            }
            console.log('Index saved...');
            return {
                filesIndexed,
                slidesIndexed,
                documentsIndexed,
                errors: errors.length > 0 ? errors : undefined,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            throw new Error(`Indexing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Search the index
     */
    async search(query, options) {
        console.log('[SlideSearchEngine] Search called with query:', query, 'options:', options);
        if (!query || query.trim().length === 0) {
            console.log('[SlideSearchEngine] Empty query, returning empty array');
            return [];
        }
        console.log('[SlideSearchEngine] Delegating to search engine adapter...');
        const results = await this.searchEngine.search(query.trim(), options);
        console.log('[SlideSearchEngine] Search engine returned:', results.length, 'results');
        console.log('[SlideSearchEngine] Sample results:', results.slice(0, 2).map(r => ({ id: r.id, title: r.title, type: r.type })));
        return results;
    }
    /**
     * Get index statistics
     */
    async getStats() {
        const metadata = await this.storage.getIndexMetadata(this.indexKey);
        return metadata?.stats || null;
    }
    /**
     * Check if index exists
     */
    async hasIndex() {
        return await this.storage.hasIndex(this.indexKey);
    }
    /**
     * Clear the index
     */
    async clearIndex() {
        await this.searchEngine.clear();
        await this.storage.deleteIndex(this.indexKey);
    }
    /**
     * Update specific files in the index
     */
    async updateFiles(filePaths, options) {
        const startTime = Date.now();
        const errors = [];
        let filesIndexed = 0;
        let slidesIndexed = 0;
        let documentsIndexed = 0;
        try {
            for (const filePath of filePaths) {
                try {
                    // Get file info
                    const fileInfo = await this.fileSystem.getFileInfo(filePath);
                    // Remove old documents for this file
                    const fileUri = fileInfo.uri || fileInfo.path;
                    const oldDocsToRemove = [];
                    // Search for all documents from this file
                    // Note: This is a workaround - ideally the search engine would support
                    // finding documents by file URI efficiently
                    const allResults = await this.searchEngine.search('*', { limit: 10000 });
                    allResults.forEach(result => {
                        if (result.fileUri === fileUri || result.filePath === filePath) {
                            oldDocsToRemove.push(result.id);
                        }
                    });
                    if (oldDocsToRemove.length > 0) {
                        await this.searchEngine.removeDocuments(oldDocsToRemove);
                    }
                    // Read and index the file
                    const content = await this.fileSystem.readFile(filePath);
                    const documents = await this.indexer.parseAndIndex(content, fileInfo, options);
                    // Add new documents
                    if (documents.length > 0) {
                        await this.searchEngine.addDocuments(documents);
                        // Count slides
                        const slideCount = documents.filter(doc => doc.type === 'slide').length;
                        slidesIndexed += slideCount;
                        documentsIndexed += documents.length;
                    }
                    filesIndexed++;
                }
                catch (error) {
                    errors.push({
                        file: filePath,
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    });
                }
            }
            // Save updated index
            const indexData = await this.searchEngine.exportIndex();
            const existingMetadata = await this.storage.getIndexMetadata(this.indexKey);
            await this.storage.saveIndex(this.indexKey, {
                data: indexData,
                metadata: {
                    version: existingMetadata?.version || '1.0.0',
                    createdAt: existingMetadata?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    stats: {
                        ...existingMetadata?.stats,
                        indexedAt: new Date().toISOString(),
                    },
                },
            });
            return {
                filesIndexed,
                slidesIndexed,
                documentsIndexed,
                errors: errors.length > 0 ? errors : undefined,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            throw new Error(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Index documents directly (for non-file-based content like notes)
     */
    async indexDocuments(documents, options) {
        const startTime = Date.now();
        const errors = [];
        try {
            // Phase 1: Clear if requested
            if (options?.clearBefore) {
                await this.clearIndex();
            }
            // Phase 2: Start new indexing session if adapter supports it
            if (this.searchEngine.startNewIndexingSession) {
                this.searchEngine.startNewIndexingSession();
            }
            // Phase 3: Add documents
            if (options?.onProgress) {
                options.onProgress({
                    phase: 'indexing',
                    filesProcessed: 0,
                    totalFiles: documents.length,
                    documentsIndexed: 0,
                    percentage: 50,
                });
            }
            await this.searchEngine.addDocuments(documents);
            // Phase 4: Save index
            await this.saveIndex();
            if (options?.onProgress) {
                options.onProgress({
                    phase: 'complete',
                    filesProcessed: documents.length,
                    totalFiles: documents.length,
                    documentsIndexed: documents.length,
                    percentage: 100,
                });
            }
            return {
                filesIndexed: 0, // No files in document-based indexing
                slidesIndexed: documents.filter(d => d.type === 'slide').length,
                documentsIndexed: documents.length,
                errors: errors.length > 0 ? errors : undefined,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            throw new Error(`Document indexing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Save the current index to storage
     */
    async saveIndex() {
        try {
            const indexData = await this.searchEngine.exportIndex();
            await this.storage.saveIndex(this.indexKey, {
                data: indexData,
                metadata: {
                    version: '1.0.0',
                    updatedAt: new Date().toISOString(),
                    stats: await this.getStats(),
                },
            });
        }
        catch (error) {
            throw new Error(`Failed to save index: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get direct access to the search engine adapter (use with caution)
     */
    getSearchAdapter() {
        return this.searchEngine;
    }
    /**
     * Get direct access to the storage adapter (use with caution)
     */
    getStorageAdapter() {
        return this.storage;
    }
}
exports.SlideSearchEngine = SlideSearchEngine;
