/**
 * User Prompt API - Interface for MCP to request user input
 * Allows MCP tools to show prompts/dialogs and get user responses
 */
export interface UserPromptRequest {
    id: string;
    title: string;
    message: string;
    type: 'text' | 'confirm' | 'select' | 'multiline';
    options?: string[];
    defaultValue?: string | boolean;
    placeholder?: string;
    required?: boolean;
    timeout?: number;
    filePath?: string;
}
export interface UserPromptResponse {
    id: string;
    success: boolean;
    value?: string | boolean | null;
    error?: string;
    cancelled?: boolean;
}
export declare enum UserPromptAPIEvents {
    SHOW_PROMPT = "user-prompt:show",
    CANCEL_PROMPT = "user-prompt:cancel",
    PROMPT_RESPONSE = "user-prompt:response",
    PROMPT_CANCELLED = "user-prompt:cancelled",
    PROMPT_TIMEOUT = "user-prompt:timeout",
    IS_PROMPT_ACTIVE = "user-prompt:is-active"
}
export interface UserPromptAPI {
    showPrompt: (request: UserPromptRequest) => Promise<UserPromptResponse>;
    onShowPrompt: (callback: (request: UserPromptRequest) => void) => () => void;
    sendResponse: (response: UserPromptResponse) => void;
    sendCancelled: (promptId: string) => void;
    cancelPrompt: (promptId: string) => Promise<void>;
    isPromptActive: (promptId: string) => Promise<boolean>;
}
//# sourceMappingURL=UserPromptAPI.d.ts.map