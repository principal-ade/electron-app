import { ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  ConvertProgressEntry,
  ConvertTrailResult,
  OpenCodeConvertAPI,
  OpenCodeDetectResult,
  OpenCodeRunPromptArgs,
  OpenCodeRunPromptResult,
} from '../../shared/main-process-api-interfaces/OpenCodeConvertAPI';
import { OpenCodeConvertAPIEvent } from '../../shared/main-process-api-interfaces/OpenCodeConvertAPI';

export const openCodeConvertAPI: OpenCodeConvertAPI = {
  detect: (): Promise<OpenCodeDetectResult> =>
    ipcRenderer.invoke(OpenCodeConvertAPIEvent.DETECT),
  runPrompt: (
    args: OpenCodeRunPromptArgs,
  ): Promise<OpenCodeRunPromptResult> =>
    ipcRenderer.invoke(OpenCodeConvertAPIEvent.RUN_PROMPT, args),
  convertTrail: (trailId: string): Promise<ConvertTrailResult> =>
    ipcRenderer.invoke(OpenCodeConvertAPIEvent.CONVERT_TRAIL, trailId),
  onProgress: (handler: (entry: ConvertProgressEntry) => void) => {
    const listener = (_event: IpcRendererEvent, entry: ConvertProgressEntry) =>
      handler(entry);
    ipcRenderer.on(OpenCodeConvertAPIEvent.PROGRESS, listener);
    return () => {
      ipcRenderer.removeListener(OpenCodeConvertAPIEvent.PROGRESS, listener);
    };
  },
};
