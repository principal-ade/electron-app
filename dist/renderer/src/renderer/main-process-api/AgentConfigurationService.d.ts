import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentSetupStatus } from "../../shared/main-process-api-interfaces/AgentConfigAPI";
export type AgentInstallationStatus = {
    [key in SupportedAgent]: AgentSetupStatus;
};
export declare class AgentConfigurationService {
    static checkAgentInstallations(): Promise<AgentInstallationStatus>;
    static getAgentStatus(agentType: SupportedAgent): Promise<AgentSetupStatus>;
    static getAgentSetupStatus(agentType: SupportedAgent): Promise<{
        success: boolean;
        status?: AgentSetupStatus;
        error?: string;
    }>;
    static addMCPToAgent(agentType: SupportedAgent, serverName?: string): Promise<{
        success: boolean;
        error?: string;
        status?: any;
    }>;
    static removeMCPFromAgent(agentType: SupportedAgent, serverName?: string): Promise<{
        success: boolean;
        error?: string;
        status?: any;
    }>;
    static getAgentMCPStatus(agentType: SupportedAgent, serverName?: string): Promise<{
        success: boolean;
        status?: {
            hasMCP: boolean;
            mcpCount: number;
        };
        error?: string;
    }>;
    static getAgentHooksFilePath(agentType: SupportedAgent): Promise<string>;
    static getAgentMCPFilePath(agentType: SupportedAgent): Promise<string>;
    static readAgentSettings(agentType: SupportedAgent): Promise<any>;
    static addHooksToAgent(agentType: SupportedAgent): Promise<boolean>;
    static removeHooksFromAgent(agentType: SupportedAgent): Promise<boolean>;
    static updateAgentSettings(agentType: SupportedAgent, config: any): Promise<boolean>;
}
//# sourceMappingURL=AgentConfigurationService.d.ts.map