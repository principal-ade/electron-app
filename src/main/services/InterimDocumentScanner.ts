/**
 * Interim Document Scanner
 *
 * Temporary implementation for discovering markdown documents in repositories.
 * This will be replaced by @a24z/core-library's document discovery API.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import matter from 'gray-matter';
import type {
  IndexableDocument,
  DocumentCategory,
  DocumentFormat,
  DocumentMetadata,
  IndexPriority,
  DiscoveryOptions
} from '../../shared/types/document-discovery.types';

export class InterimDocumentScanner {
  // Default patterns to find markdown documents
  private readonly DEFAULT_PATTERNS = [
    '**/*.md',
    '**/*.mdx',
    '**/README*',
    '**/CHANGELOG*',
    '**/CONTRIBUTING*',
    '**/LICENSE*'
  ];

  // Common documentation directories (for prioritization)
  private readonly DOC_DIRECTORIES = [
    'docs',
    'documentation',
    '.principleMD',
    'wiki',
    'guides',
    'tutorials',
    'examples'
  ];

  // Default ignore patterns
  private readonly DEFAULT_IGNORE = [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    'coverage/**',
    'vendor/**',
    '*.min.md',
    'package-lock.json',
    'yarn.lock'
  ];

  /**
   * Scan a repository for indexable documents
   */
  async scanRepository(
    repoPath: string,
    options?: DiscoveryOptions
  ): Promise<IndexableDocument[]> {

    // Get repository info
    const repoName = path.basename(repoPath);
    const repoInfo = {
      path: repoPath,
      name: repoName,
      owner: await this.getRepoOwner(repoPath)
    };

    // Build ignore instance
    const ig = await this.buildIgnore(repoPath, options?.ignore);

    // Find all matching files
    const patterns = options?.formats
      ? this.getPatternsForFormats(options.formats)
      : this.DEFAULT_PATTERNS;

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: repoPath,
        absolute: false,
        nodir: true,
        dot: true,
        ignore: this.DEFAULT_IGNORE
      });

      files.push(...matches);
    }

    // Filter with ignore patterns
    const filteredFiles = files.filter(file => !ig.ignores(file));

    // Convert to IndexableDocument objects
    const documents: IndexableDocument[] = [];
    for (const file of filteredFiles) {
      const absolutePath = path.join(repoPath, file);

      // Skip if file is too large
      const stats = await fs.stat(absolutePath);
      const maxSize = options?.maxDepth || 10 * 1024 * 1024; // 10MB default
      if (stats.size > maxSize) {
        continue;
      }

      // Extract metadata
      const metadata = await this.extractMetadata(absolutePath);

      // Skip drafts if not included
      if (metadata.draft && !options?.includeDrafts) {
        continue;
      }

      // Skip non-searchable documents
      if (metadata.searchable === false) {
        continue;
      }

      // Determine category and priority
      const category = this.categorizeDocument(file);
      const priority = this.getPriority(file, category);

      documents.push({
        path: absolutePath,
        relativePath: file,
        type: this.getDocumentType(file),
        category,
        priority,
        metadata,
        repository: repoInfo
      });
    }

    // Sort by priority
    documents.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return documents;
  }

  /**
   * Extract metadata from a document
   */
  async extractMetadata(filePath: string): Promise<DocumentMetadata> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      // Parse frontmatter
      const { data: frontmatter, content: bodyContent } = matter(content);

      // Extract title
      let title = frontmatter.title;
      if (!title) {
        // Try to get title from first H1
        const h1Match = bodyContent.match(/^#\s+(.+)$/m);
        if (h1Match) {
          title = h1Match[1];
        } else {
          // Use filename as fallback
          title = path.basename(filePath, path.extname(filePath))
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        }
      }

      // Calculate word count and reading time
      const words = bodyContent.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;
      const readingTime = Math.ceil(wordCount / 200); // 200 words per minute

      return {
        title,
        description: frontmatter.description || frontmatter.summary,
        tags: this.normalizeTags(frontmatter.tags || frontmatter.keywords),
        author: frontmatter.author || frontmatter.authors,
        created: frontmatter.created || frontmatter.date || stats.birthtime,
        lastModified: stats.mtime,
        readingTime,
        wordCount,
        draft: frontmatter.draft === true,
        searchable: frontmatter.searchable !== false,
        custom: frontmatter
      };
    } catch (error) {
      console.error(`[DocumentScanner] Error extracting metadata from ${filePath}:`, error);

      // Return minimal metadata on error
      const stats = await fs.stat(filePath);
      return {
        lastModified: stats.mtime,
        searchable: true
      };
    }
  }

  /**
   * Build ignore instance with patterns
   */
  private async buildIgnore(repoPath: string, customIgnore?: string[]): Promise<ignore.Ignore> {
    const ig = ignore();

    // Add default ignore patterns
    ig.add(this.DEFAULT_IGNORE);

    // Add custom ignore patterns
    if (customIgnore) {
      ig.add(customIgnore);
    }

    // Try to read .gitignore
    try {
      const gitignorePath = path.join(repoPath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    } catch {
      // No .gitignore or can't read it
    }

    // Try to read .searchignore (custom ignore file)
    try {
      const searchignorePath = path.join(repoPath, '.searchignore');
      const searchignoreContent = await fs.readFile(searchignorePath, 'utf-8');
      ig.add(searchignoreContent);
    } catch {
      // No .searchignore
    }

    return ig;
  }

  /**
   * Get document type from file extension
   */
  private getDocumentType(filePath: string): DocumentFormat {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.md': {
        return 'markdown';
      }
      case '.mdx': {
        return 'mdx';
      }
      case '.rst': {
        return 'rst';
      }
      case '.adoc': {
        return 'adoc';
      }
      case '.ipynb': {
        return 'ipynb';
      }
      case '.txt': {
        return 'txt';
      }
      default: {
        // Check if it's a README/CHANGELOG without extension
        const basename = path.basename(filePath).toUpperCase();
        if (basename.startsWith('README') || basename.startsWith('CHANGELOG')) {
          return 'markdown';
        }
        return 'txt';
      }
    }
  }

  /**
   * Categorize document based on path and name
   */
  private categorizeDocument(filePath: string): DocumentCategory {
    const pathLower = filePath.toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    // Check filename patterns
    if (basename.startsWith('readme')) return 'readme';
    if (basename.startsWith('changelog')) return 'changelog';
    if (basename.startsWith('contributing')) return 'contributing';
    if (basename.includes('api') || pathLower.includes('/api/')) return 'api';

    // Check directory patterns
    if (pathLower.includes('/docs/') || pathLower.includes('/documentation/')) return 'docs';
    if (pathLower.includes('/.principlemd/') || pathLower.includes('/planning/')) return 'planning';
    if (pathLower.includes('/guide') || pathLower.includes('/tutorial')) return 'guide';
    if (pathLower.includes('/wiki/')) return 'wiki';
    if (pathLower.includes('/blog/') || pathLower.includes('/posts/')) return 'blog';
    if (pathLower.includes('/notes/')) return 'notes';

    return 'other';
  }

  /**
   * Determine document priority
   */
  private getPriority(filePath: string, category: DocumentCategory): IndexPriority {
    // README files are always high priority
    if (category === 'readme') return 'high';

    // Root-level documents are high priority
    if (!filePath.includes('/')) return 'high';

    // Main documentation is high priority
    if (category === 'docs' || category === 'api') return 'high';

    // Guides and tutorials are medium priority
    if (category === 'guide' || category === 'contributing') return 'medium';

    // Everything else is low priority
    return 'low';
  }

  /**
   * Get patterns for specific document formats
   */
  private getPatternsForFormats(formats: DocumentFormat[]): string[] {
    const patterns: string[] = [];

    for (const format of formats) {
      switch (format) {
        case 'markdown':
          patterns.push('**/*.md', '**/README*', '**/CHANGELOG*');
          break;
        case 'mdx':
          patterns.push('**/*.mdx');
          break;
        case 'rst':
          patterns.push('**/*.rst');
          break;
        case 'adoc':
          patterns.push('**/*.adoc', '**/*.asciidoc');
          break;
        case 'txt':
          patterns.push('**/*.txt');
          break;
        case 'ipynb':
          patterns.push('**/*.ipynb');
          break;
      }
    }

    return patterns;
  }

  /**
   * Normalize tags array
   */
  private normalizeTags(tags: unknown): string[] | undefined {
    if (!tags) return undefined;
    if (typeof tags === 'string') return [tags];
    if (Array.isArray(tags)) return tags.filter(t => typeof t === 'string');
    return undefined;
  }

  /**
   * Try to get repository owner from git config
   */
  private async getRepoOwner(_repoPath: string): Promise<string | undefined> {
    try {
      const gitConfigPath = path.join(_repoPath, '.git', 'config');
      const gitConfig = await fs.readFile(gitConfigPath, 'utf-8');

      // Look for remote origin URL
      const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);
      if (urlMatch) {
        const url = urlMatch[1];
        // Extract owner from GitHub URL
        const githubMatch = url.match(/github\.com[:/]([^/]+)\//);
        if (githubMatch) {
          return githubMatch[1];
        }
      }
    } catch {
      // Can't read git config
    }

    return undefined;
  }

  /**
   * Get watch patterns for a repository
   */
  getWatchPatterns(repoPath: string): string[] {
    return [
      '**/*.md',
      '**/*.mdx',
      '.principleMD/**/*',
      'docs/**/*',
      'README*',
      'CHANGELOG*'
    ];
  }
}