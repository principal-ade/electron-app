import * as fs from 'fs/promises';
import * as path from 'path';
import { IFileSystemAdapter } from '../core/SlideDocumentManager';

/**
 * Electron/Node.js file system adapter
 */
export class ElectronFileSystemAdapter implements IFileSystemAdapter {
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }
  
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(dirPath, options);
  }
}