import { ipcMain } from 'electron';
import { MemoryPalace, NodeFileSystemAdapter } from '@principal-ai/alexandria-core-library';
import { A24zAPIEvents } from '../../window/main-process-api-implementations/a24zApi';

export class A24zHandler {
  private fs = new NodeFileSystemAdapter();

  registerHandlers(): void {
    ipcMain.handle(
      A24zAPIEvents.GET_ALL_NOTES,
      async (_event, repositoryPath: string) => {
        console.log(
          '[A24zHandler] Getting all notes for path:',
          repositoryPath,
        );
        try {
          // Validate repository path and create MemoryPalace instance
          const validatedPath = MemoryPalace.validateRepositoryPath(
            this.fs,
            repositoryPath,
          );
          const palace = new MemoryPalace(validatedPath, this.fs);

          // Get all notes for the repository
          const notes = palace.getNotes(true);
          console.log('[A24zHandler] Got notes:', notes?.length || 0);
          return notes || [];
        } catch (error) {
          console.error('[A24zHandler] Error getting all notes:', error);
          return [];
        }
      },
    );

    ipcMain.handle(
      A24zAPIEvents.GET_NOTES_FOR_PATH,
      async (_event, filePath: string, repositoryPath: string) => {
        try {
          // Validate repository path and create MemoryPalace instance
          const validatedRepoPath = MemoryPalace.validateRepositoryPath(
            this.fs,
            repositoryPath,
          );
          const palace = new MemoryPalace(validatedRepoPath, this.fs);

          // Validate the relative path
          const relativePath = MemoryPalace.validateRelativePath(
            validatedRepoPath,
            filePath,
            this.fs,
          );

          // Get notes for the specific path
          const notes = palace.getNotesForPath(relativePath, false);
          return notes || [];
        } catch (error) {
          console.error('[A24zHandler] Error getting notes for path:', error);
          return [];
        }
      },
    );

    ipcMain.handle(
      A24zAPIEvents.HAS_A24Z_DIRECTORY,
      async (_event, repositoryPath: string) => {
        console.log(
          '[A24zHandler] Checking for a24z directory at:',
          repositoryPath,
        );
        try {
          // Try to validate the repository path
          MemoryPalace.validateRepositoryPath(this.fs, repositoryPath);
          console.log('[A24zHandler] Directory check successful');
          return true;
        } catch (error) {
          console.log(
            '[A24zHandler] No a24z directory found:',
            error instanceof Error ? error.message : 'Unknown error',
          );
          return false;
        }
      },
    );

    ipcMain.handle(
      A24zAPIEvents.GET_NOTE_COUNT,
      async (_event, repositoryPath: string) => {
        console.log(
          '[A24zHandler] Getting note count for path:',
          repositoryPath,
        );
        try {
          // Validate repository path and create MemoryPalace instance
          const validatedPath = MemoryPalace.validateRepositoryPath(
            this.fs,
            repositoryPath,
          );
          const palace = new MemoryPalace(validatedPath, this.fs);

          // Get all notes for the repository
          const notes = palace.getNotes(true);
          console.log('[A24zHandler] Note count:', notes?.length || 0);
          return notes ? notes.length : 0;
        } catch (error) {
          console.error('[A24zHandler] Error getting note count:', error);
          return 0;
        }
      },
    );
  }
}
