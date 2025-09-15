import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { APP_BRANDING } from '../../shared/config/appBranding';
export class AgentConfigurationService {
    static async checkAgentInstallations() {
        try {
            // Get status for each agent using the new API
            const statusPromises = Object.values(SupportedAgent).map(async (agentType) => {
                const result = await window.mainProcess.agentConfig.getAgentSetupStatus(agentType);
                const status = result.status || {
                    isInstalled: false,
                    hasHooks: false,
                    hookCount: 0,
                    configPath: ''
                };
                return { [agentType]: status };
            });
            const statuses = await Promise.all(statusPromises);
            return Object.assign({}, ...statuses);
        }
        catch (error) {
            console.error('Failed to check agent installations:', error);
            return {};
        }
    }
    static async getAgentStatus(agentType) {
        try {
            const result = await window.mainProcess.agentConfig.getAgentSetupStatus(agentType);
            return result.status || {
                isInstalled: false,
                hasHooks: false,
                hookCount: 0,
                configPath: ''
            };
        }
        catch (error) {
            console.error(`Failed to get status for ${agentType}:`, error);
            return {
                isInstalled: false,
                hasHooks: false,
                hookCount: 0,
                configPath: ''
            };
        }
    }
    static async getAgentSetupStatus(agentType) {
        try {
            return await window.mainProcess.agentConfig.getAgentSetupStatus(agentType);
        }
        catch (error) {
            console.error(`Failed to get setup status for ${agentType}:`, error);
            return {
                success: false,
                status: {
                    isInstalled: false,
                    hasHooks: false,
                    hookCount: 0,
                    configPath: ''
                },
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // MCP Configuration Methods
    static async addMCPToAgent(agentType, serverName = APP_BRANDING.MCP_SERVER_CONFIG_KEY) {
        try {
            const result = await window.mainProcess.agentConfig.addMCPToAgent(agentType, serverName);
            return result;
        }
        catch (error) {
            console.error(`Failed to add MCP to ${agentType}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    static async removeMCPFromAgent(agentType, serverName = APP_BRANDING.MCP_SERVER_CONFIG_KEY) {
        try {
            const result = await window.mainProcess.agentConfig.removeMCPFromAgent(agentType, serverName);
            return result;
        }
        catch (error) {
            console.error(`Failed to remove MCP from ${agentType}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    static async getAgentMCPStatus(agentType, serverName = APP_BRANDING.MCP_SERVER_CONFIG_KEY) {
        try {
            const result = await window.mainProcess.agentConfig.getAgentMCPStatus(agentType, serverName);
            return result;
        }
        catch (error) {
            console.error(`Failed to get MCP status for ${agentType}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    static async getAgentHooksFilePath(agentType) {
        const result = await window.mainProcess.agentConfig.getAgentHooksFilePath(agentType);
        return result.filePath;
    }
    static async getAgentMCPFilePath(agentType) {
        const result = await window.mainProcess.agentConfig.getAgentMCPFilePath(agentType);
        return result.filePath;
    }
    static async readAgentSettings(agentType) {
        try {
            const result = await window.mainProcess.agentConfig.readAgentSettings(agentType);
            return result.success ? result.settings : null;
        }
        catch (error) {
            console.error(`Failed to read ${agentType} settings:`, error);
            return null;
        }
    }
    static async addHooksToAgent(agentType) {
        try {
            const result = await window.mainProcess.agentConfig.addHooksToAgent(agentType);
            return result.success;
        }
        catch (error) {
            console.error(`Failed to add hooks to ${agentType}:`, error);
            return false;
        }
    }
    static async removeHooksFromAgent(agentType) {
        console.log('removeHooksFromAgent', agentType);
        const result = await window.mainProcess.agentConfig.removeHooksFromAgent(agentType);
        return result.success;
    }
    static async updateAgentSettings(agentType, config) {
        try {
            const result = await window.mainProcess.agentConfig.updateAgentSettings(agentType, config);
            return result.success;
        }
        catch (error) {
            console.error(`Failed to update ${agentType} settings:`, error);
            return false;
        }
    }
}
