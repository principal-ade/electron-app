import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import "@a24z/panels/style.css";
import { AgentSetupStatus } from '../../../../shared/main-process-api-interfaces/AgentConfigAPI';
interface DetailedConfigurationViewProps {
    agentType: SupportedAgent;
    initialAgentStatus: AgentSetupStatus;
    checkAgentStatus: () => Promise<void>;
    onBackToSetup?: () => void;
}
export declare const DetailedConfigurationView: React.FC<DetailedConfigurationViewProps>;
export {};
//# sourceMappingURL=DetailedConfigurationView.d.ts.map