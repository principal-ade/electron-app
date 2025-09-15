import React from 'react';
interface ToolDetectionPromptProps {
    workingDirectory: string;
    detectedPackages: Array<{
        path: string;
        name: string;
        hasPackageJson: boolean;
    }>;
    onAccept: () => void;
    onDismiss: () => void;
}
export declare const ToolDetectionPrompt: React.FC<ToolDetectionPromptProps>;
export {};
//# sourceMappingURL=ToolDetectionPrompt.d.ts.map