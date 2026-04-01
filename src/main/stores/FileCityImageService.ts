/**
 * FileCityImageService - Generates File City visualization images for repositories
 *
 * Uses file tree data from the repository-monitoring cache to generate
 * treemap-style PNG visualizations. Images are cached to disk to avoid
 * regenerating them on every request.
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import { FileCityImageAPIEvent } from '../../shared/main-process-api-interfaces/FileCityImageAPI';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import { CodeCityBuilderWithGrid } from '@principal-ai/file-city-builder';
import {
  createDrawContext,
  drawDistricts,
  drawBuildings,
  RenderMode,
} from '@principal-ai/file-city-server';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { getManager } from '../repository-monitoring/ipcHandlers';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

// Type alias to handle canvas version mismatches between packages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompatibleContext = any;

// Lazy-loaded canvas module (avoids webpack bundling issues with native .node files)
// Using require() instead of import() because webpack doesn't analyze require() the same way
let canvasModule: typeof import('canvas') | null = null;
function getCanvasModule(): typeof import('canvas') {
  if (!canvasModule) {
    canvasModule = require('canvas');
  }
  // canvasModule is guaranteed to be set after the above check
  return canvasModule as typeof import('canvas');
}

const DEFAULT_DIRECTORY_COLOR = '#111827';
const IMAGE_WIDTH = 400;
const IMAGE_HEIGHT = 400;

export class FileCityImageService {
  private static instance: FileCityImageService;
  private cacheDir: string;
  private initialized = false;

  private constructor() {
    // Cache images in the app's user data directory
    this.cacheDir = path.join(app.getPath('userData'), 'file-city-images');
  }

  static getInstance(): FileCityImageService {
    if (!FileCityImageService.instance) {
      FileCityImageService.instance = new FileCityImageService();
    }
    return FileCityImageService.instance;
  }

  /**
   * Initialize the service (create cache directory if needed)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      console.error('[FileCityImageService] Failed to create cache directory:', error);
    }
  }

  /**
   * Generate a cache key for a repository based on path and file tree SHA
   */
  private getCacheKey(repoPath: string, fileTreeSha: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${repoPath}:${fileTreeSha}`);
    return hash.digest('hex').slice(0, 16);
  }

  /**
   * Get the cache file path for a given cache key
   */
  private getCachePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.png`);
  }

  /**
   * Check if a cached image exists and return its path
   */
  private async getCachedImagePath(cacheKey: string): Promise<string | null> {
    const cachePath = this.getCachePath(cacheKey);
    try {
      await fs.access(cachePath);
      return cachePath;
    } catch {
      return null;
    }
  }

  /**
   * Generate a File City PNG image from a file tree
   */
  private async generateImage(fileTree: FileTree): Promise<Buffer> {
    if (!fileTree.root || fileTree.allFiles.length === 0) {
      throw new Error('No files in file tree');
    }

    // Build city layout using the builder - pass the FileTree directly
    const builder = new CodeCityBuilderWithGrid();

    const cityData = builder.buildCityFromFileSystem(fileTree, '', {
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 2,
      paddingRight: 2,
    });

    // Create canvas and render (using lazy-loaded canvas module)
    const { createCanvas } = getCanvasModule();
    const canvas = createCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
    const ctx = canvas.getContext('2d') as CompatibleContext;

    // Create draw context with scaling
    const padding = Math.min(IMAGE_WIDTH, IMAGE_HEIGHT) * 0.05;
    const drawContext = createDrawContext(ctx, IMAGE_WIDTH, IMAGE_HEIGHT, cityData, padding);

    // Draw districts first (background)
    drawDistricts(
      RenderMode.HIGHLIGHT,
      ctx,
      cityData.districts,
      drawContext.worldToCanvas,
      drawContext.scale,
      undefined, // highlightedDirectories
      undefined, // hoveredDirectories
      undefined, // hoveredDistrict
      true, // fullSize
      undefined, // selectedPaths
      undefined, // changedFiles
      undefined, // theme
      undefined, // customColorFn
      DEFAULT_DIRECTORY_COLOR, // defaultDirectoryColor
      false // showDirectoryLabels
    );

    // Draw buildings on top
    drawBuildings(
      'highlight',
      ctx,
      cityData.buildings,
      drawContext.worldToCanvas,
      drawContext.scale,
      undefined, // highlightedPaths
      undefined, // selectedPaths
      undefined, // focusDirectory
      undefined, // hoveredBuilding
      undefined, // theme
      undefined, // customColorFn
      false, // showFileNames
      true // fullSize
    );

    return canvas.toBuffer('image/png');
  }

  /**
   * Generate a File City PNG image from a file tree with changed files highlighted
   */
  private async generateImageWithChanges(
    fileTree: FileTree,
    changedFiles: Map<string, 'added' | 'modified' | 'deleted' | 'renamed'>,
  ): Promise<Buffer> {
    if (!fileTree.root || fileTree.allFiles.length === 0) {
      throw new Error('No files in file tree');
    }

    // Build city layout using the builder - pass the FileTree directly
    const builder = new CodeCityBuilderWithGrid();

    const cityData = builder.buildCityFromFileSystem(fileTree, '', {
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 2,
      paddingRight: 2,
    });

    // Create canvas and render (using lazy-loaded canvas module)
    const { createCanvas } = getCanvasModule();
    const canvas = createCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
    const ctx = canvas.getContext('2d') as CompatibleContext;

    // Create draw context with scaling
    const padding = Math.min(IMAGE_WIDTH, IMAGE_HEIGHT) * 0.05;
    const drawContext = createDrawContext(ctx, IMAGE_WIDTH, IMAGE_HEIGHT, cityData, padding);

    // Draw districts first (background)
    drawDistricts(
      RenderMode.HIGHLIGHT,
      ctx,
      cityData.districts,
      drawContext.worldToCanvas,
      drawContext.scale,
      undefined, // highlightedDirectories
      undefined, // hoveredDirectories
      undefined, // hoveredDistrict
      true, // fullSize
      undefined, // selectedPaths
      changedFiles, // changedFiles - passed for highlight layer support
      undefined, // theme
      undefined, // customColorFn
      DEFAULT_DIRECTORY_COLOR, // defaultDirectoryColor
      false // showDirectoryLabels
    );

    // Draw buildings on top with changed files highlighted
    drawBuildings(
      'highlight',
      ctx,
      cityData.buildings,
      drawContext.worldToCanvas,
      drawContext.scale,
      undefined, // highlightedPaths
      undefined, // selectedPaths
      undefined, // focusDirectory
      undefined, // hoveredBuilding
      undefined, // theme
      undefined, // customColorFn
      false, // showFileNames
      true, // fullSize
      changedFiles // changedFiles - passed to show highlight borders
    );

    return canvas.toBuffer('image/png');
  }

  /**
   * Get or generate a File City image for a repository
   * Returns data URL (base64) for the image, or null if the file tree isn't cached
   */
  async getImageForRepository(repoPath: string): Promise<string | null> {
    await this.ensureInitialized();

    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('file_city.image.generation', {
      attributes: { 'repo_path': repoPath },
    });
    const startTime = Date.now();

    try {
      // Emit request event
      span.addEvent('file_city.image.requested', {
        'repo_path': repoPath,
      });

      // Get file tree from repository-monitoring cache
      const manager = getManager();
      const fileTree = await manager.getFileTree(repoPath);

      // Emit filetree fetched event
      span.addEvent('file_city.filetree.fetched', {
        'repo_path': repoPath,
        'has_tree': Boolean(fileTree && fileTree.allFiles.length > 0),
        ...(fileTree && {
          'file_count': fileTree.allFiles.length,
          'tree_sha': fileTree.sha || 'unknown',
        }),
      });

      if (!fileTree || fileTree.allFiles.length === 0) {
        console.log('[FileCityImageService] No cached file tree for:', repoPath);
        span.addEvent('file_city.image.skipped', {
          'repo_path': repoPath,
          'reason': 'no_file_tree',
        });
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
      }

      // Check if we have a cached image
      const cacheKey = this.getCacheKey(repoPath, fileTree.sha || 'unknown');
      const cachedPath = await this.getCachedImagePath(cacheKey);

      // Emit cache check event
      span.addEvent('file_city.cache.checked', {
        'repo_path': repoPath,
        'cache_key': cacheKey,
        'cache_hit': Boolean(cachedPath),
      });

      if (cachedPath) {
        console.log('[FileCityImageService] Cache hit for:', repoPath);
        span.addEvent('file_city.image.cache_hit', {
          'repo_path': repoPath,
          'cache_path': cachedPath,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        // Return as data URL since renderer cannot load file:// URLs with webSecurity enabled
        const cachedBuffer = await fs.readFile(cachedPath);
        return `data:image/png;base64,${cachedBuffer.toString('base64')}`;
      }

      // Generate new image using the FileTree
      console.log('[FileCityImageService] Generating image for:', repoPath);
      span.addEvent('file_city.image.generation_started', {
        'repo_path': repoPath,
        'file_count': fileTree.allFiles.length,
        'image_width': IMAGE_WIDTH,
        'image_height': IMAGE_HEIGHT,
      });

      const imageBuffer = await this.generateImage(fileTree);

      // Save to cache
      const cachePath = this.getCachePath(cacheKey);
      await fs.writeFile(cachePath, imageBuffer);

      // Return as data URL since renderer cannot load file:// URLs with webSecurity enabled
      const imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      console.log('[FileCityImageService] Image saved to:', cachePath);

      // Emit generation complete event
      span.addEvent('file_city.image.generation_complete', {
        'repo_path': repoPath,
        'cache_path': cachePath,
        'duration_ms': Date.now() - startTime,
        'file_size_bytes': imageBuffer.length,
      });

      // Broadcast to all windows that a new image was generated
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send(FileCityImageAPIEvent.IMAGE_GENERATED, repoPath, imageUrl);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return imageUrl;
    } catch (error) {
      console.error('[FileCityImageService] Error generating image for', repoPath, error);
      span.addEvent('file_city.image.error', {
        'repo_path': repoPath,
        'error_type': error instanceof Error ? error.constructor.name : 'UnknownError',
        'error_message': error instanceof Error ? error.message : String(error),
        'phase': 'generation',
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Image generation failed',
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Check if a File City image exists for a repository (without generating)
   */
  async hasImageForRepository(repoPath: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const manager = getManager();
      const fileTree = await manager.getFileTree(repoPath);

      if (!fileTree?.sha) {
        return false;
      }

      const cacheKey = this.getCacheKey(repoPath, fileTree.sha);
      const cachedPath = await this.getCachedImagePath(cacheKey);
      return cachedPath !== null;
    } catch {
      return false;
    }
  }

  /**
   * Build a FileTree structure from an array of file paths
   * Used for generating historical snapshots from git ls-tree output
   */
  private buildFileTreeFromPaths(filePaths: string[], commitHash: string): FileTree {
    // FileInfo interface from @principal-ai/repository-abstraction
    interface FileInfo {
      path: string;
      name: string;
      extension: string;
      size: number;
      lastModified: Date;
      isDirectory: boolean;
      relativePath: string;
    }

    // DirectoryInfo interface
    interface DirectoryInfo {
      path: string;
      name: string;
      children: (FileInfo | DirectoryInfo)[];
      fileCount: number;
      totalSize: number;
      depth: number;
      relativePath: string;
    }

    const allFiles: FileInfo[] = [];
    const allDirectories: DirectoryInfo[] = [];
    const directoryMap = new Map<string, DirectoryInfo>();

    // Create root directory
    const root: DirectoryInfo = {
      name: '',
      path: '',
      relativePath: '',
      children: [],
      fileCount: 0,
      totalSize: 0,
      depth: 0,
    };
    directoryMap.set('', root);

    // Process each file path
    for (const filePath of filePaths) {
      const parts = filePath.split('/');
      const fileName = parts[parts.length - 1];
      const dirPath = parts.slice(0, -1).join('/');

      // Ensure all parent directories exist
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

        if (!directoryMap.has(currentPath)) {
          const dir: DirectoryInfo = {
            name: parts[i],
            path: currentPath,
            relativePath: currentPath,
            children: [],
            fileCount: 0,
            totalSize: 0,
            depth: i + 1,
          };
          directoryMap.set(currentPath, dir);
          allDirectories.push(dir);

          // Add to parent
          const parent = directoryMap.get(parentPath);
          if (parent) {
            parent.children.push(dir);
          }
        }
      }

      // Create file info
      const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
      const fileInfo: FileInfo = {
        name: fileName,
        path: filePath,
        relativePath: filePath,
        extension,
        size: 100, // Default size
        lastModified: new Date(),
        isDirectory: false,
      };
      allFiles.push(fileInfo);

      // Add file to parent directory
      const parentDir = directoryMap.get(dirPath) || root;
      parentDir.children.push(fileInfo);
      parentDir.fileCount++;
      parentDir.totalSize += fileInfo.size;
    }

    // Update directory stats (propagate counts up)
    const updateDirStats = (dir: DirectoryInfo): { files: number; size: number } => {
      let totalFiles = dir.fileCount;
      let totalSize = dir.totalSize;

      for (const child of dir.children) {
        if ('children' in child) {
          const childStats = updateDirStats(child as DirectoryInfo);
          totalFiles += childStats.files;
          totalSize += childStats.size;
        }
      }

      dir.fileCount = totalFiles;
      dir.totalSize = totalSize;
      return { files: totalFiles, size: totalSize };
    };
    updateDirStats(root);

    // Calculate max depth
    const maxDepth = allFiles.length > 0
      ? Math.max(...allFiles.map(f => f.path.split('/').length))
      : 0;

    return {
      sha: commitHash,
      root,
      allFiles,
      allDirectories,
      stats: {
        totalFiles: allFiles.length,
        totalDirectories: allDirectories.length,
        totalSize: root.totalSize,
        maxDepth,
      },
      metadata: {
        id: `historical-${commitHash}`,
        timestamp: new Date(),
        sourceType: 'git-historical',
        sourceSha: commitHash,
        sourceInfo: {},
      },
    } as unknown as FileTree;
  }

  /**
   * Generate a File City image for a specific commit
   * Uses git ls-tree output to build the file tree
   */
  async getImageForCommit(
    repoPath: string,
    commitHash: string,
    filePaths: string[]
  ): Promise<string | null> {
    await this.ensureInitialized();

    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('file_city.image.historical_generation', {
      attributes: { 'repo_path': repoPath, 'commit_hash': commitHash },
    });

    try {
      if (filePaths.length === 0) {
        span.addEvent('file_city.image.skipped', {
          'repo_path': repoPath,
          'reason': 'no_files',
        });
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
      }

      // Check cache first
      const cacheKey = this.getCacheKey(repoPath, commitHash);
      const cachedPath = await this.getCachedImagePath(cacheKey);

      if (cachedPath) {
        console.log('[FileCityImageService] Cache hit for historical:', commitHash);
        const cachedBuffer = await fs.readFile(cachedPath);
        span.setStatus({ code: SpanStatusCode.OK });
        return `data:image/png;base64,${cachedBuffer.toString('base64')}`;
      }

      // Build file tree from paths
      const fileTree = this.buildFileTreeFromPaths(filePaths, commitHash);

      console.log('[FileCityImageService] Generating historical image for:', commitHash);
      span.addEvent('file_city.image.generation_started', {
        'repo_path': repoPath,
        'commit_hash': commitHash,
        'file_count': filePaths.length,
      });

      const imageBuffer = await this.generateImage(fileTree);

      // Save to cache
      const cachePath = this.getCachePath(cacheKey);
      await fs.writeFile(cachePath, imageBuffer);

      span.addEvent('file_city.image.generation_complete', {
        'repo_path': repoPath,
        'commit_hash': commitHash,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.error('[FileCityImageService] Error generating historical image:', error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Historical image generation failed',
      });
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Generate a File City image for a specific commit with changed files highlighted
   * Uses highlight layers to show which files were added/modified/deleted
   * Accepts either simple status strings or full info objects with line counts
   */
  async getImageForCommitWithChanges(
    repoPath: string,
    commitHash: string,
    filePaths: string[],
    changedFiles: Record<string, 'added' | 'modified' | 'deleted' | 'renamed' | { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>
  ): Promise<string | null> {
    await this.ensureInitialized();

    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('file_city.image.historical_with_changes', {
      attributes: { 'repo_path': repoPath, 'commit_hash': commitHash },
    });

    try {
      if (filePaths.length === 0) {
        span.addEvent('file_city.image.skipped', {
          'repo_path': repoPath,
          'reason': 'no_files',
        });
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
      }

      // Use a different cache key that includes change data hash
      // Sort keys to ensure consistent cache keys regardless of insertion order
      const sortedChangedFiles = Object.keys(changedFiles)
        .sort()
        .reduce((acc, key) => {
          acc[key] = changedFiles[key];
          return acc;
        }, {} as typeof changedFiles);
      const changesHash = crypto.createHash('sha256')
        .update(JSON.stringify(sortedChangedFiles))
        .digest('hex')
        .slice(0, 8);
      const cacheKey = this.getCacheKey(repoPath, `${commitHash}-changes-${changesHash}`);
      const cachedPath = await this.getCachedImagePath(cacheKey);

      if (cachedPath) {
        console.log('[FileCityImageService] Cache hit for historical with changes:', commitHash);
        const cachedBuffer = await fs.readFile(cachedPath);
        span.setStatus({ code: SpanStatusCode.OK });
        return `data:image/png;base64,${cachedBuffer.toString('base64')}`;
      }

      // Build file tree from paths
      const fileTree = this.buildFileTreeFromPaths(filePaths, commitHash);

      // Convert plain object to Map, extracting just status for drawing functions
      // (line counts are stored but not yet used in visualization)
      const changedFilesMap = new Map<string, 'added' | 'modified' | 'deleted' | 'renamed'>();
      for (const [path, info] of Object.entries(changedFiles)) {
        // Handle both simple status strings and full info objects
        const status = typeof info === 'string' ? info : info.status;
        changedFilesMap.set(path, status);
      }

      console.log('[FileCityImageService] Generating historical image with changes for:', commitHash);
      span.addEvent('file_city.image.generation_started', {
        'repo_path': repoPath,
        'commit_hash': commitHash,
        'file_count': filePaths.length,
        'changed_files_count': changedFilesMap.size,
      });

      const imageBuffer = await this.generateImageWithChanges(fileTree, changedFilesMap);

      // Save to cache
      const cachePath = this.getCachePath(cacheKey);
      await fs.writeFile(cachePath, imageBuffer);

      span.addEvent('file_city.image.generation_complete', {
        'repo_path': repoPath,
        'commit_hash': commitHash,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.error('[FileCityImageService] Error generating historical image with changes:', error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Historical image with changes generation failed',
      });
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Clear cached images for a repository
   */
  async clearCacheForRepository(repoPath: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // We'd need to track which cache keys belong to which repo
      // For now, this is a no-op since cache keys include SHA
      console.log('[FileCityImageService] Cache invalidation requested for:', repoPath);
    } catch (error) {
      console.error('[FileCityImageService] Error clearing cache:', error);
    }
  }

  /**
   * Binary file extensions to skip when counting lines
   */
  private static readonly BINARY_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'svg', 'pdf',
    'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib',
    'mp3', 'mp4', 'wav', 'ttf', 'otf', 'woff', 'woff2',
    'lock', // Skip lock files (huge)
  ]);

  /**
   * Check if a file is binary based on extension
   */
  private isBinaryFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return FileCityImageService.BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Count lines in a file content
   */
  private countLinesInContent(content: string): number {
    if (!content) return 0;
    const newlines = (content.match(/\n/g) || []).length;
    return content.endsWith('\n') ? newlines : newlines + 1;
  }

  /**
   * Extract owner/repo from a git remote URL
   * Handles both SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo.git) formats
   */
  private parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
    // SSH format: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return null;
  }

  /**
   * Push line counts to the web-ade cache API
   * Fire and forget - does not block on the response
   */
  private pushLineCountsToWebCache(
    owner: string,
    repo: string,
    lineCounts: Record<string, number>
  ): void {
    const fileCount = Object.keys(lineCounts).length;
    if (fileCount === 0) return;

    const url = `https://app.principal-ade.com/api/line-counts/${owner}/${repo}`;

    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lineCounts,
        fileCount,
      }),
    })
      .then((response) => {
        if (response.ok) {
          console.log(`[FileCityImageService] Pushed line counts to web cache for ${owner}/${repo}`);
        } else {
          console.warn(`[FileCityImageService] Failed to push line counts: ${response.status}`);
        }
      })
      .catch((err) => {
        console.warn('[FileCityImageService] Failed to push line counts to web cache:', err);
      });
  }

  /**
   * Count lines in all tracked files in a repository
   * Returns a map of file paths (with repo prefix) to line counts
   */
  async countLinesInRepository(repoPath: string): Promise<Record<string, number>> {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('file_city.count_lines', {
      attributes: { 'repo_path': repoPath },
    });
    const startTime = Date.now();

    try {
      const lineCounts: Record<string, number> = {};
      const repoName = path.basename(repoPath);

      // Use git ls-files to get tracked files only
      let files: string[];
      try {
        const output = execSync('git ls-files', {
          cwd: repoPath,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
        });
        files = output.split('\n').filter(Boolean);
      } catch (gitError) {
        console.error('[FileCityImageService] git ls-files failed:', gitError);
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'git ls-files failed' });
        return lineCounts;
      }

      span.addEvent('file_city.count_lines.files_listed', {
        'repo_path': repoPath,
        'file_count': files.length,
      });

      // Count lines for each non-binary file
      let processedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        if (this.isBinaryFile(file)) {
          skippedCount++;
          continue;
        }

        try {
          const filePath = path.join(repoPath, file);
          const stat = await fs.stat(filePath);

          // Skip files larger than 1MB (likely minified/generated)
          if (stat.size > 1024 * 1024) {
            skippedCount++;
            continue;
          }

          const content = await fs.readFile(filePath, 'utf-8');
          const lineCount = this.countLinesInContent(content);

          // Key includes repo name prefix to match building.path format
          lineCounts[`${repoName}/${file}`] = lineCount;
          processedCount++;
        } catch (_fileError) {
          // File may have been deleted or be unreadable
          skippedCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[FileCityImageService] Counted lines in ${processedCount} files (skipped ${skippedCount}) in ${duration}ms`);

      span.addEvent('file_city.count_lines.complete', {
        'repo_path': repoPath,
        'processed_count': processedCount,
        'skipped_count': skippedCount,
        'duration_ms': duration,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      // Push line counts to web-ade cache (fire and forget)
      try {
        const remoteUrl = execSync('git remote get-url origin', {
          cwd: repoPath,
          encoding: 'utf-8',
        }).trim();
        const parsed = this.parseGitRemoteUrl(remoteUrl);
        if (parsed) {
          this.pushLineCountsToWebCache(parsed.owner, parsed.repo, lineCounts);
        }
      } catch {
        // No remote configured or git command failed - skip pushing to cache
      }

      return lineCounts;
    } catch (error) {
      console.error('[FileCityImageService] Error counting lines:', error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Line counting failed',
      });
      return {};
    } finally {
      span.end();
    }
  }
}

/**
 * Register IPC handlers for File City image service
 */
export function registerFileCityImageHandlers(): void {
  const service = FileCityImageService.getInstance();

  ipcMain.handle('file-city:get-image', async (_event, repoPath: string) => {
    return service.getImageForRepository(repoPath);
  });

  ipcMain.handle('file-city:has-image', async (_event, repoPath: string) => {
    return service.hasImageForRepository(repoPath);
  });

  ipcMain.handle(
    'file-city:get-image-for-commit',
    async (_event, repoPath: string, commitHash: string, filePaths: string[]) => {
      return service.getImageForCommit(repoPath, commitHash, filePaths);
    }
  );

  ipcMain.handle(
    'file-city:get-image-for-commit-with-changes',
    async (
      _event,
      repoPath: string,
      commitHash: string,
      filePaths: string[],
      changedFiles: Record<string, 'added' | 'modified' | 'deleted' | 'renamed' | { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>
    ) => {
      return service.getImageForCommitWithChanges(repoPath, commitHash, filePaths, changedFiles);
    }
  );

  ipcMain.handle(
    FileCityImageAPIEvent.COUNT_LINES,
    async (_event, repoPath: string) => {
      return service.countLinesInRepository(repoPath);
    }
  );

  console.log('[FileCityImageService] IPC handlers registered');
}
