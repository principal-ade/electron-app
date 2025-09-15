import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentSetupStatus } from '../../../../shared/main-process-api-interfaces/AgentConfigAPI';
interface AgentConfigurationViewProps {
    agentType: SupportedAgent;
    agentStatus: AgentSetupStatus;
    checkAgentStatus: () => Promise<void>;
    viewLayout?: 'simple' | 'detailed';
    onShowDetails?: () => void;
    onBackToSetup?: () => void;
    handleClaudeTourNext?: () => void;
    handleClaudeTourAction?: (action: {
        fn: (step: number) => Promise<void>;
    }) => void;
    handleClaudeTourButtonClick?: (stepIndex: number, buttonAction: () => void) => void;
    isClaudeTourActive?: boolean;
    claudeTourStepIndex?: number;
}
export declare const AgentConfigurationView: React.FC<AgentConfigurationViewProps>;
export {};
//# sourceMappingURL=AgentConfigurationView.d.ts.map