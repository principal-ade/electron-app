import { ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  OpenCodeDetectResult,
  OpenCodePromoteAPI,
  OpenCodeRunPromptArgs,
  OpenCodeRunPromptResult,
  PromoteProgressEntry,
  PromoteTrailResult,
} from '../../shared/main-process-api-interfaces/OpenCodePromoteAPI';
import { OpenCodePromoteAPIEvent } from '../../shared/main-process-api-interfaces/OpenCodePromoteAPI';

export const openCodePromoteAPI: OpenCodePromoteAPI = {
  detect: (): Promise<OpenCodeDetectResult> =>
    ipcRenderer.invoke(OpenCodePromoteAPIEvent.DETECT),
  runPrompt: (
    args: OpenCodeRunPromptArgs,
  ): Promise<OpenCodeRunPromptResult> =>
    ipcRenderer.invoke(OpenCodePromoteAPIEvent.RUN_PROMPT, args),
  promoteTrail: (trailId: string): Promise<PromoteTrailResult> =>
    ipcRenderer.invoke(OpenCodePromoteAPIEvent.PROMOTE_TRAIL, trailId),
  onProgress: (handler: (entry: PromoteProgressEntry) => void) => {
    const listener = (_event: IpcRendererEvent, entry: PromoteProgressEntry) =>
      handler(entry);
    ipcRenderer.on(OpenCodePromoteAPIEvent.PROGRESS, listener);
    return () => {
      ipcRenderer.removeListener(OpenCodePromoteAPIEvent.PROGRESS, listener);
    };
  },
};
