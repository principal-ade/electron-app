export class UserPromptService {
    // Listen for prompt requests
    static onShowPrompt(callback) {
        return window.mainProcess.userPrompt.onShowPrompt(callback);
    }
    // Send response back to main process
    static sendResponse(response) {
        window.mainProcess.userPrompt.sendResponse(response);
    }
    // Send cancellation
    static sendCancelled(promptId) {
        window.mainProcess.userPrompt.sendCancelled(promptId);
    }
}
