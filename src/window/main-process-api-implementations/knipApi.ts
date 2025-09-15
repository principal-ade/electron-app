import { ipcRenderer } from 'electron';
import { KnipAPI, KnipAnalysisResult } from '../../shared/main-process-api-interfaces/KnipAPI';

export const knipAPI: KnipAPI = {
  checkAvailability: (): Promise<boolean> => {
    return ipcRenderer.invoke('knip:check-availability');
  },

  runAnalysis: (directoryPath: string): Promise<KnipAnalysisResult> => {
    return ipcRenderer.invoke('knip:run-analysis', directoryPath);
  },
};