import React from 'react';
import { UserPromptRequest, UserPromptResponse } from '../../../shared/main-process-api-interfaces/UserPromptAPI';
interface UserPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: UserPromptRequest | null;
    onResponse: (response: UserPromptResponse) => void;
}
export declare const UserPromptModal: React.FC<UserPromptModalProps>;
export declare const useUserPrompts: () => {
    activePrompt: UserPromptRequest | null;
    isOpen: boolean;
    handleResponse: (response: UserPromptResponse) => void;
    handleClose: () => void;
};
export {};
//# sourceMappingURL=UserPromptModal.d.ts.map