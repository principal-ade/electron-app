import { SupportedAgent } from "@principal-ai/agent-monitoring";
export declare class AgentConfigurationService {
    private static instance;
    private constructor();
    static getInstance(): AgentConfigurationService;
    removeHooksFromConfig(agentType: SupportedAgent): Promise<{
        success: boolean;
        hookCount: number;
    }>;
}
//# sourceMappingURL=AgentConfigurationService.d.ts.map