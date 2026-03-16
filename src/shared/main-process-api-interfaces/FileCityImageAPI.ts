/**
 * File City Image API - Generates File City visualization images for repositories
 *
 * Uses cached file tree data from repository-monitoring to generate
 * treemap-style PNG visualizations.
 */

/**
 * IPC event names for File City image operations
 */
export enum FileCityImageAPIEvent {
  GET_IMAGE = 'file-city:get-image',
  HAS_IMAGE = 'file-city:has-image',
}

/**
 * API for File City image generation
 */
export interface FileCityImageAPI {
  /**
   * Get or generate a File City image for a repository
   * Returns file:// URL to the cached image, or null if file tree isn't cached
   */
  getImage: (repoPath: string) => Promise<string | null>;

  /**
   * Check if a File City image exists for a repository (without generating)
   */
  hasImage: (repoPath: string) => Promise<boolean>;
}
