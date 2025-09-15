import { ipcRenderer } from 'electron';
import { 
  ViolationEvents,
  PackageInfo,
  ViolationCollectionOptions,
  ViolationResult
} from '../../shared/main-process-api-interfaces/ViolationsAPI';

export const violationsAPI = {
  collect: async (
    sourcePath: string,
    packages: PackageInfo[],
    options: ViolationCollectionOptions
  ): Promise<ViolationResult> => {
    return ipcRenderer.invoke(ViolationEvents.COLLECT, sourcePath, packages, options);
  },

  clearCache: async (sourcePath?: string): Promise<void> => {
    return ipcRenderer.invoke(ViolationEvents.CLEAR_CACHE, sourcePath);
  }
};