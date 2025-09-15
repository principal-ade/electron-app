// Utilities for search result highlighting
/**
 * Highlights search matches in content by injecting <mark> tags
 * Handles overlapping matches and preserves markdown structure
 */
export function highlightSearchMatches(content, matches) {
    if (!matches.length)
        return content;
    // Sort matches by position (reverse order to maintain positions)
    const sortedMatches = [...matches].sort((a, b) => b.position.start - a.position.start);
    // Remove overlapping matches
    const nonOverlappingMatches = removeOverlappingMatches(sortedMatches);
    // Apply highlights
    let highlightedContent = content;
    nonOverlappingMatches.forEach(match => {
        const before = highlightedContent.substring(0, match.position.start);
        const after = highlightedContent.substring(match.position.end);
        const highlighted = `<mark class="search-highlight search-term-${sanitizeClassName(match.searchTerm)}">${match.matchedText}</mark>`;
        highlightedContent = before + highlighted + after;
    });
    return highlightedContent;
}
/**
 * Removes overlapping matches, keeping the higher scoring ones
 */
function removeOverlappingMatches(matches) {
    const nonOverlapping = [];
    const usedRanges = [];
    // Process matches in order (already sorted by position)
    for (const match of matches) {
        const overlaps = usedRanges.some(range => (match.position.start >= range.start && match.position.start < range.end) ||
            (match.position.end > range.start && match.position.end <= range.end) ||
            (match.position.start <= range.start && match.position.end >= range.end));
        if (!overlaps) {
            nonOverlapping.push(match);
            usedRanges.push({
                start: match.position.start,
                end: match.position.end,
            });
        }
    }
    return nonOverlapping;
}
/**
 * Sanitizes a search term for use as a CSS class name
 */
function sanitizeClassName(term) {
    return term
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 20); // Limit length
}
/**
 * Generates a preview snippet for a match with context
 */
export function generateMatchPreview(content, match, contextLength = 50) {
    const start = Math.max(0, match.position.start - contextLength);
    const end = Math.min(content.length, match.position.end + contextLength);
    let before = content.substring(start, match.position.start);
    let after = content.substring(match.position.end, end);
    // Clean up whitespace
    before = before.replace(/^\s+/, '');
    after = after.replace(/\s+$/, '');
    // Add ellipsis if truncated
    if (start > 0)
        before = '...' + before;
    if (end < content.length)
        after = after + '...';
    return {
        before,
        match: match.matchedText,
        after,
        line: match.position.line,
    };
}
/**
 * Extracts text content from markdown, removing formatting
 * Useful for generating plain text previews
 */
export function extractPlainText(markdown) {
    return (markdown
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '[code]')
        // Remove inline code
        .replace(/`[^`]+`/g, '[code]')
        // Remove images
        .replace(/!\[.*?\]\(.*?\)/g, '[image]')
        // Remove links but keep text
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
        // Remove markdown formatting
        .replace(/[*_~#>`]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim());
}
/**
 * Highlights matches in code blocks with syntax-aware highlighting
 */
export function highlightCodeMatches(code, language, matches) {
    // This would integrate with the syntax highlighter (highlight.js)
    // For now, we'll do simple highlighting
    let highlightedCode = code;
    const sortedMatches = [...matches].sort((a, b) => b.position.start - a.position.start);
    sortedMatches.forEach(match => {
        const before = highlightedCode.substring(0, match.position.start);
        const after = highlightedCode.substring(match.position.end);
        const highlighted = `<span class="search-match-in-code">${match.matchedText}</span>`;
        highlightedCode = before + highlighted + after;
    });
    return highlightedCode;
}
/**
 * Get search highlight styles for different themes
 */
export function getSearchHighlightStyles(isDarkTheme) {
    const colors = isDarkTheme
        ? {
            highlightBg: '#594300',
            highlightBorder: 'rgba(255, 235, 59, 0.5)',
            focusBorder: '#007ACC',
            term1: '#594300',
            term2: '#003d6b',
            term3: '#2e5033',
            term4: '#5a2e00',
        }
        : {
            highlightBg: '#ffeb3b',
            highlightBorder: 'rgba(255, 235, 59, 0.5)',
            focusBorder: '#0066B8',
            term1: '#ffeb3b',
            term2: '#64b5f6',
            term3: '#81c784',
            term4: '#ff8a65',
        };
    return `
    .search-highlight {
      background-color: ${colors.highlightBg};
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
      font-weight: 600;
      box-shadow: 0 0 0 1px ${colors.highlightBorder};
    }
    
    .search-match-in-code {
      background-color: ${colors.highlightBorder};
      box-shadow: 0 0 0 1px ${colors.highlightBg};
      border-radius: 2px;
    }
    
    .search-result.highlighted {
      box-shadow: 0 0 0 2px ${colors.focusBorder};
    }
    
    /* Different colors for different search terms */
    .search-term-1 { background-color: ${colors.term1}; }
    .search-term-2 { background-color: ${colors.term2}; }
    .search-term-3 { background-color: ${colors.term3}; }
    .search-term-4 { background-color: ${colors.term4}; }
  `;
}
//# sourceMappingURL=searchHighlighting.js.map