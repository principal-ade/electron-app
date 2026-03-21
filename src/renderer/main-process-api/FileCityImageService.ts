/**
 * Renderer-side service for File City image generation
 *
 * Provides a convenient API for getting File City visualization images
 * for repositories.
 */

export class FileCityImageService {
  /**
   * Get or generate a File City image for a repository
   * Returns data URL (base64) for the image, or null if file tree isn't cached
   *
   * @param repoPath - The path to the repository
   * @returns Promise resolving to data URL or null
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

  /**
   * Get or generate a File City image for a specific commit
   * Uses file paths from git ls-tree to build historical visualization
   *
   * @param repoPath - The path to the repository
   * @param commitHash - The git commit hash
   * @param filePaths - Array of file paths at that commit (from git ls-tree)
   * @returns Promise resolving to data URL or null
   */
  static async getImageForCommit(
    repoPath: string,
    commitHash: string,
    filePaths: string[]
  ): Promise<string | null> {
    return window.mainProcess.fileCityImage.getImageForCommit(repoPath, commitHash, filePaths);
  }

  /**
   * Get or generate a File City image for a specific commit with changed files highlighted
   * Shows highlight layers (borders) on files that were added/modified/deleted
   *
   * @param repoPath - The path to the repository
   * @param commitHash - The git commit hash
   * @param filePaths - Array of file paths at that commit (from git ls-tree)
   * @param changedFiles - Map of file paths to their change info (status and line counts)
   * @returns Promise resolving to data URL or null
   */
  static async getImageForCommitWithChanges(
    repoPath: string,
    commitHash: string,
    filePaths: string[],
    changedFiles: Record<string, 'added' | 'modified' | 'deleted' | 'renamed' | { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>
  ): Promise<string | null> {
    return window.mainProcess.fileCityImage.getImageForCommitWithChanges(
      repoPath,
      commitHash,
      filePaths,
      changedFiles
    );
  }

  /**
   * Subscribe to image generation events
   * Called when a new image is generated for any repository
   *
   * @param callback - Function called with (repoPath, imageUrl) when image is generated
   * @returns Unsubscribe function
   */
  static onImageGenerated(callback: (repoPath: string, imageUrl: string) => void): () => void {
    return window.mainProcess.fileCityImage.onImageGenerated(callback);
  }
}
