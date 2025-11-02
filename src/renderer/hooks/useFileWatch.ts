import { useEffect } from 'react';
import { FileSystemService } from '../main-process-api/FileSystemService';

export interface UseFileWatchOptions {
  /**
   * Whether file watching is enabled (default: true)
   * Useful for disabling watch for remote files
   */
  enabled?: boolean;

  /**
   * Function to determine if reload should be skipped
   * Return true to skip the reload (e.g., during save operations or when dirty)
   */
  skipReloadWhen?: () => boolean;

  /**
   * Error handler for watch setup errors
   */
  onError?: (error: Error) => void;
}

/**
 * Custom hook for watching file changes and triggering a reload callback
 *
 * @param filePath - The absolute path to the file to watch (null to disable watching)
 * @param onFileChange - Callback to execute when the file changes
 * @param options - Additional options for file watching behavior
 *
 * @example
 * ```tsx
 * const isSavingRef = useRef(false);
 *
 * useFileWatch(filePath, loadFile, {
 *   enabled: isLocalFile,
 *   skipReloadWhen: () => isSavingRef.current,
 * });
 * ```
 */
export function useFileWatch(
  filePath: string | null | undefined,
  onFileChange: () => void,
  options: UseFileWatchOptions = {},
) {
  const { enabled = true, skipReloadWhen, onError } = options;

  useEffect(() => {
    // Don't watch if disabled, no file path, or not enabled
    if (!enabled || !filePath) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupWatching = async () => {
      try {
        await FileSystemService.watchFile(filePath);
        unsubscribe = FileSystemService.onFileChange((event) => {
          if (event.path === filePath) {
            // Check if reload should be skipped
            if (skipReloadWhen && skipReloadWhen()) {
              return;
            }

            // Trigger the reload callback
            onFileChange();
          }
        });
      } catch (watchError) {
        const error =
          watchError instanceof Error
            ? watchError
            : new Error('Failed to set up file watching');

        console.error('Error setting up file watching:', error);

        if (onError) {
          onError(error);
        }
      }
    };

    setupWatching();

    // Cleanup: unsubscribe and stop watching
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      FileSystemService.stopWatchingFile(filePath).catch((stopError) => {
        console.error('Error stopping file watching:', stopError);
      });
    };
  }, [filePath, enabled, onFileChange, skipReloadWhen, onError]);
}
