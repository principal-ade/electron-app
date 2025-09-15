import { UserPromptRequest, UserPromptResponse } from '../../shared/main-process-api-interfaces/UserPromptAPI';

export class UserPromptService {
  // Listen for prompt requests
  static onShowPrompt(callback: (request: UserPromptRequest) => void): () => void {
    return window.mainProcess.userPrompt.onShowPrompt(callback);
  }
  
  // Send response back to main process
  static sendResponse(response: UserPromptResponse): void {
    window.mainProcess.userPrompt.sendResponse(response);
  }
  
  // Send cancellation
  static sendCancelled(promptId: string): void {
    window.mainProcess.userPrompt.sendCancelled(promptId);
  }
}
