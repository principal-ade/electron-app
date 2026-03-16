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
};
