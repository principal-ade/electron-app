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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    canvasModule = require('canvas');
  }
  return canvasModule!;
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
   * Get or generate a File City image for a repository
   * Returns the file:// URL to the image, or null if the file tree isn't cached
   */
  async getImageForRepository(repoPath: string): Promise<string | null> {
    await this.ensureInitialized();

    const tracer = getTracer('principal-ade');
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
        return `file://${cachedPath}`;
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

      const imageUrl = `file://${cachePath}`;
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
