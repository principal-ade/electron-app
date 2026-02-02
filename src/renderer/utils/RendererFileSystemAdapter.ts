/**
 * Renderer-side implementation of FileSystemAdapter interface.
 * Bridges file system operations to the main process via IPC.
 *
 * Used by LibraryLoader to parse library.yaml files in the renderer process.
 */

import type { FileSystemAdapter } from '@principal-ai/repository-abstraction';
import * as pathBrowserify from 'path-browserify';
import { FileSystemService } from '../main-process-api/FileSystemService';

export class RendererFileSystemAdapter implements FileSystemAdapter {
  // ============================================================================
  // File Operations (async)
  // ============================================================================

  async exists(path: string): Promise<boolean> {
    try {
      const stats = await FileSystemService.getFileStats(path);
      return stats !== null;
    } catch {
      return false;
    }
  }

  async readFile(path: string): Promise<string> {
    const result = await FileSystemService.readFile(path);
    if (!result || !result.content) {
      throw new Error(`Failed to read file: ${path}`);
    }
    return result.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const result = await FileSystemService.writeFile(path, content);
    if (!result || !result.success) {
      throw new Error(`Failed to write file: ${path}`);
    }
  }

  async deleteFile(path: string): Promise<void> {
    const result = await FileSystemService.deleteFile(path);
    if (!result || !result.success) {
      throw new Error(`Failed to delete file: ${path}. ${result?.error || ''}`);
    }
  }

  // ============================================================================
  // Sync Variants (optional)
  // ============================================================================

  existsSync(path: string): boolean {
    // Note: Sync operations are not truly synchronous in the renderer
    // These are provided for compatibility but will throw if called
    throw new Error('Synchronous file operations are not supported in renderer process. Use async methods instead.');
  }

  readFileSync(path: string): string {
    throw new Error('Synchronous file operations are not supported in renderer process. Use async methods instead.');
  }

  writeFileSync(path: string, content: string): void {
    throw new Error('Synchronous file operations are not supported in renderer process. Use async methods instead.');
  }

  // ============================================================================
  // Directory Operations
  // ============================================================================

  async createDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    // Note: There's currently no IPC handler for createDir
    // If needed in the future, add a handler in fileSystemHandlers.ts
    // For now, LibraryLoader only needs read operations, so this should not be called
    throw new Error('createDir is not implemented in renderer process. If needed, add IPC handler in main process.');
  }

  async readDir(path: string): Promise<string[]> {
    const entries = await FileSystemService.readDirectory(path);
    return entries || [];
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await FileSystemService.getFileStats(path);
      return stats?.isDirectory ?? false;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Path Operations (synchronous, pure string manipulation)
  // ============================================================================

  join(...paths: string[]): string {
    return pathBrowserify.join(...paths);
  }

  dirname(path: string): string {
    return pathBrowserify.dirname(path);
  }

  basename(path: string, ext?: string): string {
    return pathBrowserify.basename(path, ext);
  }

  extname(path: string): string {
    return pathBrowserify.extname(path);
  }

  relative(from: string, to: string): string {
    return pathBrowserify.relative(from, to);
  }

  isAbsolute(path: string): boolean {
    return pathBrowserify.isAbsolute(path);
  }

  normalize(path: string): string {
    return pathBrowserify.normalize(path);
  }

  // ============================================================================
  // Environment-specific Helpers
  // ============================================================================

  homedir(): string {
    // Note: This is synchronous but we need to get it from main process
    // For now, we'll throw an error. If needed, cache it during initialization
    // or add a synchronous IPC call (not recommended)
    throw new Error('homedir() requires async initialization. Use FileSystemService.getHomePath() instead.');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Initialize the adapter by caching the home directory.
   * Call this before using the adapter if homedir() support is needed.
   */
  private cachedHomedir?: string;

  async initialize(): Promise<void> {
    this.cachedHomedir = await FileSystemService.getHomePath();
  }

  /**
   * Get the home directory (requires initialization).
   * If not initialized, returns a placeholder.
   */
  homedirCached(): string {
    if (!this.cachedHomedir) {
      console.warn('[RendererFileSystemAdapter] homedir() called before initialization. Returning placeholder.');
      return '/home';
    }
    return this.cachedHomedir;
  }
}

/**
 * Create and initialize a RendererFileSystemAdapter instance.
 * Use this factory function to ensure the adapter is properly initialized.
 */
export async function createRendererFileSystemAdapter(): Promise<RendererFileSystemAdapter> {
  const adapter = new RendererFileSystemAdapter();
  await adapter.initialize();
  return adapter;
}
