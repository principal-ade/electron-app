/**
 * SlideIndexer - Converts parsed markdown presentations into searchable documents
 */
import { MarkdownPresentation } from 'themed-markdown';
import { type FileInfo, type IndexingOptions } from './adapters/types';
import { SearchableDocument } from './types';
export declare class SlideIndexer {
    /**
     * Create searchable documents from a markdown presentation
     * Initially returns SlideDocument[], but designed to support
     * more granular SearchableDocument[] in the future
     */
    createSearchDocuments(presentation: MarkdownPresentation, fileInfo: FileInfo, options?: IndexingOptions): SearchableDocument[];
    /**
     * Parse markdown content and create searchable documents
     */
    parseAndIndex(content: string, fileInfo: FileInfo, options?: IndexingOptions): Promise<SearchableDocument[]>;
    /**
     * Extract the title from a slide (first heading or first line)
     */
    private extractSlideTitle;
    /**
     * Extract the heading level of the slide title
     */
    private extractSlideTitleLevel;
    /**
     * Analyze slide content to extract metadata
     */
    private analyzeSlideContent;
    /**
     * Create a searchable document from a slide chunk
     */
    private createChunkDocument;
    /**
     * Generate a title for a chunk document
     */
    private generateChunkTitle;
    /**
     * Get boost factor for different chunk types
     */
    private getChunkBoost;
    /**
     * Convert ContentChunk[] to SlideChunk[]
     */
    private convertContentChunksToSlideChunks;
    /**
     * Generate tags for chunk documents
     */
    private generateChunkTags;
    /**
     * Generate a simple content hash for change detection
     */
    private generateContentHash;
}
