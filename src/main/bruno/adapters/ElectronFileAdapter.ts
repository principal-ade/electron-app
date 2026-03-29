/**
 * Electron File System Adapter
 *
 * Implements IFileAdapter using Node.js fs module for the main process.
 */

import fs from 'fs/promises';
import type { IFileAdapter } from './interfaces';

export class ElectronFileAdapter implements IFileAdapter {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
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

  async readDir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath);
  }

  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
