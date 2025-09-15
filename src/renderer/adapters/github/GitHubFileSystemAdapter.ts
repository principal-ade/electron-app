import { FileSystemAdapter } from "@principal-ai/codebase-composition";
import { GithubService } from "../../main-process-api/GithubService";

export class GitHubFileSystemAdapter implements FileSystemAdapter {
  private treeCache: any[] | null = null;

  constructor(
    private owner: string,
    private repo: string,
    private branch?: string,
  ) {}

  async readFile(path: string): Promise<{ content: string } | null> {
    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const content = await GithubService.getFileContent(this.owner, this.repo, cleanPath, this.branch);
      if (content !== null && content !== undefined) {
        return { content };
      }
      return null;
    } catch (error) {
      console.error('[GitHubFileSystemAdapter] Error reading file:', error);
      return null;
    }
  }

  async readDirectory(path: string): Promise<string[]> {
    try {
      let cleanPath = path === '/' || path === '' ? '' : path.startsWith('/') ? path.slice(1) : path;
      cleanPath = cleanPath.replace(/\/$/, '');

      if (!this.treeCache) {
        try {
          const result = await GithubService.getTree(this.owner, this.repo, this.branch || 'main');
          if (!result || !result.success || !result.data) {
            const errorMessage = `Failed to fetch tree: ${result?.error || 'Unknown error'}`;
            console.error(`[GitHubFileSystemAdapter] ${errorMessage}`);
            throw new Error(errorMessage);
          }
          this.treeCache = result.data.tree;
        } catch (error) {
          console.error('[GitHubFileSystemAdapter] Error fetching tree:', error);
          throw error;
        }
      }

      const entries: string[] = [];
      const prefix = cleanPath ? `${cleanPath}/` : '';
      const prefixLength = prefix.length;

      for (const item of this.treeCache) {
        if (cleanPath && !item.path.startsWith(prefix)) {
          continue;
        }
        const relativePath = cleanPath ? item.path.slice(prefixLength) : item.path;
        if (relativePath.includes('/')) {
          continue;
        }
        if (item.type === 'tree') {
          entries.push(relativePath + '/');
        } else {
          entries.push(relativePath);
        }
      }

      return entries;
    } catch (error) {
      console.error('[GitHubFileSystemAdapter] Error reading directory:', error);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (cleanPath === '' || cleanPath === '/') {
      return true;
    }
    if (!this.treeCache) {
      await this.readDirectory('');
    }
    if (this.treeCache) {
      return this.treeCache.some(item =>
        item.path === cleanPath ||
        item.path === cleanPath.replace(/\/$/, '')
      );
    }
    return false;
  }

  async getStats(path: string): Promise<{ isDirectory: boolean; isFile: boolean; size?: number } | null> {
    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      if (!cleanPath || cleanPath === '/') {
        return { isDirectory: true, isFile: false };
      }
      if (!this.treeCache) {
        await this.readDirectory('');
      }
      if (this.treeCache) {
        const item = this.treeCache.find((i: any) =>
          i.path === cleanPath ||
          i.path === cleanPath.replace(/\/$/, '')
        );
        if (item) {
          return {
            isDirectory: item.type === 'tree',
            isFile: item.type === 'blob',
            size: item.size
          };
        }
      }
      return null;
    } catch (error) {
      console.error('[GitHubFileSystemAdapter] Error getting stats:', error);
      return null;
    }
  }

  async writeFile(_path: string, _content: string): Promise<void> {
    throw new Error('Writing files not supported for GitHub repositories');
  }

  async createDirectory(_path: string): Promise<void> {
    throw new Error('Creating directories not supported for GitHub repositories');
  }

  async deleteFile(_path: string): Promise<void> {
    throw new Error('Deleting files not supported for GitHub repositories');
  }

  async deleteDirectory(_path: string): Promise<void> {
    throw new Error('Deleting directories not supported for GitHub repositories');
  }

  async copyFile(_source: string, _destination: string): Promise<void> {
    throw new Error('Copying files not supported for GitHub repositories');
  }

  async moveFile(_source: string, _destination: string): Promise<void> {
    throw new Error('Moving files not supported for GitHub repositories');
  }

  async getFullTree(): Promise<any> {
    return null;
  }

  async fileExists(path: string): Promise<boolean> {
    return this.exists(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    const stats = await this.getStats(path);
    return stats?.isDirectory || false;
  }

  async getFileStats(path: string): Promise<{
    size: number;
    isDirectory: boolean;
    lastModified: Date;
  } | null> {
    const stats = await this.getStats(path);
    if (stats) {
      return {
        size: stats.size || 0,
        isDirectory: stats.isDirectory,
        lastModified: new Date(), // GitHub doesn't provide lastModified easily
      };
    }
    return null;
  }

  /**
   * Build filtered file tree from GitHub's tree API
   * NOTE: Currently just returns all files from the tree without filtering.
   * GitHub already only shows committed files, and pattern filtering for UI preferences
   * can be added later if needed.
   */
  async buildFilteredFileTree(
    directoryPath: string,
    patterns?: string[],
    sourceDirectory?: string
  ): Promise<{
    paths: string[];
    stats?: Map<string, {
      size: number;
      isDirectory: boolean;
      lastModified: Date;
    }>;
  }> {
    // TODO: Implement pattern filtering if needed for UI preferences
    if (patterns && patterns.length > 0) {
      console.log(
        '[GitHubFileSystemAdapter] Pattern filtering not implemented. Ignoring patterns.',
        { patterns, sourceDirectory }
      );
    }

    // Ensure we have the tree cached
    if (!this.treeCache) {
      const result = await GithubService.getTree(this.owner, this.repo, this.branch || 'main');
      if (!result || !result.success || !result.data) {
        console.error('[GitHubFileSystemAdapter] Failed to fetch tree:', result?.error);
        return { paths: [] };
      }
      this.treeCache = result.data.tree;
    }

    // Simply convert the tree to the expected format
    const paths: string[] = [];
    const stats = new Map<string, {
      size: number;
      isDirectory: boolean;
      lastModified: Date;
    }>();

    // Filter by directory if specified
    const prefix = directoryPath && directoryPath !== '/' && directoryPath !== '' 
      ? (directoryPath.startsWith('/') ? directoryPath.slice(1) : directoryPath).replace(/\/$/, '') + '/'
      : '';

    for (const item of this.treeCache) {
      let path = item.path;
      
      // Apply directory filter
      if (prefix) {
        if (!path.startsWith(prefix)) continue;
        path = path.slice(prefix.length);
      }
      
      if (!path) continue;

      const isDirectory = item.type === 'tree';
      const finalPath = isDirectory ? path + '/' : path;
      
      paths.push(finalPath);
      stats.set(finalPath, {
        size: item.size || 0,
        isDirectory,
        lastModified: new Date()
      });
    }

    return { paths, stats };
  }
} 