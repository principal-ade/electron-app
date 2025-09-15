import { countAgentHooks, getAgentInfo, removeAgentHooks } from "@principal-ai/agent-monitoring";
import { EnvironmentConfig } from "../utils/environmentConfig";
import fs from "fs-extra";
export class AgentConfigurationService {
    static instance;
    constructor() {
        // Singleton pattern - empty constructor is intentional
    }
    static getInstance() {
        if (!AgentConfigurationService.instance) {
            AgentConfigurationService.instance = new AgentConfigurationService();
        }
        return AgentConfigurationService.instance;
    }
    async removeHooksFromConfig(agentType) {
        // Read current settings
        const configPath = EnvironmentConfig.expandHome(getAgentInfo(agentType).hooksConfigurationPath);
        let currentSettings = {};
        try {
            const content = await fs.readFile(configPath, 'utf8');
            currentSettings = JSON.parse(content);
            console.log('currentSettings', currentSettings);
        }
        catch (_error) {
            // No config to remove hooks from
            return {
                success: true,
                hookCount: 0,
            };
        }
        // Get the hook script path for this agent
        const hookScriptPath = EnvironmentConfig.getAssetsPath(getAgentInfo(agentType).hookPath);
        console.log('hookScriptPath', hookScriptPath);
        // Remove hooks using core library
        const updatedSettings = removeAgentHooks(agentType, currentSettings, hookScriptPath);
        console.log('updatedSettings', updatedSettings);
        // Write updated settings
        await fs.writeFile(configPath, JSON.stringify(updatedSettings, null, 2));
        return {
            success: true,
            hookCount: countAgentHooks(agentType, updatedSettings),
        };
    }
}
