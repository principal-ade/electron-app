/**
 * SlideIndexer - Converts parsed markdown presentations into searchable documents
 */
// Import from themed-markdown package
import { parseMarkdownIntoPresentation, } from 'themed-markdown';
export class SlideIndexer {
    /**
     * Create searchable documents from a markdown presentation
     * Initially returns SlideDocument[], but designed to support
     * more granular SearchableDocument[] in the future
     */
    createSearchDocuments(presentation, fileInfo, options) {
        const documents = [];
        presentation.slides.forEach((slide, slideIndex) => {
            // Create the slide document
            const slideDoc = {
                // Base SearchableDocument fields
                id: `${fileInfo.uri || fileInfo.path}#slide-${slideIndex}`,
                type: 'slide',
                fileUri: fileInfo.uri || fileInfo.path,
                fileName: fileInfo.name,
                filePath: fileInfo.path,
                content: slide.location.content,
                title: slide.title,
                location: {
                    startLine: slide.location.startLine,
                    endLine: slide.location.endLine,
                },
                // SlideDocument specific fields
                slideIndex: slideIndex,
                slideNumber: slideIndex + 1,
                slideContent: slide.location.content,
                slideTitle: slide.title,
                slideTitleLevel: this.extractSlideTitleLevel(slide),
                // From MarkdownSlide
                slideId: slide.id,
                startLine: slide.location.startLine,
                endLine: slide.location.endLine,
                format: presentation.format,
                chunks: this.convertContentChunksToSlideChunks(slide.chunks),
                // Context
                totalSlidesInFile: presentation.slides.length,
                previousSlideTitle: slideIndex > 0 ? presentation.slides[slideIndex - 1].title : undefined,
                nextSlideTitle: slideIndex < presentation.slides.length - 1
                    ? presentation.slides[slideIndex + 1].title
                    : undefined,
                // Metadata
                metadata: this.analyzeSlideContent(slide),
                // Search optimization
                contentHash: this.generateContentHash(slide.location.content),
                indexedAt: new Date().toISOString(),
            };
            documents.push(slideDoc);
            // Index individual chunks/blocks within slides if requested
            if (options?.indexChunks && slide.chunks) {
                slide.chunks.forEach((chunk, chunkIndex) => {
                    const chunkDoc = this.createChunkDocument(chunk, chunkIndex, slideDoc, fileInfo);
                    if (chunkDoc) {
                        documents.push(chunkDoc);
                    }
                });
            }
        });
        return documents;
    }
    /**
     * Parse markdown content and create searchable documents
     */
    async parseAndIndex(content, fileInfo, options) {
        const presentation = parseMarkdownIntoPresentation(content);
        return this.createSearchDocuments(presentation, fileInfo, options);
    }
    /**
     * Extract the title from a slide (first heading or first line)
     */
    extractSlideTitle(slide) {
        const content = slide.location.content;
        const lines = content.split('\n').filter(line => line.trim());
        // Look for the first heading
        for (const line of lines) {
            const headingMatch = line.match(/^#+\s+(.+)$/);
            if (headingMatch) {
                return headingMatch[1].trim();
            }
        }
        // If no heading, use first non-empty line (truncated)
        if (lines.length > 0) {
            const firstLine = lines[0];
            return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
        }
        return 'Untitled Slide';
    }
    /**
     * Extract the heading level of the slide title
     */
    extractSlideTitleLevel(slide) {
        const content = slide.location.content;
        const lines = content.split('\n');
        for (const line of lines) {
            const headingMatch = line.match(/^(#+)\s+.+$/);
            if (headingMatch) {
                return headingMatch[1].length;
            }
        }
        return undefined;
    }
    /**
     * Analyze slide content to extract metadata
     */
    analyzeSlideContent(slide) {
        const content = slide.location.content;
        const metadata = {
            hasCode: false,
            hasMermaid: false,
            hasTables: false,
            hasImages: false,
            hasLinks: false,
            codeLanguages: [],
        };
        // Check for code blocks
        const codeBlockRegex = /```(\w+)?/g;
        let codeMatch;
        while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
            metadata.hasCode = true;
            if (codeMatch[1] && !metadata.codeLanguages.includes(codeMatch[1])) {
                metadata.codeLanguages.push(codeMatch[1]);
            }
        }
        // Check for mermaid diagrams
        if (/```mermaid/i.test(content)) {
            metadata.hasMermaid = true;
        }
        // Check for tables
        if (/\|.+\|/.test(content) && /\|[-:]+\|/.test(content)) {
            metadata.hasTables = true;
        }
        // Check for images
        if (/!\[.*?\]\(.*?\)/.test(content)) {
            metadata.hasImages = true;
        }
        // Check for links
        if (/\[.*?\]\(.*?\)/.test(content) && !/!\[.*?\]\(.*?\)/.test(content)) {
            metadata.hasLinks = true;
        }
        // Also check chunks if available
        if (slide.chunks) {
            slide.chunks.forEach(chunk => {
                if (chunk.type === 'mermaid_chunk') {
                    metadata.hasMermaid = true;
                }
                // For now, we can't extract more detailed information from chunks
                // This will be enhanced when we improve the chunk parsing
            });
        }
        return metadata;
    }
    /**
     * Create a searchable document from a slide chunk
     */
    createChunkDocument(chunk, chunkIndex, parentSlideDoc, fileInfo) {
        // Determine chunk type and extract content
        let chunkType;
        let content;
        let language;
        let diagramType;
        switch (chunk.type) {
            case 'mermaid_chunk':
                chunkType = 'mermaid';
                content = chunk.code || chunk.content || '';
                diagramType = 'mermaid';
                break;
            case 'code_chunk':
                chunkType = 'code';
                content = chunk.content || chunk.code || '';
                language = chunk.language;
                break;
            case 'markdown_chunk':
                chunkType = 'paragraph';
                content = chunk.content || '';
                break;
            default:
                // Skip unknown chunk types
                return null;
        }
        // Don't index empty chunks
        if (!content || !content.trim()) {
            return null;
        }
        const chunkDoc = {
            // Base SearchableDocument fields
            id: `${parentSlideDoc.id}#chunk-${chunkIndex}`,
            type: chunkType,
            parentId: parentSlideDoc.id,
            fileUri: fileInfo.uri || fileInfo.path,
            fileName: fileInfo.name,
            filePath: fileInfo.path,
            content: content,
            title: this.generateChunkTitle(chunkType, content),
            // Location information
            location: {
                startLine: chunk.location?.startLine || parentSlideDoc.startLine,
                endLine: chunk.location?.endLine || parentSlideDoc.endLine,
                slideStartLine: parentSlideDoc.startLine,
            },
            // Type-specific fields
            slideIndex: parentSlideDoc.slideIndex,
            language: language,
            diagramType: diagramType,
            // Metadata
            metadata: {
                parentSlideTitle: parentSlideDoc.slideTitle || '',
                parentSlideId: parentSlideDoc.slideId || '',
                chunkIndex: chunkIndex,
            },
            // Search optimization
            boost: this.getChunkBoost(chunkType),
            tags: this.generateChunkTags(chunkType, language),
        };
        return chunkDoc;
    }
    /**
     * Generate a title for a chunk document
     */
    generateChunkTitle(chunkType, content) {
        const maxLength = 50;
        const firstLine = content.split('\n')[0].trim();
        switch (chunkType) {
            case 'code':
                return `Code: ${firstLine.length > maxLength ? firstLine.substring(0, maxLength - 3) + '...' : firstLine}`;
            case 'mermaid':
                return `Diagram: ${firstLine.length > maxLength ? firstLine.substring(0, maxLength - 3) + '...' : firstLine}`;
            case 'paragraph':
                return firstLine.length > maxLength
                    ? firstLine.substring(0, maxLength - 3) + '...'
                    : firstLine;
            default:
                return firstLine.length > maxLength
                    ? firstLine.substring(0, maxLength - 3) + '...'
                    : firstLine;
        }
    }
    /**
     * Get boost factor for different chunk types
     */
    getChunkBoost(chunkType) {
        switch (chunkType) {
            case 'code':
                return 1.2; // Code blocks are important
            case 'mermaid':
                return 1.1; // Diagrams are also valuable
            default:
                return 1.0;
        }
    }
    /**
     * Convert ContentChunk[] to SlideChunk[]
     */
    convertContentChunksToSlideChunks(contentChunks) {
        return contentChunks.map((chunk) => {
            const baseChunk = {
                startLine: 0,
                endLine: 0,
            };
            switch (chunk.type) {
                case 'markdown_chunk':
                    return {
                        type: 'text',
                        content: chunk.content,
                        ...baseChunk,
                    };
                case 'mermaid_chunk':
                    return {
                        type: 'mermaid',
                        content: chunk.code,
                        ...baseChunk,
                    };
                default:
                    // Exhaustive check - this should never happen with valid ContentChunk types
                    return {
                        type: 'text',
                        content: '',
                        ...baseChunk,
                    };
            }
        });
    }
    /**
     * Generate tags for chunk documents
     */
    generateChunkTags(chunkType, language) {
        const tags = [chunkType];
        if (language) {
            tags.push(language);
        }
        return tags;
    }
    /**
     * Generate a simple content hash for change detection
     */
    generateContentHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
}
