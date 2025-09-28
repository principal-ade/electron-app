import { SupportedAgent } from '@principal-ai/agent-monitoring';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { AgentSetupStatus } from '../../shared/main-process-api-interfaces/AgentConfigAPI';

export type AgentInstallationStatus = {
  [key in SupportedAgent]: AgentSetupStatus;
};

export class AgentConfigurationService {
  static async checkAgentInstallations(): Promise<AgentInstallationStatus> {
    try {
      // Get status for each agent using the new API
      const statusPromises = Object.values(SupportedAgent).map(
        async (agentType) => {
          const result =
            await window.mainProcess.agentConfig.getAgentSetupStatus(agentType);
          const status = result.status || {
            isInstalled: false,
            hasHooks: false,
            hookCount: 0,
            configPath: '',
          };
          return { [agentType]: status };
        },
      );
      const statuses = await Promise.all(statusPromises);
      return Object.assign({}, ...statuses);
    } catch (error) {
      console.error('Failed to check agent installations:', error);
      return {} as AgentInstallationStatus;
    }
  }

  static async getAgentStatus(
    agentType: SupportedAgent,
  ): Promise<AgentSetupStatus> {
    try {
      const result =
        await window.mainProcess.agentConfig.getAgentSetupStatus(agentType);
      return (
        result.status || {
          isInstalled: false,
          hasHooks: false,
          hookCount: 0,
          configPath: '',
        }
      );
    } catch (error) {
      console.error(`Failed to get status for ${agentType}:`, error);
      return {
        isInstalled: false,
        hasHooks: false,
        hookCount: 0,
        configPath: '',
      };
    }
  }

  static async getAgentSetupStatus(
    agentType: SupportedAgent,
  ): Promise<{ success: boolean; status?: AgentSetupStatus; error?: string }> {
    try {
      return await window.mainProcess.agentConfig.getAgentSetupStatus(
        agentType,
      );
    } catch (error) {
      console.error(`Failed to get setup status for ${agentType}:`, error);
      return {
        success: false,
        status: {
          isInstalled: false,
          hasHooks: false,
          hookCount: 0,
          configPath: '',
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // MCP Configuration Methods
  static async addMCPToAgent(
    agentType: SupportedAgent,
    serverName: string = APP_BRANDING.MCP_SERVER_CONFIG_KEY,
  ): Promise<{ success: boolean; error?: string; status?: { hasMCP: boolean; mcpCount: number } }> {
    try {
      const result = await window.mainProcess.agentConfig.addMCPToAgent(
        agentType,
        serverName,
      );
      return result;
    } catch (error) {
      console.error(`Failed to add MCP to ${agentType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async removeMCPFromAgent(
    agentType: SupportedAgent,
    serverName: string = APP_BRANDING.MCP_SERVER_CONFIG_KEY,
  ): Promise<{ success: boolean; error?: string; status?: { hasMCP: boolean; mcpCount: number } }> {
    try {
      const result = await window.mainProcess.agentConfig.removeMCPFromAgent(
        agentType,
        serverName,
      );
      return result;
    } catch (error) {
      console.error(`Failed to remove MCP from ${agentType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getAgentMCPStatus(
    agentType: SupportedAgent,
    serverName: string = APP_BRANDING.MCP_SERVER_CONFIG_KEY,
  ): Promise<{
    success: boolean;
    status?: { hasMCP: boolean; mcpCount: number };
    error?: string;
  }> {
    try {
      const result = await window.mainProcess.agentConfig.getAgentMCPStatus(
        agentType,
        serverName,
      );
      return result;
    } catch (error) {
      console.error(`Failed to get MCP status for ${agentType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getAgentHooksFilePath(
    agentType: SupportedAgent,
  ): Promise<string> {
    const result =
      await window.mainProcess.agentConfig.getAgentHooksFilePath(agentType);
    return result.filePath;
  }

  static async getAgentMCPFilePath(agentType: SupportedAgent): Promise<string> {
    const result =
      await window.mainProcess.agentConfig.getAgentMCPFilePath(agentType);
    return result.filePath;
  }

  static async readAgentSettings(agentType: SupportedAgent): Promise<AgentSettings | null> {
    try {
      const result = await window.mainProcess.agentConfig.readAgentSettings(
        agentType,
      );
      return result.success ? result.settings : null;
    } catch (error) {
      console.error(`Failed to read ${agentType} settings:`, error);
      return null;
    }
  }

  static async addHooksToAgent(agentType: SupportedAgent): Promise<boolean> {
    try {
      const result =
        await window.mainProcess.agentConfig.addHooksToAgent(agentType);
      return result.success;
    } catch (error) {
      console.error(`Failed to add hooks to ${agentType}:`, error);
      return false;
    }
  }

  static async removeHooksFromAgent(
    agentType: SupportedAgent,
  ): Promise<boolean> {
    // Remove hooks from agent
    const result =
      await window.mainProcess.agentConfig.removeHooksFromAgent(agentType);
    return result.success;
  }

  static async updateAgentSettings(
    agentType: SupportedAgent,
    config: AgentSettings,
  ): Promise<boolean> {
    try {
      const result = await window.mainProcess.agentConfig.updateAgentSettings(
        agentType,
        config,
      );
      return result.success;
    } catch (error) {
      console.error(`Failed to update ${agentType} settings:`, error);
      return false;
    }
  }
}
