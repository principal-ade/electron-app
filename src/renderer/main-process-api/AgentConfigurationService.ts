import { SupportedAgent, AGENT_INFO } from '@principal-ai/agent-monitoring';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { AgentSetupStatus } from '../../shared/main-process-api-interfaces/AgentConfigAPI';
import type { AgentSettings } from '../../shared/types/agent-settings.types';
import { ShellService } from './ShellService';

export type AgentInstallationStatus = {
  claude: AgentSetupStatus;
};

/**
 * Whether an agent's CLI binary is actually present on the user's PATH.
 * Unlike AgentSetupStatus.isInstalled (which the agent-config handler hardcodes
 * to true because it only configures hooks), this is a real detection result.
 */
export type AgentDetectionResult = {
  installed: boolean;
  path?: string;
};

const EMPTY_STATUS: AgentSetupStatus = {
  isInstalled: false,
  hasHooks: false,
  hookCount: 0,
  configPath: '',
};

export class AgentConfigurationService {
  static async checkAgentInstallations(): Promise<AgentInstallationStatus> {
    try {
      const result = await window.mainProcess.agentConfig.getAgentSetupStatus(
        SupportedAgent.CLAUDE,
      );
      return { claude: result.status || EMPTY_STATUS };
    } catch (error) {
      console.error('Failed to check agent installations:', error);
      return { claude: EMPTY_STATUS };
    }
  }

  /**
   * Detect whether an agent's CLI binary is actually installed (on PATH).
   * Uses the agent's declared binaryName + a real `which` check, rather than
   * the agent-config hook status which always reports installed.
   */
  static async detectInstalled(
    agentType: SupportedAgent,
  ): Promise<AgentDetectionResult> {
    const binaryName = AGENT_INFO[agentType]?.installation?.binaryName;
    if (!binaryName) {
      return { installed: false };
    }
    try {
      const result = await ShellService.checkCommand(binaryName);
      return { installed: result.exists, path: result.path };
    } catch (error) {
      console.error(`Failed to detect ${agentType} installation:`, error);
      return { installed: false };
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
  ): Promise<{
    success: boolean;
    error?: string;
    status?: { hasMCP: boolean; mcpCount: number };
  }> {
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
  ): Promise<{
    success: boolean;
    error?: string;
    status?: { hasMCP: boolean; mcpCount: number };
  }> {
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

  static async readAgentSettings(
    agentType: SupportedAgent,
  ): Promise<AgentSettings | null> {
    try {
      const result =
        await window.mainProcess.agentConfig.readAgentSettings(agentType);
      if (!result.success) {
        return null;
      }

      return result.settings ?? null;
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
