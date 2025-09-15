import { MatchDetail } from '../types';
/**
 * Highlights search matches in content by injecting <mark> tags
 * Handles overlapping matches and preserves markdown structure
 */
export declare function highlightSearchMatches(content: string, matches: MatchDetail[]): string;
/**
 * Generates a preview snippet for a match with context
 */
export declare function generateMatchPreview(content: string, match: MatchDetail, contextLength?: number): {
    before: string;
    match: string;
    after: string;
    line?: number;
};
/**
 * Extracts text content from markdown, removing formatting
 * Useful for generating plain text previews
 */
export declare function extractPlainText(markdown: string): string;
/**
 * Highlights matches in code blocks with syntax-aware highlighting
 */
export declare function highlightCodeMatches(code: string, language: string, matches: MatchDetail[]): string;
/**
 * Get search highlight styles for different themes
 */
export declare function getSearchHighlightStyles(isDarkTheme: boolean): string;
//# sourceMappingURL=searchHighlighting.d.ts.map