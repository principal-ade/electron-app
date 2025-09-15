import React from 'react';
interface TerminalDebugModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSessionId?: string;
    tabs?: Array<{
        id: string;
        label: string;
        sessionId?: string;
        command?: string;
    }>;
}
export declare const TerminalDebugModal: React.FC<TerminalDebugModalProps>;
export {};
//# sourceMappingURL=TerminalDebugModal.d.ts.map