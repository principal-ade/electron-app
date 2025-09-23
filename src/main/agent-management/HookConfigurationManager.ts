import {
  ClaudeConfigManager,
  ClineConfigManager,
  OpenCodeConfigManager,
  type HookOptions,
  type OpenCodePluginOptions,
} from '@a24z/agent-manager';
import {
  type SupportedAgent,
  getAgentInfo,
} from '@principal-ai/agent-monitoring';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvironmentConfig } from '../utils/environmentConfig';

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
 * Hook Configuration Manager using @a24z/agent-manager library
 *
 * This delegates to the external library for Claude hooks,
 * while maintaining compatibility with the existing interface.
 */
export class HookConfigurationManager {
  private static instance: HookConfigurationManager;
  private claudeManager: ClaudeConfigManager;
  private clineManager: ClineConfigManager;
  private openCodeManager: OpenCodeConfigManager;

  private constructor() {
    this.claudeManager = new ClaudeConfigManager();
    this.clineManager = new ClineConfigManager();
    this.openCodeManager = new OpenCodeConfigManager();

    // Set the default fallback directory for Claude (Cline doesn't have this method)
    this.claudeManager.setFallbackDirectory('~/.principle/hooks');
  }

  static getInstance(): HookConfigurationManager {
    if (!HookConfigurationManager.instance) {
      HookConfigurationManager.instance = new HookConfigurationManager();
    }
    return HookConfigurationManager.instance;
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
          error: supportCheck.message,
        };
      }

      // Handle Claude using the new library
      if (agentType === 'claude') {
        const options: HookOptions = {
          port: [3043, 3044], // Default ports, should be configurable
          dir: '~/.principle/hooks',
        };

        await this.claudeManager.enableHooks(options);
        const status = await this.claudeManager.getHookStatus();
        const hookCount = Array.from(status.values()).filter(
          (enabled) => enabled,
        ).length;

        return {
          success: true,
          hookCount,
          configPath: '~/.claude/settings.json',
        };
      }

      // Handle Cline using the ClineConfigManager
      if (agentType === 'cline') {
        const options: HookOptions = {
          port: [3043, 3044], // Default ports, should be configurable
          dir: '~/.principle/hooks',
        };

        await this.clineManager.enableHooks(options);
        const status = await this.clineManager.getHookStatus();
        const hookCount = status.hookCount;

        return {
          success: true,
          hookCount,
          configPath: '~/.cline/settings.json',
        };
      }

      // Handle OpenCode using the OpenCodeConfigManager (plugin system)
      if (agentType === 'opencode') {
        const options: OpenCodePluginOptions = {
          port: 3043, // Default port, should be configurable
          local: false, // Use global config
        };

        await this.openCodeManager.enablePlugin(options);
        const status = await this.openCodeManager.getPluginStatus();
        const isEnabled = status.globalInstalled || status.localInstalled;

        return {
          success: true,
          hookCount: isEnabled ? 1 : 0, // OpenCode uses a single plugin
          configPath: status.paths.global || '~/.config/openCode/openCode.json',
        };
      }

      return {
        success: false,
        hookCount: 0,
        error: `Agent ${agentType} not supported`,
      };
    } catch (error) {
      console.error(
        `[HookConfigManager] Failed to add hooks to ${agentType}:`,
        error,
      );
      return {
        success: false,
        hookCount: 0,
        error: error instanceof Error ? error.message : String(error),
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
          error: supportCheck.message,
        };
      }

      // Handle Claude using the new library
      if (agentType === 'claude') {
        await this.claudeManager.disableHooks();

        return {
          success: true,
          hookCount: 0,
          configPath: '~/.claude/settings.json',
        };
      }

      // Handle Cline using the ClineConfigManager
      if (agentType === 'cline') {
        await this.clineManager.disableHooks();

        return {
          success: true,
          hookCount: 0,
          configPath: '~/.cline/settings.json',
        };
      }

      // Handle OpenCode using the OpenCodeConfigManager
      if (agentType === 'opencode') {
        await this.openCodeManager.disablePlugin();

        return {
          success: true,
          hookCount: 0,
          configPath: '~/.config/openCode/openCode.json',
        };
      }

      return {
        success: false,
        hookCount: 0,
        error: `Agent ${agentType} not supported`,
      };
    } catch (error) {
      console.error(
        `[HookConfigManager] Failed to remove hooks from ${agentType}:`,
        error,
      );
      return {
        success: false,
        hookCount: 0,
        error: error instanceof Error ? error.message : String(error),
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
          supportMessage: supportCheck.message,
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
            supportMessage: 'Claude not installed',
          };
        }

        const status = await this.claudeManager.getHookStatus();
        const enabledHooks = Array.from(status.values()).filter(
          (enabled) => enabled,
        );

        return {
          hasHooks: enabledHooks.length > 0,
          hookCount: enabledHooks.length,
          isSupported: true,
        };
      }

      // Handle Cline using the ClineConfigManager
      if (agentType === 'cline') {
        // Cline is a VS Code extension, we can still configure hooks
        // The hooks will be picked up when the extension is installed
        const status = await this.clineManager.getHookStatus();

        return {
          hasHooks: status.configured,
          hookCount: status.hookCount,
          isSupported: true,
        };
      }

      // Handle OpenCode using the OpenCodeConfigManager
      if (agentType === 'opencode') {
        const status = await this.openCodeManager.getPluginStatus();
        const isEnabled = status.globalInstalled || status.localInstalled;

        return {
          hasHooks: isEnabled,
          hookCount: isEnabled ? 1 : 0,
          isSupported: true,
        };
      }

      return {
        hasHooks: false,
        hookCount: 0,
        isSupported: false,
        supportMessage: `Agent ${agentType} not supported`,
      };
    } catch (error) {
      console.error(
        `[HookConfigManager] Failed to get hook status for ${agentType}:`,
        error,
      );
      return {
        hasHooks: false,
        hookCount: 0,
        isSupported: false,
        supportMessage: error instanceof Error ? error.message : String(error),
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
        // Check if the specific hook type is enabled
        const hookEvents = [
          'PreToolUse',
          'PostToolUse',
          'Notification',
          'UserPromptSubmit',
          'Stop',
          'SubagentStop',
          'PreCompact',
          'SessionStart',
          'SessionEnd',
        ] as const;
        if (hookEvents.includes(hookType as (typeof hookEvents)[number])) {
          return status.get(hookType as (typeof hookEvents)[number]) || false;
        }
        return false;
      }
      if (agentType === 'cline') {
        const status = await this.clineManager.getHookStatus();
        // Cline uses the same hook events as Claude
        return status.events.includes(
          hookType as (typeof status.events)[number],
        );
      }
      if (agentType === 'opencode') {
        // OpenCode uses a single plugin, not individual hook types
        const status = await this.openCodeManager.getPluginStatus();
        return status.globalInstalled || status.localInstalled;
      }
      return false;
    } catch (error) {
      console.error(
        `[HookConfigManager] Failed to check hook ${hookType} for ${agentType}:`,
        error,
      );
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
        return Array.from(status.values()).filter((enabled) => enabled).length;
      }
      if (agentType === 'cline') {
        const status = await this.clineManager.getHookStatus();
        return status.hookCount;
      }
      if (agentType === 'opencode') {
        const status = await this.openCodeManager.getPluginStatus();
        return status.globalInstalled || status.localInstalled ? 1 : 0;
      }
      return 0;
    } catch (error) {
      console.error(
        `[HookConfigManager] Failed to count hooks for ${agentType}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Check if an agent is supported for hook configuration
   */
  private checkAgentSupport(agentType: SupportedAgent): {
    isSupported: boolean;
    message?: string;
  } {
    switch (agentType) {
      case 'claude':
        return { isSupported: true };

      case 'cline':
        return { isSupported: true };

      case 'opencode':
        // OpenCode uses a plugin system for hooks
        return { isSupported: true };

      default:
        return {
          isSupported: false,
          message: `Unknown agent type: ${agentType}`,
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

  /**
   * Get the directory where hook fallback files are stored
   */
  getHookFallbackDirectory(): string {
    return EnvironmentConfig.expandHome('~/.principle/hooks');
  }

  /**
   * Read unprocessed events from fallback files
   */
  async readFallbackEvents(agentType?: SupportedAgent): Promise<{
    success: boolean;
    events?: Array<{
      agent: SupportedAgent;
      filePath: string;
      events: any[];
    }>;
    error?: string;
  }> {
    try {
      const results: Array<{
        agent: SupportedAgent;
        filePath: string;
        events: any[];
      }> = [];

      // Get list of agents to check
      const agentsToCheck = agentType
        ? [agentType]
        : (['claude', 'opencode', 'cline'] as SupportedAgent[]);

      for (const agent of agentsToCheck) {
        if (agent === 'claude') {
          // Use ClaudeConfigManager for Claude
          const claudeResult = await this.claudeManager.readFallbackEvents();
          if (claudeResult.success && claudeResult.events) {
            results.push(
              ...claudeResult.events.map((e: any) => ({
                ...e,
                agent: 'claude' as SupportedAgent,
              })),
            );
          }
        } else {
          // For other agents, use the existing implementation
          const directory = this.getHookFallbackDirectory();

          // Check if directory exists
          try {
            await fs.access(directory);
          } catch {
            // Directory doesn't exist, skip this agent
            continue;
          }

          const files = await fs.readdir(directory);
          const agentInfo = getAgentInfo(agent);
          const fallbackFileName = agentInfo.fallbackFileName;

          if (files.includes(fallbackFileName)) {
            const filePath = path.join(directory, fallbackFileName);

            try {
              const content = await fs.readFile(filePath, 'utf8');
              const events = JSON.parse(content);

              if (Array.isArray(events) && events.length > 0) {
                results.push({
                  agent,
                  filePath,
                  events,
                });

                console.log(
                  `[HookConfigManager] Found ${events.length} events for ${agent} in ${filePath}`,
                );
              }
            } catch (error) {
              console.error(
                `[HookConfigManager] Failed to read fallback file ${filePath}:`,
                error,
              );
            }
          }
        }
      }

      return { success: true, events: results };
    } catch (error) {
      console.error(
        '[HookConfigManager] Failed to read fallback events:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear processed events from a fallback file (by backing it up and creating a new empty one)
   */
  async clearFallbackFile(filePath: string): Promise<{
    success: boolean;
    backupPath?: string;
    error?: string;
  }> {
    try {

      // For other agents, use the existing implementation
      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = filePath.replace('.json', `.backup-${timestamp}.json`);

      // Move the original file to backup
      await fs.rename(filePath, backupPath);

      // Create new empty array file
      await fs.writeFile(filePath, '[]', 'utf8');

      console.log(`[HookConfigManager] Backed up ${filePath} to ${backupPath}`);

      return { success: true, backupPath };
    } catch (error) {
      console.error(
        `[HookConfigManager] Failed to clear fallback file ${filePath}:`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get statistics about fallback files
   */
  async getFallbackStats(): Promise<{
    success: boolean;
    stats?: {
      directory: string;
      exists: boolean;
      agents: Array<{
        agent: SupportedAgent;
        hasFile: boolean;
        eventCount: number;
        fileSize?: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const directory = this.getHookFallbackDirectory();
      let exists = true;

      try {
        await fs.access(directory);
      } catch {
        exists = false;
      }

      const agentStats: Array<{
        agent: SupportedAgent;
        hasFile: boolean;
        eventCount: number;
        fileSize?: number;
      }> = [];

      const agents: SupportedAgent[] = [
        'claude' as SupportedAgent,
        'opencode' as SupportedAgent,
        'cline' as SupportedAgent,
      ];

      for (const agent of agents) {
        if (agent === 'claude') {
          // Use ClaudeConfigManager for Claude
          const claudeStats = await this.claudeManager.getFallbackStats();
          if (claudeStats.success && claudeStats.stats) {
            agentStats.push({
              agent: 'claude' as SupportedAgent,
              hasFile: claudeStats.stats.hasFile,
              eventCount: claudeStats.stats.eventCount,
              fileSize: claudeStats.stats.fileSize,
            });
          } else {
            agentStats.push({
              agent: 'claude' as SupportedAgent,
              hasFile: false,
              eventCount: 0,
            });
          }
        } else if (exists) {
          // For other agents, use the existing implementation
          const agentInfo = getAgentInfo(agent);
          const filePath = path.join(directory, agentInfo.fallbackFileName);

          try {
            const stat = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf8');
            const events = JSON.parse(content);

            agentStats.push({
              agent,
              hasFile: true,
              eventCount: Array.isArray(events) ? events.length : 0,
              fileSize: stat.size,
            });
          } catch {
            agentStats.push({
              agent,
              hasFile: false,
              eventCount: 0,
            });
          }
        } else {
          agentStats.push({
            agent,
            hasFile: false,
            eventCount: 0,
          });
        }
      }

      return {
        success: true,
        stats: {
          directory,
          exists,
          agents: agentStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
