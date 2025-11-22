/**
 * Document Discovery Types
 *
 * These interfaces define the requirements for document discovery
 * functionality needed from @principal-ai/alexandria-core-library.
 *
 * Requirements:
 * 1. Discover all indexable documents in a repository
 * 2. Provide metadata without reading full content
 * 3. Support watch patterns for real-time updates
 * 4. Respect ignore patterns and repository configuration
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

// ============================================================================
// Core Types for Document Discovery
// ============================================================================

export interface IndexableDocument {
  /**
   * Absolute path to the document file
   */
  path: string;

  /**
   * Path relative to repository root
   * Used for display and categorization
   */
  relativePath: string;

  /**
   * Document format type
   */
  type: DocumentFormat;

  /**
   * Category based on location/purpose
   * Helps with prioritization and filtering
   */
  category?: DocumentCategory;

  /**
   * Indexing priority - higher priority docs indexed first
   * (e.g., README files have high priority)
   */
  priority: IndexPriority;

  /**
   * Pre-extracted metadata if available
   * Avoids need to read file during discovery
   */
  metadata?: DocumentMetadata;

  /**
   * Repository this document belongs to
   */
  repository: {
    path: string;
    name: string;
    owner?: string;
  };
}

export type DocumentFormat =
  | 'markdown' // .md files
  | 'mdx' // .mdx files (Markdown with JSX)
  | 'rst' // .rst files (reStructuredText)
  | 'adoc' // .adoc files (AsciiDoc)
  | 'txt' // Plain text files
  | 'ipynb'; // Jupyter notebooks with markdown cells

export type DocumentCategory =
  | 'readme' // README files at any level
  | 'docs' // Files in docs/ directories
  | 'guide' // Guides and tutorials
  | 'api' // API documentation
  | 'changelog' // CHANGELOG files
  | 'contributing' // CONTRIBUTING files
  | 'wiki' // Wiki pages
  | 'notes' // General notes
  | 'blog' // Blog posts
  | 'other'; // Uncategorized

export type IndexPriority = 'high' | 'medium' | 'low';

export interface DocumentMetadata {
  /**
   * Document title from frontmatter or first heading
   */
  title?: string;

  /**
   * Document description or summary
   */
  description?: string;

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Author information
   */
  author?: string | string[];

  /**
   * Creation date
   */
  created?: Date;

  /**
   * Last modification date
   */
  lastModified: Date;

  /**
   * Estimated reading time in minutes
   */
  readingTime?: number;

  /**
   * Word count
   */
  wordCount?: number;

  /**
   * Custom frontmatter fields
   */
  custom?: Record<string, unknown>;

  /**
   * Whether document is marked as draft
   */
  draft?: boolean;

  /**
   * Whether document should be excluded from search
   */
  searchable?: boolean;
}

// ============================================================================
// Document Discovery API Interface
// ============================================================================

export interface DocumentDiscoveryAPI {
  /**
   * Discover all indexable documents in a repository
   *
   * @param repoPath - Absolute path to repository root
   * @param options - Discovery options
   * @returns Array of discovered documents
   */
  getIndexableDocuments(
    repoPath: string,
    options?: DiscoveryOptions,
  ): Promise<IndexableDocument[]>;

  /**
   * Get metadata for a specific document without reading full content
   *
   * @param filePath - Absolute path to document
   * @returns Document metadata
   */
  getDocumentMetadata(filePath: string): Promise<DocumentMetadata>;

  /**
   * Get file patterns that should be watched for changes
   *
   * @param repoPath - Repository root path
   * @returns Array of glob patterns to watch
   */
  getWatchPatterns(repoPath: string): WatchPattern[];

  /**
   * Check if a specific file should be indexed
   *
   * @param filePath - File to check
   * @param repoPath - Repository root (for context)
   * @returns Whether file should be indexed
   */
  shouldIndexFile(filePath: string, repoPath: string): boolean;

