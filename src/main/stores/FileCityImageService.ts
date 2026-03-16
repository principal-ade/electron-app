/**
 * FileCityImageService - Generates File City visualization images for repositories
 *
 * Uses file tree data from the repository-monitoring cache to generate
 * treemap-style PNG visualizations. Images are cached to disk to avoid
 * regenerating them on every request.
 */

import { app, ipcMain } from 'electron';
import { createCanvas } from 'canvas';
import * as path from 'path';
import * as fs from 'fs/promises';
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

// Type alias to handle canvas version mismatches between packages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompatibleContext = any;

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

    // Create canvas and render
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
   * Get or generate a File City image for a repository
   * Returns the file:// URL to the image, or null if the file tree isn't cached
   */
  async getImageForRepository(repoPath: string): Promise<string | null> {
    await this.ensureInitialized();

    try {
      // Get file tree from repository-monitoring cache
      const manager = getManager();
      const fileTree = await manager.getFileTree(repoPath);

      if (!fileTree || fileTree.allFiles.length === 0) {
        console.log('[FileCityImageService] No cached file tree for:', repoPath);
        return null;
      }

      // Check if we have a cached image
      const cacheKey = this.getCacheKey(repoPath, fileTree.sha || 'unknown');
      const cachedPath = await this.getCachedImagePath(cacheKey);

      if (cachedPath) {
        console.log('[FileCityImageService] Cache hit for:', repoPath);
        return `file://${cachedPath}`;
      }

      // Generate new image using the FileTree
      console.log('[FileCityImageService] Generating image for:', repoPath);
      const imageBuffer = await this.generateImage(fileTree);

      // Save to cache
      const cachePath = this.getCachePath(cacheKey);
      await fs.writeFile(cachePath, imageBuffer);

      console.log('[FileCityImageService] Image saved to:', cachePath);
      return `file://${cachePath}`;
    } catch (error) {
      console.error('[FileCityImageService] Error generating image for', repoPath, error);
      return null;
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

  console.log('[FileCityImageService] IPC handlers registered');
}
