import { ipcMain, BrowserWindow, dialog } from 'electron';
import { UserPromptRequest, UserPromptResponse, UserPromptAPIEvents } from '../../shared/main-process-api-interfaces/UserPromptAPI';
import { EventEmitter } from 'events';

class UserPromptManager extends EventEmitter {
  private activePrompts: Map<string, {
    request: UserPromptRequest;
    window?: BrowserWindow;
    timeout?: NodeJS.Timeout;
    resolver?: (response: UserPromptResponse) => void;
  }> = new Map();

  constructor() {
    super();
    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle prompt responses from renderer
    ipcMain.on(UserPromptAPIEvents.PROMPT_RESPONSE, (_event, response: UserPromptResponse) => {
      const prompt = this.activePrompts.get(response.id);
      if (prompt?.resolver) {
        if (prompt.timeout) {
          clearTimeout(prompt.timeout);
        }
        prompt.resolver(response);
        this.activePrompts.delete(response.id);
      }
    });

    // Handle prompt cancellation from renderer
    ipcMain.on(UserPromptAPIEvents.PROMPT_CANCELLED, (_event, promptId: string) => {
      const prompt = this.activePrompts.get(promptId);
      if (prompt?.resolver) {
        if (prompt.timeout) {
          clearTimeout(prompt.timeout);
        }
        prompt.resolver({
          id: promptId,
          success: false,
          cancelled: true
        });
        this.activePrompts.delete(promptId);
      }
    });
  }

  async showPrompt(request: UserPromptRequest): Promise<UserPromptResponse> {
    return this.showPromptInWindow(undefined, request);
  }

  async showPromptInWindow(windowId: number | undefined, request: UserPromptRequest): Promise<UserPromptResponse> {
    return new Promise((resolve) => {
      // Find target window
      let targetWindow: BrowserWindow | undefined;
      if (typeof windowId === 'number') {
        try {
          targetWindow = BrowserWindow.fromId(windowId) || undefined;
        } catch {}
      }
      if (!targetWindow) {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) targetWindow = focused;
      }
      if (!targetWindow) {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const first = windows[0];
          targetWindow = first;
          first.focus();
        }
      }

      if (!targetWindow) {
        resolve({
          id: request.id,
          success: false,
          error: 'No active window available to show prompt'
        });
        return;
      }

      // Store the prompt with its resolver
      this.activePrompts.set(request.id, {
        request,
        window: targetWindow,
        resolver: resolve
      });

      // Set timeout if specified
      if (request.timeout) {
        const timeout = setTimeout(() => {
          const prompt = this.activePrompts.get(request.id);
          if (prompt?.resolver) {
            prompt.resolver({
              id: request.id,
              success: false,
              error: 'Prompt timed out'
            });
            this.activePrompts.delete(request.id);
          }
        }, request.timeout);

        const prompt = this.activePrompts.get(request.id);
        if (prompt) {
          prompt.timeout = timeout;
        }
      }

      // Send the prompt request to the renderer
      targetWindow.webContents.send(UserPromptAPIEvents.SHOW_PROMPT, request);
    });
  }

  async showNativePrompt(request: UserPromptRequest): Promise<UserPromptResponse> {
    // Alternative implementation using native Electron dialogs
    try {
      const targetWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      
      switch (request.type) {
        case 'confirm':
          const confirmResult = await dialog.showMessageBox(targetWindow, {
            type: 'question',
            title: request.title,
            message: request.message,
            buttons: ['Yes', 'No'],
            defaultId: request.defaultValue ? 0 : 1,
            cancelId: 1
          });
          
          return {
            id: request.id,
            success: true,
            value: confirmResult.response === 0
          };
          
        case 'text':
        case 'multiline':
          // Native dialogs don't support text input directly
          // Fall back to renderer-based prompt
          return this.showPrompt(request);
          
        case 'select':
          if (!request.options || request.options.length === 0) {
            return {
              id: request.id,
              success: false,
              error: 'No options provided for select prompt'
            };
          }
          
          const selectResult = await dialog.showMessageBox(targetWindow, {
            type: 'question',
            title: request.title,
            message: request.message,
            buttons: request.options,
            defaultId: request.defaultValue ? request.options.indexOf(request.defaultValue as string) : 0
          });
          
          return {
            id: request.id,
            success: selectResult.response !== -1,
            value: request.options[selectResult.response],
            cancelled: selectResult.response === -1
          };
          
        default:
          return {
            id: request.id,
            success: false,
            error: `Unknown prompt type: ${request.type}`
          };
      }
    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  cancelPrompt(promptId: string): void {
    const prompt = this.activePrompts.get(promptId);
    if (prompt) {
      if (prompt.timeout) {
        clearTimeout(prompt.timeout);
      }
      if (prompt.resolver) {
        prompt.resolver({
          id: promptId,
          success: false,
          cancelled: true
        });
      }
      this.activePrompts.delete(promptId);
    }
  }

  isPromptActive(promptId: string): boolean {
    return this.activePrompts.has(promptId);
  }

  cleanup() {
    // Clear all active prompts on shutdown
    for (const [id, prompt] of this.activePrompts.entries()) {
      if (prompt.timeout) {
        clearTimeout(prompt.timeout);
      }
      if (prompt.resolver) {
        prompt.resolver({
          id,
          success: false,
          error: 'Application shutting down'
        });
      }
    }
    this.activePrompts.clear();
  }
}

// Singleton instance
export const userPromptManager = new UserPromptManager();

// Register IPC handlers
export function registerUserPromptHandlers() {
  // Main handler for showing prompts
  ipcMain.handle(UserPromptAPIEvents.SHOW_PROMPT, async (_event, request: UserPromptRequest) => {
    return userPromptManager.showPrompt(request);
  });

  // Handler for cancelling prompts
  ipcMain.handle(UserPromptAPIEvents.CANCEL_PROMPT, async (_event, promptId: string) => {
    userPromptManager.cancelPrompt(promptId);
    return { success: true };
  });

  // Handler for checking if prompt is active
  ipcMain.handle('user-prompt:is-active', async (_event, promptId: string) => {
    return userPromptManager.isPromptActive(promptId);
  });

  console.log('[UserPromptHandlers] Registered user prompt IPC handlers');
}