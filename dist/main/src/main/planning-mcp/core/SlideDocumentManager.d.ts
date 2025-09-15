/**
 * SlideDocumentManager - Core business logic for slide operations
 * Platform-agnostic implementation that can be used in Electron, VS Code, or web
 */
export interface SlideDocument {
    filePath: string;
    content: string;
    slides: string[];
    currentSlide: number;
    metadata: {
        title?: string;
        lastModified?: Date;
        totalSlides?: number;
    };
}
export interface SlideOperation {
    type: 'navigate' | 'update' | 'create' | 'delete' | 'move' | 'merge' | 'split';
    params: any;
    timestamp: number;
}
export interface IFileSystemAdapter {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
}
export declare class SlideDocumentManager {
    private fileSystem;
    private documents;
    private operationHistory;
    private slideDelimiter;
    constructor(fileSystem: IFileSystemAdapter);
    /**
     * Parse markdown content into slides
     */
    parseSlides(content: string): string[];
    /**
     * Join slides back into markdown content
     */
    joinSlides(slides: string[]): string;
    /**
     * Load or create a document
     */
    loadDocument(filePath: string): Promise<SlideDocument>;
    /**
     * Save document to file system
     */
    saveDocument(filePath: string): Promise<boolean>;
    /**
     * Navigate to a specific slide
     */
    navigateToSlide(filePath: string, slideNumber: number): boolean;
    /**
     * Update slide content
     */
    updateSlide(filePath: string, slideNumber: number, content: string): boolean;
    /**
     * Create a new slide
     */
    createSlide(filePath: string, position: 'before' | 'after' | 'end', content?: string): number;
    /**
     * Delete a slide
     */
    deleteSlide(filePath: string, slideNumber: number): boolean;
    /**
     * Move a slide to a new position
     */
    moveSlide(filePath: string, from: number, to: number): boolean;
    /**
     * Search for text in slides
     */
    searchSlides(filePath: string, query: string, caseSensitive?: boolean): Array<{
        slideNumber: number;
        matches: Array<{
            lineNumber: number;
            line: string;
        }>;
    }>;
    /**
     * Get current document state
     */
    getDocument(filePath: string): SlideDocument | undefined;
    /**
     * Get all slides
     */
    getAllSlides(filePath: string): string[];
    /**
     * Get operation history
     */
    getHistory(): SlideOperation[];
    /**
     * Clear a document from cache
     */
    clearDocument(filePath: string): void;
    /**
     * Clear all documents
     */
    clearAll(): void;
    private recordOperation;
    private getDefaultContent;
    private extractTitle;
    private getDirectory;
}
//# sourceMappingURL=SlideDocumentManager.d.ts.map