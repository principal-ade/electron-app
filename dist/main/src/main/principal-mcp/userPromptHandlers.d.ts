import { UserPromptRequest, UserPromptResponse } from '../../shared/main-process-api-interfaces/UserPromptAPI';
import { EventEmitter } from 'events';
declare class UserPromptManager extends EventEmitter {
    private activePrompts;
    constructor();
    private setupHandlers;
    showPrompt(request: UserPromptRequest): Promise<UserPromptResponse>;
    showPromptInWindow(windowId: number | undefined, request: UserPromptRequest): Promise<UserPromptResponse>;
    showNativePrompt(request: UserPromptRequest): Promise<UserPromptResponse>;
    cancelPrompt(promptId: string): void;
    isPromptActive(promptId: string): boolean;
    cleanup(): void;
}
export declare const userPromptManager: UserPromptManager;
export declare function registerUserPromptHandlers(): void;
export {};
//# sourceMappingURL=userPromptHandlers.d.ts.map