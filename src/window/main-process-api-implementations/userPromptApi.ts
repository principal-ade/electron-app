import { ipcRenderer } from 'electron';
import {
  type UserPromptAPI,
  UserPromptAPIEvents,
  UserPromptRequest,
  UserPromptResponse,
} from '../../shared/main-process-api-interfaces/UserPromptAPI';

export const userPromptAPI: UserPromptAPI = {
  // Main API methods if any (for programmatic prompts)
  showPrompt: (request: UserPromptRequest) =>
    ipcRenderer.invoke(UserPromptAPIEvents.SHOW_PROMPT, request),

  // Event listeners for UI components
  onShowPrompt: (callback: (request: UserPromptRequest) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      request: UserPromptRequest,
    ) => callback(request);
    ipcRenderer.on(UserPromptAPIEvents.SHOW_PROMPT, handler);
    return () =>
      ipcRenderer.removeListener(UserPromptAPIEvents.SHOW_PROMPT, handler);
  },

  sendResponse: (response: UserPromptResponse) =>
    ipcRenderer.send(UserPromptAPIEvents.PROMPT_RESPONSE, response),

  sendCancelled: (promptId: string) =>
    ipcRenderer.send(UserPromptAPIEvents.PROMPT_CANCELLED, promptId),

  cancelPrompt: (promptId: string) =>
    ipcRenderer.invoke(UserPromptAPIEvents.CANCEL_PROMPT, promptId),

  isPromptActive: (promptId: string) =>
    ipcRenderer.invoke(UserPromptAPIEvents.IS_PROMPT_ACTIVE, promptId),
};
