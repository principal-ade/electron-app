import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentSetupStatus } from '../../../../shared/main-process-api-interfaces/AgentConfigAPI';
interface AgentSetupWizardProps {
    agentType: SupportedAgent;
    agentStatus: AgentSetupStatus;
    checkAgentStatus: () => void;
    onShowDetails: () => void;
    handleClaudeTourNext?: () => void;
    handleClaudeTourAction?: (action: {
        fn: (step: number) => Promise<void>;
    }) => void;
    handleClaudeTourButtonClick?: (stepIndex: number, buttonAction: () => void) => void;
    isClaudeTourActive?: boolean;
    claudeTourStepIndex?: number;
}
export declare const AgentSetupWizard: React.FC<AgentSetupWizardProps>;
export {};
//# sourceMappingURL=AgentSetupWizard.d.ts.map