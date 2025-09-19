import { ipcMain, Menu, BrowserWindow, MenuItem } from 'electron';
import { applicationWindows } from '../../../window/modernWindowManager';
import { FeedbackEvent } from '../../../../shared/ipc-events/FeedbackEvents';
import type {
  ContextMenuParams,
  FeedbackSubmissionData,
  FeedbackSubmissionResult,
} from '../../../../shared/main-process-api-interfaces/FeedbackAPI';

export function registerFeedbackHandlers() {
  // Handle context menu requests from renderer
  ipcMain.on(
    FeedbackEvent.SHOW_CONTEXT_MENU,
    (event, params: ContextMenuParams) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;

      const template: (
        | Electron.MenuItemConstructorOptions
        | Electron.MenuItem
      )[] = [
        {
          label: 'Inspect Element',
          click: () => {
            event.sender.inspectElement(params.x, params.y);
          },
        },
        { type: 'separator' },
        {
          label: '📝 Give Feedback on Component',
          click: () => {
            // Send event back to renderer to show feedback modal
            event.sender.send(FeedbackEvent.SHOW_MODAL, {
              componentName: params.componentName || 'Unknown Component',
              componentPath: params.componentPath || 'Unknown Path',
              elementInfo: params.elementInfo || 'No element info',
            });
          },
        },
      ];

      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: win });
    },
  );

  // Handle feedback submission
  ipcMain.handle(
    FeedbackEvent.SUBMIT_FEEDBACK,
    async (
      event,
      feedbackData: FeedbackSubmissionData,
    ): Promise<FeedbackSubmissionResult> => {
      console.log('[Feedback Handler] Received feedback:', feedbackData);

      // TODO: Here you would send the feedback to your backend service
      // For now, we're just logging it

      return { success: true, message: 'Feedback received' };
    },
  );
}
