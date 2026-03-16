/**
 * Renderer-side service for File City image generation
 *
 * Provides a convenient API for getting File City visualization images
 * for repositories.
 */

export class FileCityImageService {
  /**
   * Get or generate a File City image for a repository
   * Returns file:// URL to the cached image, or null if file tree isn't cached
   *
   * @param repoPath - The path to the repository
   * @returns Promise resolving to file:// URL or null
   */
  static async getImage(repoPath: string): Promise<string | null> {
    return window.mainProcess.fileCityImage.getImage(repoPath);
  }

  /**
   * Check if a File City image exists for a repository (without generating)
   *
   * @param repoPath - The path to the repository
   * @returns Promise resolving to boolean
   */
  static async hasImage(repoPath: string): Promise<boolean> {
    return window.mainProcess.fileCityImage.hasImage(repoPath);
  }
}
