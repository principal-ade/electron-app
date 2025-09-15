/**
 * Content Provider Interface for Search
 * Abstracts file content access for different repository types
 */

import { FileSystemService } from '../main-process-api/FileSystemService';
import { GithubService } from '../main-process-api/GithubService';

export interface ContentProvider {
  /**
   * Check if this provider can provide file content
   */
  canProvideContent(): boolean;
  
  /**
   * Read a single file's content
   */
  readFileContent(filePath: string): Promise<string | null>;
  
  /**
   * Optional: Read multiple files in batch (for performance)
   */
  bulkReadFiles?(filePaths: string[]): Promise<Map<string, string>>;
  
  /**
   * Get provider capabilities for UI adaptation
   */
  getCapabilities(): ContentProviderCapabilities;
}

export interface ContentProviderCapabilities {
  supportsContentSearch: boolean;
  supportsStreaming?: boolean;
  requiresAuthentication?: boolean;
  rateLimit?: {
    requestsPerHour: number;
    remaining?: number;
  };
  estimatedLatency?: 'low' | 'medium' | 'high';
}

/**
 * Local filesystem content provider
 * Used for local development repositories
 */
export class LocalFileSystemProvider implements ContentProvider {
  canProvideContent(): boolean {
    return true;
  }
  
  async readFileContent(filePath: string): Promise<string | null> {
    try {
      const result = await FileSystemService.readFile(filePath);
      
      // Handle different response formats
      if (typeof result === 'object' && result && 'content' in result) {
        return result.content;
      } else if (typeof result === 'string') {
        return result;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }
  
  async bulkReadFiles(filePaths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Read files in parallel with a concurrency limit
    const concurrencyLimit = 5;
    const chunks: string[][] = [];
    
    for (let i = 0; i < filePaths.length; i += concurrencyLimit) {
      chunks.push(filePaths.slice(i, i + concurrencyLimit));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (path) => {
        const content = await this.readFileContent(path);
        if (content !== null) {
          results.set(path, content);
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }
  
  getCapabilities(): ContentProviderCapabilities {
    return {
      supportsContentSearch: true,
      supportsStreaming: false,
      requiresAuthentication: false,
      estimatedLatency: 'low'
    };
  }
}

/**
 * GitHub API content provider using main process
 * Uses gh CLI if available, falls back to HTTPS API
 */
export class GitHubContentProvider implements ContentProvider {
  private rateLimitRemaining?: number;
  private isAuthenticated: boolean = false;
  private authMethod: string = 'none';
  
  constructor(
    private owner: string,
    private repo: string,
    private branch: string = 'main'
  ) {
    // Check auth status on creation
    this.checkAuthStatus();
  }
  
  private async checkAuthStatus(): Promise<void> {
    try {
      const status = await GithubService.checkAuthStatus();
      this.isAuthenticated = status.isAuthenticated;
      this.authMethod = status.method;
      console.log('[GitHubContentProvider] Auth status:', status);
    } catch (error) {
      console.error('[GitHubContentProvider] Failed to check auth status:', error);
    }
  }
  
  canProvideContent(): boolean {
    return true;
  }
  
  async readFileContent(filePath: string): Promise<string | null> {
    try {
      // Clean the path: remove leading slash and "main/" prefix if present
      let cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      
      // Remove "main/" or any branch name prefix that might be in the path
      // This happens when paths come from the file tree which may include the branch
      if (cleanPath.startsWith('main/')) {
        cleanPath = cleanPath.substring(5);
      } else if (cleanPath.includes('/') && cleanPath.split('/')[0].match(/^(main|master|develop|dev)$/)) {
        // Remove other common branch prefixes
        cleanPath = cleanPath.substring(cleanPath.indexOf('/') + 1);
      }
      
      console.log('[GitHubContentProvider] Fetching file:', {
        owner: this.owner,
        repo: this.repo,
        path: cleanPath,
        branch: this.branch
      });
      
      // Use main process API which handles gh CLI and fallback
      const content = await GithubService.getFileContent(
        this.owner,
        this.repo,
        cleanPath,
        this.branch
      );
      
      if (content === null) {
        console.warn('[GitHubContentProvider] File not found or inaccessible:', cleanPath);
      }
      
      return content;
    } catch (error) {
      console.error(`[GitHubContentProvider] Failed to fetch content for ${filePath}:`, error);
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('rate limit')) {
        this.rateLimitRemaining = 0;
      }
      
      return null;
    }
  }
  
  async bulkReadFiles(filePaths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Read files in parallel with a concurrency limit
    const concurrencyLimit = 3; // Lower limit for GitHub API
    const chunks: string[][] = [];
    
    for (let i = 0; i < filePaths.length; i += concurrencyLimit) {
      chunks.push(filePaths.slice(i, i + concurrencyLimit));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (path) => {
        const content = await this.readFileContent(path);
        if (content !== null) {
          results.set(path, content);
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }
  
  getCapabilities(): ContentProviderCapabilities {
    // Adjust capabilities based on auth status
    const baseLimit = this.isAuthenticated ? 5000 : 60;
    
    return {
      supportsContentSearch: true,
      supportsStreaming: false,
      requiresAuthentication: false, // Works without, better with
      rateLimit: {
        requestsPerHour: baseLimit,
        remaining: this.rateLimitRemaining
      },
      estimatedLatency: this.authMethod === 'cli' ? 'medium' : 'high'
    };
  }
}

/**
 * Null content provider
 * Used when content search is not available
 */
export class NullContentProvider implements ContentProvider {
  canProvideContent(): boolean {
    return false;
  }
  
  async readFileContent(): Promise<null> {
    return null;
  }
  
  getCapabilities(): ContentProviderCapabilities {
    return {
      supportsContentSearch: false,
      requiresAuthentication: false,
      estimatedLatency: 'low'
    };
  }
}

/**
 * Cached content provider wrapper
 * Wraps another provider and adds caching
 */
export class CachedContentProvider implements ContentProvider {
  private cache = new Map<string, { content: string; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  constructor(private innerProvider: ContentProvider) {}
  
  canProvideContent(): boolean {
    return this.innerProvider.canProvideContent();
  }
  
  async readFileContent(filePath: string): Promise<string | null> {
    // Check cache
    const cached = this.cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.content;
    }
    
    // Fetch from inner provider
    const content = await this.innerProvider.readFileContent(filePath);
    
    // Cache the result
    if (content !== null) {
      this.cache.set(filePath, {
        content,
        timestamp: Date.now()
      });
    }
    
    return content;
  }
  
  async bulkReadFiles(filePaths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const uncachedPaths: string[] = [];
    
    // Check cache first
    for (const path of filePaths) {
      const cached = this.cache.get(path);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        results.set(path, cached.content);
      } else {
        uncachedPaths.push(path);
      }
    }
    
    // Fetch uncached files
    if (uncachedPaths.length > 0) {
      if (this.innerProvider.bulkReadFiles) {
        const fetched = await this.innerProvider.bulkReadFiles(uncachedPaths);
        fetched.forEach((content, path) => {
          results.set(path, content);
          this.cache.set(path, {
            content,
            timestamp: Date.now()
          });
        });
      } else {
        // Fall back to individual reads
        for (const path of uncachedPaths) {
          const content = await this.readFileContent(path);
          if (content !== null) {
            results.set(path, content);
          }
        }
      }
    }
    
    return results;
  }
  
  getCapabilities(): ContentProviderCapabilities {
    return this.innerProvider.getCapabilities();
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}