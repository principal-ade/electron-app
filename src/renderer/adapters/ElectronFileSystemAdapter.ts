import { FileSystemAdapter } from '@principal-ai/codebase-composition';
import { FileSystemService } from '../main-process-api/FileSystemService';

/**
 * Electron-specific implementation of FileSystemAdapter that uses IPC to communicate
 * with the main process for file system operations.
 */
export class ElectronFileSystemAdapter implements FileSystemAdapter {
  async readFile(path: string): Promise<{ content: string } | null> {
    try {
      const result = await FileSystemService.readFile(path);
      if (!result) return null;

      // The Electron API returns { content, filePath }, we only need content
      return { content: result.content };
    } catch (error) {
      console.error(
        '[ElectronFileSystemAdapter] Error reading file:',
        path,
        error,
      );
      return null;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const stats = await FileSystemService.getFileStats(path);
      return stats !== null;
    } catch (error) {
      return false;
    }
  }

  async readDirectory(path: string): Promise<string[]> {
    try {
      const entries = await FileSystemService.readDirectory(path);
      return entries || [];
    } catch (error) {
      console.error(
        '[ElectronFileSystemAdapter] Error reading directory:',
        path,
        error,
      );
      return [];
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await FileSystemService.getFileStats(path);
      return stats?.isDirectory || false;
    } catch (error) {
      console.error(
        '[ElectronFileSystemAdapter] Error getting file stats:',
        path,
        error,
      );
      return false;
    }
  }

  // Additional method that the shared FilesystemService might need
  async getFileStats(path: string): Promise<{
    size: number;
    isDirectory: boolean;
    lastModified: Date;
  } | null> {
    try {
      return await FileSystemService.getFileStats(path);
    } catch (error) {
      console.error(
        '[ElectronFileSystemAdapter] Error getting file stats:',
        path,
        error,
      );
      return null;
    }
  }

}
