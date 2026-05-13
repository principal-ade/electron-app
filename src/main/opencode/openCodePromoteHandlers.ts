import { ipcMain } from 'electron';
import type {
  OpenCodeRunPromptArgs,
  PromoteProgressEntry,
} from '../../shared/main-process-api-interfaces/OpenCodePromoteAPI';
import { OpenCodePromoteAPIEvent } from '../../shared/main-process-api-interfaces/OpenCodePromoteAPI';
import { detectOpenCode } from './openCodeDetect';
import { runOpenCodePrompt } from './openCodeRunner';
import { promoteTrail } from './promoteTrail';

export function registerOpenCodePromoteHandlers(): void {
  ipcMain.handle(OpenCodePromoteAPIEvent.DETECT, () => detectOpenCode());
  ipcMain.handle(
    OpenCodePromoteAPIEvent.RUN_PROMPT,
    (_event, args: OpenCodeRunPromptArgs) => runOpenCodePrompt(args),
  );
  ipcMain.handle(
    OpenCodePromoteAPIEvent.PROMOTE_TRAIL,
    (event, trailId: string) => {
      const sender = event.sender;
      const onProgress = (entry: PromoteProgressEntry) => {
        if (sender.isDestroyed()) return;
        sender.send(OpenCodePromoteAPIEvent.PROGRESS, entry);
      };
      return promoteTrail(trailId, { onProgress });
    },
  );
  console.log('[OpenCodePromote] IPC handlers registered');
}
