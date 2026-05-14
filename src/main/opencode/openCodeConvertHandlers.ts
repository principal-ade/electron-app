import { ipcMain } from 'electron';
import type {
  ConvertProgressEntry,
  OpenCodeRunPromptArgs,
} from '../../shared/main-process-api-interfaces/OpenCodeConvertAPI';
import { OpenCodeConvertAPIEvent } from '../../shared/main-process-api-interfaces/OpenCodeConvertAPI';
import { detectOpenCode } from './openCodeDetect';
import { runOpenCodePrompt } from './openCodeRunner';
import { convertTrail } from './convertTrail';

export function registerOpenCodeConvertHandlers(): void {
  ipcMain.handle(OpenCodeConvertAPIEvent.DETECT, () => detectOpenCode());
  ipcMain.handle(
    OpenCodeConvertAPIEvent.RUN_PROMPT,
    (_event, args: OpenCodeRunPromptArgs) => runOpenCodePrompt(args),
  );
  ipcMain.handle(
    OpenCodeConvertAPIEvent.CONVERT_TRAIL,
    (event, trailId: string) => {
      const sender = event.sender;
      const onProgress = (entry: ConvertProgressEntry) => {
        if (sender.isDestroyed()) return;
        sender.send(OpenCodeConvertAPIEvent.PROGRESS, entry);
      };
      return convertTrail(trailId, { onProgress });
    },
  );
  console.log('[OpenCodeConvert] IPC handlers registered');
}
