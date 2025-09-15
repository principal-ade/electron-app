import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
interface InstallStepProps {
    agentType: SupportedAgent;
    agentDisplayName: string;
    isProcessing: boolean;
    installProgress: {
        stage?: string;
        progress?: number;
        message?: string;
    } | null;
    onInstall: () => void;
    onCheckStatus: () => void;
    onInstallComplete: () => void;
    onUninstall?: () => void;
    hasHooks?: boolean;
    handleClaudeTourButtonClick?: (stepIndex: number, buttonAction: () => void) => void;
    isClaudeTourActive?: boolean;
    claudeTourStepIndex?: number;
    isCurrentStep: boolean;
    isInstalled: boolean;
}
export declare const InstallStep: React.FC<InstallStepProps>;
export {};
//# sourceMappingURL=InstallStep.d.ts.map