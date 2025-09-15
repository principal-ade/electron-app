import React from 'react';
interface PlanningStartOverlayProps {
    theme: any;
    onStart: (options: {
        documentType: 'new' | 'existing';
        format?: 'markdown' | 'excalidraw';
    }) => void;
    onCancel: () => void;
    initialStep?: 'document' | 'format';
}
export declare const PlanningStartOverlay: React.FC<PlanningStartOverlayProps>;
export {};
//# sourceMappingURL=PlanningStartOverlay.d.ts.map