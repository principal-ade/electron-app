import { ipcRenderer } from 'electron';
import type { FileCityImageAPI } from '../../shared/main-process-api-interfaces/FileCityImageAPI';
import { FileCityImageAPIEvent } from '../../shared/main-process-api-interfaces/FileCityImageAPI';

export const fileCityImageAPI: FileCityImageAPI = {
  getImage: async (repoPath: string): Promise<string | null> => {
    return ipcRenderer.invoke(FileCityImageAPIEvent.GET_IMAGE, repoPath);
  },

  hasImage: async (repoPath: string): Promise<boolean> => {
    return ipcRenderer.invoke(FileCityImageAPIEvent.HAS_IMAGE, repoPath);
  },

  getImageForCommit: async (
    repoPath: string,
    commitHash: string,
    filePaths: string[]
  ): Promise<string | null> => {
    return ipcRenderer.invoke(
      FileCityImageAPIEvent.GET_IMAGE_FOR_COMMIT,
      repoPath,
      commitHash,
      filePaths
    );
  },

  onImageGenerated: (callback: (repoPath: string, imageUrl: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, repoPath: string, imageUrl: string) => {
      callback(repoPath, imageUrl);
    };
    ipcRenderer.on(FileCityImageAPIEvent.IMAGE_GENERATED, handler);
    return () => {
      ipcRenderer.removeListener(FileCityImageAPIEvent.IMAGE_GENERATED, handler);
    };
  },
};
