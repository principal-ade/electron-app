import { ipcRenderer } from 'electron';
import { UserPromptAPIEvents } from '../../shared/main-process-api-interfaces/UserPromptAPI';
export const userPromptAPI = {
    // Main API methods if any (for programmatic prompts)
    showPrompt: (request) => ipcRenderer.invoke(UserPromptAPIEvents.SHOW_PROMPT, request),
    // Event listeners for UI components
    onShowPrompt: (callback) => {
        const handler = (_event, request) => callback(request);
        ipcRenderer.on(UserPromptAPIEvents.SHOW_PROMPT, handler);
        return () => ipcRenderer.removeListener(UserPromptAPIEvents.SHOW_PROMPT, handler);
    },
    sendResponse: (response) => ipcRenderer.send(UserPromptAPIEvents.PROMPT_RESPONSE, response),
    sendCancelled: (promptId) => ipcRenderer.send(UserPromptAPIEvents.PROMPT_CANCELLED, promptId),
    cancelPrompt: (promptId) => ipcRenderer.invoke(UserPromptAPIEvents.CANCEL_PROMPT, promptId),
    isPromptActive: (promptId) => ipcRenderer.invoke(UserPromptAPIEvents.IS_PROMPT_ACTIVE, promptId),
};
