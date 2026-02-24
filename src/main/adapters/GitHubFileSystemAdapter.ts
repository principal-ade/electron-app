/**
 * GitHubFileSystemAdapter - Complete FileSystemAdapter implementation for GitHub
 *
 * Implements all FileSystemAdapter methods using GitHub Contents API.
 * Used by CollectionStorageAdapter to store collections in GitHub repos.
 */

import type { FileSystemAdapter } from '@principal-ai/repository-abstraction';
import * as path from 'path';
import { authService } from '../services/AuthService';

const REPO_NAME = 'web-ade-collections';

/**
 * Complete GitHub FileSystemAdapter for main process
 * Implements all FileSystemAdapter methods using GitHub Contents API
 */
export class GitHubFileSystemAdapter implements FileSystemAdapter {
  private owner: string | null = null;
  private fileCache: Map<string, { content: string; sha: string }> = new Map();

  /**
   * Initialize the adapter by fetching authenticated user info
   */
  async initialize(): Promise<void> {
    const user = await authService.getCurrentUser();
    this.owner = user?.login || null;
    if (!this.owner) {
      throw new Error('Not authenticated - cannot initialize GitHubFileSystemAdapter');
    }
    console.log(`[GitHubFileSystemAdapter] Initialized for user: ${this.owner}`);
  }

  // ============================================================================
  // File Operations (async - GitHub API calls)
  // ============================================================================

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.getFileFromGitHub(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    const { content } = await this.getFileFromGitHub(filePath);
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated - cannot write file');
    }

    // Get current SHA if file exists
    let sha: string | undefined;
    try {
      const existing = await this.getFileFromGitHub(filePath);
      sha = existing.sha;
    } catch {
      // File doesn't exist, that's OK - we'll create it
    }

    const encoded = Buffer.from(content).toString('base64');
    const url = `https://api.github.com/repos/${this.owner}/${REPO_NAME}/contents/${filePath}`;

    console.log(`[GitHubFileSystemAdapter] Writing file: ${filePath}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Update ${filePath} - ${new Date().toISOString()}`,
        content: encoded,
        ...(sha && { sha }),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to write ${filePath}: ${response.statusText} - ${errorBody}`);
    }

    // Update cache
    const result = await response.json() as { content: { sha: string } };
    this.fileCache.set(filePath, { content, sha: result.content.sha });
    console.log(`[GitHubFileSystemAdapter] Successfully wrote: ${filePath}`);
  }

  async deleteFile(filePath: string): Promise<void> {
    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated - cannot delete file');
    }

    const { sha } = await this.getFileFromGitHub(filePath);
    const url = `https://api.github.com/repos/${this.owner}/${REPO_NAME}/contents/${filePath}`;

    console.log(`[GitHubFileSystemAdapter] Deleting file: ${filePath}`);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Delete ${filePath} - ${new Date().toISOString()}`,
        sha,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to delete ${filePath}: ${response.statusText} - ${errorBody}`);
    }

    this.fileCache.delete(filePath);
    console.log(`[GitHubFileSystemAdapter] Successfully deleted: ${filePath}`);
  }

  // Binary file operations (not used by CollectionStorageAdapter but required by interface)
  async readBinaryFile(_filePath: string): Promise<Uint8Array> {
    throw new Error('Binary file operations not implemented for GitHub adapter');
  }

  async writeBinaryFile(_filePath: string, _content: Uint8Array): Promise<void> {
    throw new Error('Binary file operations not implemented for GitHub adapter');
  }

  // ============================================================================
  // Directory Operations
  // ============================================================================

  async createDir(dirPath: string): Promise<void> {
    // GitHub doesn't have empty directories
    // Create a .gitkeep file to represent the directory
    await this.writeFile(`${dirPath}/.gitkeep`, '');
    console.log(`[GitHubFileSystemAdapter] Created directory: ${dirPath}`);
  }

  async readDir(dirPath: string): Promise<string[]> {
    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated - cannot read directory');
    }

    const url = `https://api.github.com/repos/${this.owner}/${REPO_NAME}/contents/${dirPath}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Directory doesn't exist
        return [];
      }
      const errorBody = await response.text();
      throw new Error(`Failed to read directory ${dirPath}: ${response.statusText} - ${errorBody}`);
    }

    const entries = await response.json();
    if (!Array.isArray(entries)) {
      throw new Error(`Expected directory but got file: ${dirPath}`);
    }

    return entries
      .map((e: { name: string }) => e.name)
      .filter((name: string) => name !== '.gitkeep');
  }

  async deleteDir(_dirPath: string): Promise<void> {
    throw new Error('Directory deletion not implemented for GitHub adapter');
  }

  async isDirectory(dirPath: string): Promise<boolean> {
    const token = await authService.getValidToken();
    if (!token) {
      return false;
    }

    const url = `https://api.github.com/repos/${this.owner}/${REPO_NAME}/contents/${dirPath}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return Array.isArray(data); // Directories return arrays, files return objects
  }

  // ============================================================================
  // Path Operations (synchronous - use Node's path module)
  // ============================================================================

  join(...paths: string[]): string {
    return path.posix.join(...paths);
  }

  relative(from: string, to: string): string {
    return path.posix.relative(from, to);
  }

  dirname(filePath: string): string {
    return path.posix.dirname(filePath);
  }

  isAbsolute(filePath: string): boolean {
    return path.posix.isAbsolute(filePath);
  }

  basename(filePath: string, ext?: string): string {
    return path.posix.basename(filePath, ext);
  }

  extname(filePath: string): string {
    return path.posix.extname(filePath);
  }

  normalize(filePath: string): string {
    return path.posix.normalize(filePath);
  }

  homedir(): string {
    // GitHub adapter doesn't have a concept of home directory
    return '/';
  }

  async rename(_from: string, _to: string): Promise<void> {
    throw new Error('Rename operation not implemented for GitHub adapter');
  }

  async stat(_filePath: string): Promise<{ mtime: Date; isDirectory: boolean; size: number }> {
    throw new Error('Stat operation not implemented for GitHub adapter');
  }

  // Repository operations (not used but required by interface)
  normalizeRepositoryPath(inputPath: string): string {
    return path.posix.normalize(inputPath);
  }

  findProjectRoot(_inputPath: string): string {
    // GitHub adapter doesn't have a concept of project root
    return '/';
  }

  getRepositoryName(_repositoryPath: string): string {
    return REPO_NAME;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Fetch a file from GitHub with caching
   */
  private async getFileFromGitHub(filePath: string): Promise<{ content: string; sha: string }> {
    // Check cache first
    const cached = this.fileCache.get(filePath);
    if (cached) {
      return cached;
    }

    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated - cannot read file');
    }

    const url = `https://api.github.com/repos/${this.owner}/${REPO_NAME}/contents/${filePath}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`File not found: ${filePath}`);
    }

    const data = await response.json() as { content: string; sha: string };
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const result = { content, sha: data.sha };

    // Cache it
    this.fileCache.set(filePath, result);
    return result;
  }

  /**
   * Clear the file cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * Get current owner (authenticated user)
   */
  getOwner(): string | null {
    return this.owner;
  }
}
