import { ClaudeConfigManager, type HookOptions } from '@a24z/agent-manager';
import {
  SupportedAgent,
  AgentSettings,
  countAgentHooks,
  hasAgentHook,
  getAgentInfo
} from '@principal-ai/agent-monitoring';

/**
 * Result type for hook operations
 */
export interface HookOperationResult {
  success: boolean;
  hookCount: number;
  error?: string;
  configPath?: string;
}

/**
 * Hook configuration status
 */
export interface HookConfigStatus {
  hasHooks: boolean;
  hookCount: number;
  isSupported: boolean;
  supportMessage?: string;
}

/**
 * V2 Hook Configuration Manager using @a24z/agent-manager library
 *
 * This is a simplified version that delegates to the external library
 * for Claude hooks, while maintaining compatibility with the existing interface.
 */
export class HookConfigurationManagerV2 {
  private static instance: HookConfigurationManagerV2;
  private claudeManager: ClaudeConfigManager;

  private constructor() {
    this.claudeManager = new ClaudeConfigManager();
  }

  static getInstance(): HookConfigurationManagerV2 {
    if (!HookConfigurationManagerV2.instance) {
      HookConfigurationManagerV2.instance = new HookConfigurationManagerV2();
    }
    return HookConfigurationManagerV2.instance;
  }

  /**
   * Add hooks to an agent's configuration
   */
  async addHooks(agentType: SupportedAgent): Promise<HookOperationResult> {
    try {
      // Check if agent is supported
      const supportCheck = this.checkAgentSupport(agentType);
      if (!supportCheck.isSupported) {
        return {
          success: false,
          hookCount: 0,
          error: supportCheck.message
        };
      }

      // Handle Claude using the new library
      if (agentType === 'claude') {
        const options: HookOptions = {
          port: [3043, 3044], // Default ports, should be configurable
          dir: '~/.principle/hooks'
        };

        await this.claudeManager.enableHooks(options);
        const status = await this.claudeManager.getHookStatus();
        const hookCount = Array.from(status.values()).filter(enabled => enabled).length;

        return {
          success: true,
          hookCount,
          configPath: '~/.claude/settings.json'
        };
      }

      // For other agents, fall back to existing implementation
      // TODO: Implement Gemini and OpenCode support
      return {
        success: false,
        hookCount: 0,
        error: `Agent ${agentType} not yet supported in V2`
      };
    } catch (error) {
      console.error(`[HookConfigManagerV2] Failed to add hooks to ${agentType}:`, error);
      return {
        success: false,
        hookCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Remove hooks from an agent's configuration
   */
  async removeHooks(agentType: SupportedAgent): Promise<HookOperationResult> {
    try {
      // Check if agent is supported
      const supportCheck = this.checkAgentSupport(agentType);
      if (!supportCheck.isSupported) {
        return {
          success: false,
          hookCount: 0,
          error: supportCheck.message
        };
      }

      // Handle Claude using the new library
      if (agentType === 'claude') {
        await this.claudeManager.disableHooks();

        return {
          success: true,
          hookCount: 0,
          configPath: '~/.claude/settings.json'
        };
      }

      // For other agents, fall back to existing implementation
      return {
        success: false,
        hookCount: 0,
        error: `Agent ${agentType} not yet supported in V2`
      };
    } catch (error) {
      console.error(`[HookConfigManagerV2] Failed to remove hooks from ${agentType}:`, error);
      return {
        success: false,
        hookCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get the status of hooks for an agent
   */
  async getHookStatus(agentType: SupportedAgent): Promise<HookConfigStatus> {
    try {
      // Check if agent is supported
      const supportCheck = this.checkAgentSupport(agentType);
      if (!supportCheck.isSupported) {
        return {
          hasHooks: false,
          hookCount: 0,
          isSupported: false,
          supportMessage: supportCheck.message
        };
      }

      // Handle Claude using the new library
      if (agentType === 'claude') {
        const isInstalled = await this.claudeManager.isClaudeInstalled();
        if (!isInstalled) {
          return {
            hasHooks: false,
            hookCount: 0,
            isSupported: true,
            supportMessage: 'Claude not installed'
          };
        }

        const status = await this.claudeManager.getHookStatus();
        const enabledHooks = Array.from(status.values()).filter(enabled => enabled);

        return {
          hasHooks: enabledHooks.length > 0,
          hookCount: enabledHooks.length,
          isSupported: true
        };
      }

      // For other agents, return not supported
      return {
        hasHooks: false,
        hookCount: 0,
        isSupported: false,
        supportMessage: `Agent ${agentType} not yet supported in V2`
      };
    } catch (error) {
      console.error(`[HookConfigManagerV2] Failed to get hook status for ${agentType}:`, error);
      return {
        hasHooks: false,
        hookCount: 0,
        isSupported: false,
        supportMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if an agent has a specific hook type configured
   */
  async hasHook(agentType: SupportedAgent, hookType: string): Promise<boolean> {
    try {
      if (agentType === 'claude') {
        const status = await this.claudeManager.getHookStatus();
        return status.get(hookType as any) || false;
      }
      return false;
    } catch (error) {
      console.error(`[HookConfigManagerV2] Failed to check hook ${hookType} for ${agentType}:`, error);
      return false;
    }
  }

  /**
   * Count the number of hooks configured for an agent
   */
  async countHooks(agentType: SupportedAgent): Promise<number> {
    try {
      if (agentType === 'claude') {
        const status = await this.claudeManager.getHookStatus();
        return Array.from(status.values()).filter(enabled => enabled).length;
      }
      return 0;
    } catch (error) {
      console.error(`[HookConfigManagerV2] Failed to count hooks for ${agentType}:`, error);
      return 0;
    }
  }

  /**
   * Check if an agent is supported for hook configuration
   */
  private checkAgentSupport(agentType: SupportedAgent): { isSupported: boolean; message?: string } {
    switch (agentType) {
      case 'claude':
        return { isSupported: true };

      case 'gemini':
        // Gemini support will be added later
        return {
          isSupported: false,
          message: 'Gemini hook configuration not yet implemented in V2'
        };

      case 'opencode':
        // OpenCode is transitioning to plugin system
        return {
          isSupported: false,
          message: 'OpenCode is transitioning to a plugin-based system. Hook configuration is not supported.'
        };

      default:
        return {
          isSupported: false,
          message: `Unknown agent type: ${agentType}`
        };
    }
  }

  /**
   * Get the configuration path for an agent
   */
  getConfigPath(agentType: SupportedAgent): string {
    const agentInfo = getAgentInfo(agentType);
    if (!agentInfo?.settingsPath) {
      throw new Error(`No settings path found for agent: ${agentType}`);
    }
    return agentInfo.settingsPath;
  }
}