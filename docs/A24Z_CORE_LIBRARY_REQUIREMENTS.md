# @a24z/core-library Document Discovery Requirements

## Executive Summary

We need document discovery functionality in @a24z/core-library to support full-text search across markdown documentation in repositories. This document outlines the specific requirements and proposed API.

## Current Situation

- We're building document search using @a24z/markdown-search for indexing
- The search engine runs in Electron's main process (Node.js environment)
- We need to discover which documents to index in each repository
- Currently planning an interim solution but would prefer core-library support

## Core Requirements

### 1. Document Discovery
We need to discover all "indexable" documents in a repository:
- Markdown files (`.md`, `.mdx`)
- Documentation in various locations (`/docs`, `/.principleMD`, `/README.md`)
- Respecting `.gitignore` and custom ignore patterns
- With metadata extraction (title, tags, author, etc.)

### 2. Watch Patterns
We need to know which files to watch for real-time updates:
- Glob patterns for different document types
- Considering repository-specific configurations
- Efficient watching without monitoring unnecessary files

### 3. Staleness Detection
We need to know when documents are stale:
- Compare file modification times with index timestamps
- Detect when documents need re-indexing
- Handle git operations (branch switches, pulls)

## Proposed API

```typescript
interface DocumentDiscoveryAPI {
  // Get all documents that should be indexed
  getIndexableDocuments(
    repoPath: string,
    options?: DiscoveryOptions
  ): Promise<IndexableDocument[]>;

  // Get metadata without reading full content
  getDocumentMetadata(filePath: string): Promise<DocumentMetadata>;

  // Get patterns for file watching
  getWatchPatterns(repoPath: string): WatchPattern[];

  // Check if a file should be indexed
  shouldIndexFile(filePath: string, repoPath: string): boolean;
}
```

See `src/shared/types/document-discovery.types.ts` for complete type definitions.

## Key Design Decisions

### What Makes a Document "Indexable"?

We propose these criteria:
1. **File type**: Markdown and similar formats (`.md`, `.mdx`, `.rst`)
2. **Location**: Not in ignored directories (node_modules, dist, etc.)
3. **Size**: Under a reasonable limit (e.g., 10MB)
4. **Content**: Not marked as `searchable: false` in frontmatter
5. **Status**: Not a draft (unless explicitly included)

### Document Categories

Documents should be categorized for better search relevance:
- `readme` - README files (high priority)
- `docs` - Documentation directories
- `planning` - Planning documents (.principleMD)
- `api` - API documentation
- `guide` - Tutorials and guides

### Priority System

Documents should have indexing priorities:
- **High**: README, main documentation
- **Medium**: Guides, API docs
- **Low**: Notes, drafts, archived content

## Integration with Existing @a24z Ecosystem

### With Alexandria
- Documents linked to Alexandria entries
- Repository context for search results
- Shared metadata and categorization

### With Memory/Notes System
- Anchored notes as searchable documents
- Cross-referencing between notes and docs
- Unified search across all content types

## Implementation Considerations

### Performance
- Async/streaming APIs for large repositories
- Metadata extraction without full file reads
- Caching of discovery results

### Flexibility
- Configurable ignore patterns
- Custom categorization rules
- Repository-specific settings (`.principleMD/search.config.yml`?)

### Browser Compatibility
- Types should be importable in browser environments
- Implementation stays in Node.js environment
- Clear separation of types and implementation

## Our Interim Solution

While waiting for core-library support, we'll implement:

```typescript
class InterimDocumentScanner {
  private readonly PATTERNS = ['**/*.md', '**/*.mdx'];
  private readonly DOC_DIRS = ['docs', '.principleMD', 'guides'];
  private readonly IGNORE = ['node_modules', 'dist', '.git'];

  async scanRepository(repoPath: string): Promise<IndexableDocument[]> {
    // Use fast-glob to find documents
    // Extract metadata from frontmatter
    // Categorize based on path patterns
  }
}
```

## Questions for the Team

1. **Frontmatter Standards**: Should we standardize on YAML/TOML/JSON?
2. **Private Documents**: How to handle sensitive/private documentation?
3. **Code Comments**: Should inline code documentation be discoverable?
4. **Performance Targets**: Expected scale (files/repo, total documents)?
5. **Configuration**: Where should discovery config live? (`.principleMD/config`?)

## Success Metrics

- Discover 1000+ documents in < 5 seconds
- Accurate categorization (> 90% correct)
- Minimal false positives (< 5% non-docs indexed)
- Efficient watching (< 100ms to detect changes)

## Timeline

- **Now**: Building UI with mock data ✅
- **Week 1**: Implementing interim scanner
- **Week 2**: Main process indexing service
- **Week 3**: Integration and optimization
- **Future**: Replace interim with core-library API

## Contact

For questions or clarification on these requirements, please reach out to the Principal AI team.

## Appendix: Example Usage

```typescript
import { DocumentDiscoveryAPI } from '@a24z/core-library';

// In main process
async function indexRepository(repoPath: string) {
  const discovery = new DocumentDiscoveryAPI();

  // Get all indexable documents
  const documents = await discovery.getIndexableDocuments(repoPath, {
    includeDrafts: false,
    categories: ['docs', 'readme', 'guide']
  });

  // Index high-priority first
  const sorted = documents.sort((a, b) =>
    priorityScore(b.priority) - priorityScore(a.priority)
  );

  // Index documents
  for (const doc of sorted) {
    await searchEngine.index(doc);
  }

  // Set up watchers
  const patterns = discovery.getWatchPatterns(repoPath);
  patterns.forEach(p => watcher.add(p.pattern));
}
```