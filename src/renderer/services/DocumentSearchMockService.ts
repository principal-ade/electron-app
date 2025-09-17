/**
 * Mock service for document search
 * Uses @a24z/markdown-search types for UI development
 */

import type {
  SearchableDocument,
  SearchResult,
  DocumentType,
  MatchInfo
} from '@a24z/markdown-search';

// Generate mock documents that match the @a24z/markdown-search types
export function generateMockDocuments(): SearchableDocument[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'doc-1',
      type: 'document' as DocumentType,
      fileUri: 'file:///repos/principal-ai/electron-app/docs/README.md',
      fileName: 'README.md',
      filePath: '/repos/principal-ai/electron-app/docs/README.md',
      content: `# Principal AI Documentation

## Overview
Principal AI is a comprehensive development platform that combines powerful search capabilities with intelligent code analysis.

## Features
- **Markdown Search**: Full-text search across all your markdown documentation
- **Repository Management**: Manage multiple repositories with Alexandria
- **Code Intelligence**: Smart code analysis and suggestions

## Getting Started
1. Install dependencies with \`npm install\`
2. Configure your repositories
3. Start indexing your documents

## Architecture
The system uses a microservices architecture with:
- Electron frontend for cross-platform support
- React for UI components
- @a24z/markdown-search for document indexing`,
      title: 'Principal AI Documentation',
      metadata: {
        wordCount: 89,
        hasCode: true,
        codeLanguages: ['bash'],
        hasMermaid: false,
        hasTables: false,
        hasImages: false,
        hasLinks: true,
        linkCount: 3
      },
      tags: ['documentation', 'overview', 'getting-started'],
      indexedAt: now
    },
    {
      id: 'doc-2',
      type: 'section' as DocumentType,
      parentId: 'doc-1',
      fileUri: 'file:///repos/principal-ai/electron-app/docs/architecture.md',
      fileName: 'architecture.md',
      filePath: '/repos/principal-ai/electron-app/docs/architecture.md',
      content: `## System Architecture

### Frontend Layer
The frontend is built with Electron and React, providing a native desktop experience with web technologies.

### Search Infrastructure
We leverage @a24z/markdown-search for high-performance document indexing:
- FlexSearch adapter for in-memory search
- Support for fuzzy matching
- Real-time indexing updates

### Code Example
\`\`\`typescript
// Example of using the search engine
// import { SearchEngine } from '@a24z/markdown-search';

const engine = new SearchEngine({
  fuzzyThreshold: 0.8,
  fields: ['content', 'title', 'metadata']
});
\`\`\``,
      title: 'System Architecture',
      location: {
        startLine: 10,
        endLine: 35
      },
      sectionLevel: 2,
      metadata: {
        hasCode: true,
        codeLanguages: ['typescript'],
        wordCount: 65
      },
      tags: ['architecture', 'technical'],
      indexedAt: now
    },
    {
      id: 'doc-3',
      type: 'document' as DocumentType,
      fileUri: 'file:///repos/principal-ai/electron-app/guides/search-guide.md',
      fileName: 'search-guide.md',
      filePath: '/repos/principal-ai/electron-app/guides/search-guide.md',
      content: `# Search Guide

## Basic Search
Simply type keywords to search across all indexed documents.

## Advanced Search
Use special operators for more precise results:
- \`tag:api\` - Search within specific tags
- \`type:code\` - Search only code blocks
- \`lang:typescript\` - Filter by programming language

## Search Tips
1. Use quotes for exact phrases: "markdown search"
2. Combine multiple terms with AND/OR
3. Exclude terms with minus: react -native`,
      title: 'Search Guide',
      metadata: {
        hasCode: false,
        codeLanguages: [],
        hasMermaid: false,
        hasTables: false,
        hasImages: false,
        hasLinks: false
      },
      tags: ['guide', 'search', 'tutorial'],
      indexedAt: now
    },
    {
      id: 'doc-4',
      type: 'code' as DocumentType,
      parentId: 'doc-2',
      fileUri: 'file:///repos/principal-ai/core-library/src/search.ts',
      fileName: 'search.ts',
      filePath: '/repos/principal-ai/core-library/src/search.ts',
      content: `export class DocumentIndexer {
  private index: FlexSearchAdapter;

  constructor(config: IndexerConfig) {
    this.index = new FlexSearchAdapter(config);
  }

  async indexDocument(doc: SearchableDocument): Promise<void> {
    await this.index.add(doc);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.index.search(query, options);
  }
}`,
      title: 'DocumentIndexer Class',
      language: 'typescript',
      location: {
        startLine: 1,
        endLine: 14
      },
      metadata: {
        hasCode: true,
        codeLanguages: ['typescript']
      },
      indexedAt: now
    },
    {
      id: 'doc-5',
      type: 'document' as DocumentType,
      fileUri: 'file:///repos/principal-ai/electron-app/.principleMD/planning/roadmap.md',
      fileName: 'roadmap.md',
      filePath: '/repos/principal-ai/electron-app/.principleMD/planning/roadmap.md',
      content: `# Product Roadmap 2024

## Q1 Objectives
- [x] Launch markdown search functionality
- [x] Implement document indexing
- [ ] Add real-time search updates
- [ ] Support for multiple repositories

## Q2 Plans
- Integration with @a24z/core-library for document discovery
- Enhanced search UI with filters and facets
- Watcher implementation for document staleness
- Performance optimizations for large repositories

## Technical Debt
- Migrate from FlexSearch to more scalable solution
- Implement search result caching
- Add search analytics`,
      title: 'Product Roadmap 2024',
      metadata: {
        hasCode: false,
        codeLanguages: [],
        hasMermaid: false,
        hasTables: false,
        hasImages: false,
        hasLinks: false,
        wordCount: 76
      },
      tags: ['planning', 'roadmap', 'product'],
      indexedAt: now
    }
  ];
}

