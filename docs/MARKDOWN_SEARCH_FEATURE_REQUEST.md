# Feature Request: Incremental Indexing with Metadata Support

## Executive Summary

We're using @a24z/markdown-search in a multi-repository documentation system where we need to:
1. Index documents incrementally with custom metadata
2. Manage documents by repository (add/remove/update)
3. Filter search results by metadata fields
4. Maintain repository context in search results

Currently, the library's batch-indexing approach doesn't support attaching metadata to documents or managing them incrementally.

## Current Limitations

### 1. No Metadata Control During Indexing
The current `indexFiles()` API:
- Takes a `MarkdownFileProvider` that returns file paths
- Internally creates `SearchableDocument` objects
- Provides no mechanism to attach custom metadata per document

### 2. No Incremental Operations
- Can't add/update/remove individual documents
- Must re-index everything to update any document
- No way to remove documents by criteria (e.g., all docs from a repository)

### 3. No Metadata-Based Filtering
- Can't filter search results by custom fields
- Can't scope searches to specific repositories/categories
- Can't provide faceted search results

## Use Case: Multi-Repository Documentation

Our application manages documentation across multiple repositories:

```typescript
// We have repositories like:
{
  repositories: [
    { name: "electron-app", path: "/Users/dev/electron-app", owner: "a24z" },
    { name: "core-lib", path: "/Users/dev/core-lib", owner: "a24z" },
    { name: "ui-components", path: "/Users/dev/ui-components", owner: "team" }
  ]
}

// We need search results to know their repository:
{
  results: [
    {
      title: "API Documentation",
      filePath: "/Users/dev/electron-app/docs/api.md",
      metadata: {
        repository: "electron-app",     // <-- Need this
        repositoryPath: "/Users/dev/electron-app",
        owner: "a24z"
      }
    }
  ]
}
```

## Proposed API Additions

### 1. Incremental Document Operations

```typescript
interface SearchEngine {
  /**
   * Index a single document with custom metadata
   */
  indexDocument(
    filePath: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Index multiple documents with metadata
   */
  indexDocumentsWithMetadata(
    documents: Array<{
      path: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<IndexResult>;

  /**
   * Update an existing document
   */
  updateDocument(
    filePath: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Remove a single document
   */
  removeDocument(filePath: string): Promise<void>;

  /**
   * Remove all documents matching metadata criteria
   */
  removeDocumentsByMetadata(
    query: Record<string, any>
  ): Promise<number>;

  /**
   * Check if document exists in index
   */
  hasDocument(filePath: string): Promise<boolean>;
}
```

### 2. Metadata in Search Results

```typescript
interface SearchResult {
  // ... existing fields ...

  metadata?: {
    // Preserved from indexing
    repository?: string;
    repositoryPath?: string;
    [key: string]: any;
  };
}
```

### 3. Search Filtering by Metadata

```typescript
interface SearchOptions {
  // ... existing options ...

  /**
   * Filter results by metadata fields
   */
  filters?: {
    repository?: string | string[];
    [key: string]: any;
  };
}

// Example usage:
const results = await searchEngine.search("API", {
  filters: {
    repository: ["electron-app", "core-lib"],  // Search only in these repos
    documentType: "api-docs"
  }
});
```

### 4. Alternative: Metadata-Aware Provider

If modifying the core API is not preferred, an alternative would be enhancing the provider interface:

```typescript
interface MarkdownFileProvider {
  findMarkdownFiles(options?: FindOptions): Promise<MarkdownFile[]>;

  /**
   * Provide metadata for a file (called during indexing)
   */
  getFileMetadata?(filePath: string): Promise<Record<string, any>>;
}

// Or extend MarkdownFile:
interface MarkdownFile {
  path: string;
  name: string;
  size: number;
  modifiedAt: Date;
  uri: string;
  metadata?: Record<string, any>;  // <-- Add this
}
```

## Implementation Example

Here's how we would use these features:

```typescript
class DocumentIndexingService {
  private searchEngine: SearchEngine;
  private fileWatchers: Map<string, FSWatcher> = new Map();

  async initialize() {
    // Index repositories with metadata
    const repositories = await getRepositories();

    for (const repo of repositories) {
      await this.indexRepository(repo);
    }
  }

  private async indexRepository(repo: Repository) {
    const documents = await findDocumentsInRepo(repo.path);

    // Index with repository metadata
    await this.searchEngine.indexDocumentsWithMetadata(
      documents.map(doc => ({
        path: doc,
        metadata: {
          repository: repo.name,
          repositoryPath: repo.path,
          owner: repo.owner,
          private: repo.private
        }
      }))
    );

    // Set up file watching
    this.watchRepository(repo);
  }

  private watchRepository(repo: Repository) {
    const watcher = watch(repo.path);

    watcher.on('add', async (file) => {
      // Add new file with repository metadata
      await this.searchEngine.indexDocument(file, {
        repository: repo.name,
        repositoryPath: repo.path
      });
    });

    watcher.on('unlink', async (file) => {
      await this.searchEngine.removeDocument(file);
    });

    this.fileWatchers.set(repo.path, watcher);
  }

  async removeRepository(repoPath: string) {
    // Remove all documents from this repository
    await this.searchEngine.removeDocumentsByMetadata({
      repositoryPath: repoPath
    });

    // Stop watching
    this.fileWatchers.get(repoPath)?.close();
  }

  async searchInRepository(query: string, repository: string) {
    // Search only within specific repository
    return this.searchEngine.search(query, {
      filters: {
        repository: repository
      }
    });
  }
}
```

## Benefits

1. **Incremental Updates**: Add/remove repositories without full re-index
2. **Repository Context**: Search results know their source repository
3. **Filtered Search**: Users can search within specific repositories
4. **File Watching**: Efficiently update individual documents on change
5. **Scalability**: Can handle many repositories without coupling them

## Backwards Compatibility

These additions should be backwards compatible:
- Existing `indexFiles()` continues to work
- Metadata fields are optional
- Filter options are optional in search

## Similar Patterns in Other Libraries

This approach follows patterns from established search libraries:

- **Elasticsearch**: Documents have arbitrary fields, can filter by any field
- **Algolia**: Records include custom attributes, supports faceted search
- **Lunr.js**: Documents can have any fields, supports field-based filtering
- **FlexSearch**: Supports document metadata and filtering

## Priority

For our use case, the priority order would be:

1. **High**: `indexDocument()` with metadata support
2. **High**: Metadata preserved in `SearchResult`
3. **Medium**: `removeDocumentsByMetadata()`
4. **Medium**: Filter search by metadata
5. **Nice to have**: Faceted search results

## Questions

1. Is this approach aligned with the library's architecture?
2. Would you prefer the incremental API or enhanced provider approach?
3. Are there performance considerations we should be aware of?
4. What's the best way to contribute these changes?

We're happy to contribute to the implementation if you can provide guidance on the preferred approach.

## Contact

[Your contact information for follow-up discussion]