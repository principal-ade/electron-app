import React from 'react';
interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    componentInfo: {
        componentName: string;
        componentPath: string;
        elementInfo: string;
        screenshot?: string;
        additionalData?: Record<string, any>;
    };
}
export declare const FeedbackModal: React.FC<FeedbackModalProps>;
export {};
//# sourceMappingURL=FeedbackModal.d.ts.map