// Mock search implementation using @a24z/markdown-search types
export function mockSearch(
  query: string,
  documents: SearchableDocument[]
): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const doc of documents) {
    const matches: MatchInfo[] = [];
    let score = 0;

    // Title matching
    if (doc.title?.toLowerCase().includes(lowerQuery)) {
      score += 10;
      matches.push({
        field: 'title',
        matchedText: doc.title,
        context: {
          before: '',
          after: ''
        }
      });
    }

    // Content matching
    const contentLower = doc.content.toLowerCase();
    const matchIndex = contentLower.indexOf(lowerQuery);

    if (matchIndex >= 0) {
      score += 5;

      // Extract context around match
      const contextStart = Math.max(0, matchIndex - 50);
      const contextEnd = Math.min(doc.content.length, matchIndex + query.length + 50);

      matches.push({
        field: 'content',
        matchedText: doc.content.substring(matchIndex, matchIndex + query.length),
        context: {
          before: doc.content.substring(contextStart, matchIndex),
          after: doc.content.substring(matchIndex + query.length, contextEnd)
        },
        position: {
          start: matchIndex,
          end: matchIndex + query.length
        }
      });
    }

    // Tag matching
    if (doc.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      score += 3;
      const matchedTag = doc.tags.find(tag => tag.toLowerCase().includes(lowerQuery));
      if (matchedTag) {
        matches.push({
          field: 'metadata',
          matchedText: matchedTag,
          context: {
            before: 'Tag: ',
            after: ''
          }
        });
      }
    }

    if (score > 0) {
      results.push({
        ...doc,
        score,
        matches,
        breadcrumb: doc.filePath.split('/').slice(0, -1)
      });
    }
  }

  // Sort by score
  return results.sort((a, b) => b.score - a.score);
}

// Mock index status
export function getMockIndexStatus() {
  return {
    totalDocuments: 247,
    indexedDocuments: 247,
    lastIndexTime: new Date(),
    isIndexing: false,
    repositories: [
      {
        path: '/repos/principal-ai/electron-app',
        name: 'principal-ai/electron-app',
        documentCount: 142
      },
      {
        path: '/repos/principal-ai/core-library',
        name: 'principal-ai/core-library',
        documentCount: 65
      },
      {
        path: '/repos/principal-ai/markdown-search',
        name: 'principal-ai/markdown-search',
        documentCount: 40
      }
    ]
  };
}