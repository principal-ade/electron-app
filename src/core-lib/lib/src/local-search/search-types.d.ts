/**
 * Core types for the search module
 */
import { SlideDocument } from './types';
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
//# sourceMappingURL=search-types.d.ts.map