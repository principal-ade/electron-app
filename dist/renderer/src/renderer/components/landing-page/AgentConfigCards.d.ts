import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentInstallationStatus } from '../../main-process-api/AgentConfigurationService';
interface AgentConfigCardsProps {
    agentStatus: AgentInstallationStatus | null;
    onSelectAgent: (agent: SupportedAgent) => void;
    onSelectAgentDetailed?: (agent: SupportedAgent) => void;
    isClaudeTourActive?: boolean;
    claudeTourStepIndex?: number;
    handleClaudeTourButtonClick?: (stepIndex: number, buttonAction: () => void) => void;
    hideEvents?: boolean;
}
export declare const AgentConfigCards: React.FC<AgentConfigCardsProps>;
export {};
//# sourceMappingURL=AgentConfigCards.d.ts.map