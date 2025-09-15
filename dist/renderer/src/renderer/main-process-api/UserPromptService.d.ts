import { UserPromptRequest, UserPromptResponse } from '../../shared/main-process-api-interfaces/UserPromptAPI';
export declare class UserPromptService {
    static onShowPrompt(callback: (request: UserPromptRequest) => void): () => void;
    static sendResponse(response: UserPromptResponse): void;
    static sendCancelled(promptId: string): void;
}
//# sourceMappingURL=UserPromptService.d.ts.map