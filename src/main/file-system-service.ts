import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  content?: string;
  size?: number;
}

export interface FileTreeOptions {
  maxDepth?: number;
  includeContent?: boolean;
  exclude?: string[];
  maxFileSize?: number; // Max file size to read content (in bytes)
}

export class FileSystemService {
  private static readonly DEFAULT_EXCLUDE = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
    '.turbo',
    '.vercel',
    '.netlify',
    'out',
    'tmp',
    'temp',
  ];

  private static readonly DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1MB

  static async getDirectoryTree(
    dirPath: string,
    options: FileTreeOptions = {},
  ): Promise<FileTreeNode> {
    const {
      maxDepth = 5,
      includeContent = false,
      exclude = this.DEFAULT_EXCLUDE,
      maxFileSize = this.DEFAULT_MAX_FILE_SIZE,
    } = options;

    return this.buildTree(
      dirPath,
      dirPath,
      0,
      maxDepth,
      includeContent,
      exclude,
      maxFileSize,
    );
  }

  private static async buildTree(
    rootPath: string,
    currentPath: string,
    currentDepth: number,
    maxDepth: number,
    includeContent: boolean,
    exclude: string[],
    maxFileSize: number,
  ): Promise<FileTreeNode> {
    const name = path.basename(currentPath);
    const stats = await stat(currentPath);

    if (stats.isFile()) {
      const node: FileTreeNode = {
        name,
        path: path.relative(rootPath, currentPath),
        type: 'file',
        size: stats.size,
      };

      // Include content if requested and file is not too large
      if (includeContent && stats.size <= maxFileSize) {
        try {
          // Only read text files
          const ext = path.extname(name).toLowerCase();
          const textExtensions = [
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.json',
            '.md',
            '.txt',
            '.html',
            '.css',
            '.scss',
            '.yaml',
            '.yml',
            '.toml',
            '.env',
            '.gitignore',
            '.prettierrc',
            '.eslintrc',
            '.py',
            '.java',
            '.c',
            '.cpp',
            '.h',
            '.hpp',
            '.go',
            '.rs',
            '.swift',
            '.kt',
            '.rb',
            '.php',
            '.sh',
            '.bash',
          ];

          if (textExtensions.includes(ext) || !ext) {
            node.content = await readFile(currentPath, 'utf-8');
          }
        } catch (error) {
          console.error(`Failed to read file ${currentPath}:`, error);
        }
      }

      return node;
    }

    // Directory
    const node: FileTreeNode = {
      name,
      path: path.relative(rootPath, currentPath) || '.',
      type: 'directory',
      children: [],
    };

    // Check if we've reached max depth
    if (currentDepth >= maxDepth) {
      return node;
    }

    try {
      const items = await readdir(currentPath);

      for (const item of items) {
        // Skip excluded directories
        if (exclude.includes(item)) {
          continue;
        }

        // Skip hidden files/folders (starting with .)
        if (item.startsWith('.') && item !== '.env' && item !== '.gitignore') {
          continue;
        }

        const itemPath = path.join(currentPath, item);

        try {
          const childNode = await this.buildTree(
            rootPath,
            itemPath,
            currentDepth + 1,
            maxDepth,
            includeContent,
            exclude,
            maxFileSize,
          );
          if (node.children) {
            node.children.push(childNode);
          }
        } catch (error) {
          console.error(`Failed to process ${itemPath}:`, error);
        }
      }

      // Sort children: directories first, then files, alphabetically
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }
    } catch (error) {
      console.error(`Failed to read directory ${currentPath}:`, error);
    }

    return node;
  }

  static async loadAllTextFiles(
    dirPath: string,
    options: Partial<FileTreeOptions> = {},
  ): Promise<Map<string, string>> {
    const fileContents = new Map<string, string>();

    const tree = await this.getDirectoryTree(dirPath, {
      ...options,
      includeContent: true,
    });

    this.collectFileContents(tree, fileContents);
    return fileContents;
  }

  private static collectFileContents(
    node: FileTreeNode,
    fileContents: Map<string, string>,
  ): void {
    if (node.type === 'file' && node.content) {
      fileContents.set(node.path, node.content);
    } else if (node.type === 'directory' && node.children) {
      for (const child of node.children) {
        this.collectFileContents(child, fileContents);
      }
    }
  }

  static async getAvailableLocalClones(): Promise<
    Array<{
      path: string;
      name: string;
      remote?: string;
    }>
  > {
    // This would typically scan a known directory for git repositories
    // For now, return empty array - can be implemented later
    return [];
  }

  /**
   * Delete a directory and all its contents
   * @param dirPath - Path to the directory to delete
   * @returns Promise<void>
   * @throws Error if deletion fails
   */
  static async deleteDirectory(dirPath: string): Promise<void> {
    try {
      // Check if path exists before deletion
      await fsPromises.access(dirPath);

      // Use recursive deletion for the directory
      await fsPromises.rm(dirPath, { recursive: true, force: true });
      console.log(`Successfully deleted directory: ${dirPath}`);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        // Directory doesn't exist, consider it a success
        console.log(`Directory does not exist, nothing to delete: ${dirPath}`);
        return;
      }

      console.error(`Failed to delete directory ${dirPath}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete directory: ${errorMessage}`);
    }
  }

  /**
   * Check if a path exists
   * @param pathToCheck - Path to check
   * @returns Promise<boolean> true if exists, false otherwise
   */
  static async pathExists(pathToCheck: string): Promise<boolean> {
    try {
      await fsPromises.access(pathToCheck);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get directory info including size and modification time
   * @param dirPath - Path to the directory
   * @returns Promise with sizeBytes and mtime (ISO string)
   */
  static async getDirectoryInfo(
    dirPath: string,
  ): Promise<{ sizeBytes: number; mtime: string }> {
    try {
      // Get modification time from stat
      const stats = await fsPromises.stat(dirPath);
      const mtime = stats.mtime.toISOString();

      // Get directory size using platform-specific commands
      let sizeBytes = 0;

      if (process.platform === 'darwin' || process.platform === 'linux') {
        // Use du -sk for size in KB
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        try {
          const { stdout } = await execAsync(`du -sk "${dirPath}"`);
          const sizeKB = parseInt(stdout.trim().split(/\s+/)[0]) || 0;
          sizeBytes = sizeKB * 1024;
        } catch (error) {
          console.error(`Error getting directory size for ${dirPath}:`, error);
        }
      } else if (process.platform === 'win32') {
        // Windows: use PowerShell to get folder size
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        try {
          const { stdout } = await execAsync(
            `powershell -command "(Get-ChildItem -Path '${dirPath}' -Recurse | Measure-Object -Property Length -Sum).Sum"`,
          );
          sizeBytes = parseInt(stdout.trim()) || 0;
        } catch (error) {
          console.error(`Error getting directory size for ${dirPath}:`, error);
        }
      }

      return { sizeBytes, mtime };
    } catch (error) {
      console.error(`Error getting directory info for ${dirPath}:`, error);
      // Return defaults if we can't read the directory
      return { sizeBytes: 0, mtime: new Date(0).toISOString() };
    }
  }
}
