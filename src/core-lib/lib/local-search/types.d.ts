export type ChunkType = 'code' | 'mermaid' | 'table' | 'text' | 'image' | 'link';
export interface SlideChunk {
    type: ChunkType;
    content: string;
    language?: string;
    startLine?: number;
    endLine?: number;
}
export type MetadataValue = string | number | boolean | string[] | undefined;
export interface SearchableDocument {
    id: string;
    type: DocumentType;
    parentId?: string;
    fileUri: string;
    fileName: string;
    filePath: string;
    content: string;
    title?: string;
    location?: {
        startLine: number;
        endLine: number;
        startColumn?: number;
        endColumn?: number;
        slideStartLine?: number;
    };
    slideIndex?: number;
    language?: string;
    diagramType?: string;
    metadata?: Record<string, MetadataValue>;
    boost?: number;
    tags?: string[];
}
export type DocumentType = 'slide' | 'code' | 'mermaid' | 'table' | 'heading' | 'image' | 'link' | 'list' | 'blockquote' | 'paragraph' | 'note';
export interface SlideDocument extends SearchableDocument {
    type: 'slide';
    slideIndex: number;
    slideNumber: number;
    slideContent: string;
    slideTitle?: string;
    slideTitleLevel?: number;
    slideId?: string;
    startLine: number;
    endLine: number;
    format?: string;
    chunks?: SlideChunk[];
    totalSlidesInFile: number;
    previousSlideTitle?: string;
    nextSlideTitle?: string;
    metadata: SlideMetadata;
    contentHash?: string;
    indexedAt: string;
}
export interface SlideMetadata extends Record<string, MetadataValue> {
    wordCount?: number;
    characterCount?: number;
    hasCode: boolean;
    codeLanguages: string[];
    hasMermaid: boolean;
    mermaidTypes?: string[];
    hasMath?: boolean;
    hasTables: boolean;
    hasImages: boolean;
    imageCount?: number;
    hasLinks: boolean;
    linkCount?: number;
    estimatedDuration?: number;
    hasTable?: boolean;
    hasImage?: boolean;
    hasLink?: boolean;
}
export interface SearchResult extends SearchableDocument {
    score: number;
    matches: MatchInfo[];
    highlights?: string;
    breadcrumb?: string[];
}
export interface MatchInfo {
    field: string;
    matchedText: string;
    context: {
        before: string;
        after: string;
    };
    position?: {
        start: number;
        end: number;
    };
}
export interface SearchOptions {
    types?: DocumentType[];
    languages?: string[];
    fuzzyThreshold?: number;
    limit?: number;
    offset?: number;
    fields?: Array<'content' | 'title' | 'metadata'>;
    sortBy?: 'relevance' | 'date' | 'title';
    sortOrder?: 'asc' | 'desc';
}
export interface MatchDetail {
    type: 'title' | 'content' | 'code';
    searchTerm: string;
    matchedText: string;
    position: {
        start: number;
        end: number;
        line: number;
        column: number;
    };
    context: {
        before: string;
        after: string;
        fullLine: string;
    };
    metadata?: {
        blockType?: 'code' | 'mermaid' | 'table' | 'math' | 'markdown';
        language?: string;
        headerLevel?: number;
    };
}
export interface SlideSearchMatch {
    slide: SlideDocument;
    matches: MatchDetail[];
    score: number;
    relevance: {
        titleMatch: boolean;
        contentMatch: boolean;
        codeMatch: boolean;
    };
}