  /**
   * Get repository-specific configuration for document discovery
   *
   * @param repoPath - Repository root path
   * @returns Discovery configuration
   */
  getDiscoveryConfig(repoPath: string): Promise<DiscoveryConfig>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DiscoveryOptions {
  /**
   * Include draft documents
   */
  includeDrafts?: boolean;

  /**
   * Include private/internal documents
   */
  includePrivate?: boolean;

  /**
   * Document types to include
   */
  formats?: DocumentFormat[];

  /**
   * Categories to include
   */
  categories?: DocumentCategory[];

  /**
   * Maximum depth to traverse directories
   */
  maxDepth?: number;

  /**
   * Follow symbolic links
   */
  followSymlinks?: boolean;

  /**
   * Custom ignore patterns (in addition to defaults)
   */
  ignore?: string[];

  /**
   * Custom include patterns (overrides ignore)
   */
  include?: string[];
}

export interface WatchPattern {
  /**
   * Glob pattern to watch
   */
  pattern: string;

  /**
   * Events to watch for
   */
  events: WatchEvent[];

  /**
   * Whether to watch recursively
   */
  recursive?: boolean;

  /**
   * Specific ignore patterns for this watch
   */
  ignore?: string[];
}

export type WatchEvent = 'add' | 'change' | 'unlink' | 'rename';

export interface DiscoveryConfig {
  /**
   * Patterns for files to include
   */
  include: string[];

  /**
   * Patterns for files to ignore
   */
  ignore: string[];

  /**
   * Directories to prioritize
   */
  priorityPaths: string[];

  /**
   * Custom categorization rules
   */
  categories?: CategoryRule[];

  /**
   * Maximum file size to index (in bytes)
   */
  maxFileSize?: number;

  /**
   * Whether to parse frontmatter
   */
  parseFrontmatter?: boolean;

  /**
   * Frontmatter format
   */
  frontmatterFormat?: 'yaml' | 'toml' | 'json';
}

export interface CategoryRule {
  /**
   * Pattern to match files
   */
  pattern: string | RegExp;

  /**
   * Category to assign
   */
  category: DocumentCategory;

  /**
   * Priority override
   */
  priority?: IndexPriority;
}

// ============================================================================
// Events for Real-time Updates
// ============================================================================

export interface DocumentChangeEvent {
  /**
   * Type of change
   */
  type: 'added' | 'modified' | 'deleted' | 'renamed';

  /**
   * Affected document
   */
  document: IndexableDocument;

  /**
   * Previous path (for renames)
   */
  previousPath?: string;

  /**
   * Timestamp of change
   */
  timestamp: Date;

  /**
   * Repository context
   */
  repository: {
    path: string;
    name: string;
  };
}

// ============================================================================
// Staleness Detection
// ============================================================================

export interface DocumentStaleness {
  /**
   * Check if document index is stale
   */
  isStale(document: IndexableDocument, lastIndexed: Date): boolean;

  /**
   * Get documents that need re-indexing
   */
  getStaleDocuments(
    documents: IndexableDocument[],
    indexTimestamps: Map<string, Date>,
  ): IndexableDocument[];

  /**
   * Calculate staleness score (0-1, higher = more stale)
   */
  getStalenessScore(document: IndexableDocument, lastIndexed: Date): number;
}

// ============================================================================
// Integration with Existing Systems
// ============================================================================

export interface AlexandriaIntegration {
  /**
   * Get documents for an Alexandria entry
   */
  getDocumentsForEntry(entry: AlexandriaEntry): Promise<IndexableDocument[]>;

  /**
   * Map document to Alexandria context
   */
  mapToAlexandria(document: IndexableDocument): {
    entry: string;
    subpath: string;
  };
}

// ============================================================================
// Default Implementations (for reference)
// ============================================================================

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  include: [
    '**/*.md',
    '**/*.mdx',
    '**/README*',
    '**/CHANGELOG*',
    '**/CONTRIBUTING*',
  ],
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/vendor/**',
    '**/*.min.md',
  ],
  priorityPaths: ['README.md', 'docs/', '.principleMD/', 'documentation/'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  parseFrontmatter: true,
  frontmatterFormat: 'yaml',
};

export const DEFAULT_WATCH_PATTERNS: WatchPattern[] = [
  {
    pattern: '**/*.{md,mdx}',
    events: ['add', 'change', 'unlink'],
    recursive: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  },
  {
    pattern: '.principleMD/**/*',
    events: ['add', 'change', 'unlink'],
    recursive: true,
  },
];
