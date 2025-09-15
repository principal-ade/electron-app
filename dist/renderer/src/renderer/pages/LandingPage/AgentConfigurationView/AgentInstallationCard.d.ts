import React from 'react';
import { AgentInfo, SupportedAgent } from "@principal-ai/agent-monitoring";
interface AgentInstallationCardProps {
    agentType: SupportedAgent;
    agentConfig: AgentInfo;
    onInstallComplete?: () => void;
}
export declare const AgentInstallationCard: React.FC<AgentInstallationCardProps>;
export {};
//# sourceMappingURL=AgentInstallationCard.d.ts.map