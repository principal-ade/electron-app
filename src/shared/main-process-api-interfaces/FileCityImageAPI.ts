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
  GET_IMAGE_FOR_COMMIT = 'file-city:get-image-for-commit',
  IMAGE_GENERATED = 'file-city:image-generated',
}

/**
 * API for File City image generation
 */
export interface FileCityImageAPI {
  /**
   * Get or generate a File City image for a repository
   * Returns data URL (base64) for the image, or null if file tree isn't cached
   */
  getImage: (repoPath: string) => Promise<string | null>;

  /**
   * Check if a File City image exists for a repository (without generating)
   */
  hasImage: (repoPath: string) => Promise<boolean>;

  /**
   * Get or generate a File City image for a specific commit
   * Uses git ls-tree output to build the file tree at that commit
   */
  getImageForCommit: (
    repoPath: string,
    commitHash: string,
    filePaths: string[]
  ) => Promise<string | null>;

  /**
   * Subscribe to image generation events
   * Called when a new image is generated for a repository
   */
  onImageGenerated: (callback: (repoPath: string, imageUrl: string) => void) => () => void;
}
