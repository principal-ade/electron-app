import React from 'react';
interface OllamaModelSuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    installedModels: string[];
    onModelSelected: (modelName: string) => void;
    onModelsChanged?: () => void;
}
export declare const OllamaModelSuggestionModal: React.FC<OllamaModelSuggestionModalProps>;
export {};
//# sourceMappingURL=OllamaModelSuggestionModal.d.ts.map