import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
// import os from 'os'; - removed unused import

import {
  SupportedAgent,
  AGENT_INFO,
  convertOpenCodeToNormalized,
  convertNormalizedToOpenCode,
  NormalizedHook,
} from '@principal-ai/agent-monitoring';
import {
  DEFAULT_MCP_SERVER_NAME,
  disableAgentMCP,
  enableAgentMCP,
  getAgentMCPStatus,
} from '@a24z/agent-manager';
import { AgentSettings } from '../../shared/types/legacy-event.types';
import { APP_BRANDING } from '../../shared/config/appBranding';

import {
  AgentConfigAPIEvent,
  AgentSetupStatus,
} from '../../shared/main-process-api-interfaces/AgentConfigAPI';

// Installation services removed - we only configure hooks now
import { EnvironmentConfig } from '../utils/environmentConfig';
import { HookConfigurationManager } from './HookConfigurationManager';

// Get agent config path
function getAgentConfigPath(agent: SupportedAgent): string {
  const info = AGENT_INFO[agent];
  if (!info.settingsPath) {
    throw new Error(`Agent ${agent} does not have a settings path`);
  }
  return EnvironmentConfig.expandHome(info.settingsPath);
}

export function setupAgentConfigHandlers() {
  // Get agent setup status
  ipcMain.handle(
    AgentConfigAPIEvent.GET_AGENT_SETUP_STATUS,
    async (
      _event,
      agentType: SupportedAgent,
    ): Promise<{
      success: boolean;
      status?: AgentSetupStatus;
      error?: string;
    }> => {
      try {
        const configPath = getAgentConfigPath(agentType);
        let isInstalled = false;
        let hasHooks = false;
        let hookCount = 0;
        let _hookScripts: string[] = [];

        // Check if agent is installed by checking if config file exists
        // We no longer install agents, just configure hooks
        // For Claude and OpenCode, check if they're in the system
        if (agentType === 'claude') {
          // For Claude, check if the CLI binary exists
          try {
            const claudePath = await EnvironmentConfig.findExecutable('claude');
            if (claudePath) {
              isInstalled = true;
              console.log('[AgentConfig] Claude CLI found at:', claudePath);
            } else {
              isInstalled = false;
              console.log('[AgentConfig] Claude CLI not found');
            }
          } catch (error) {
            console.log('[AgentConfig] Error checking for Claude CLI:', error);
            isInstalled = false;
          }
        } else if (agentType === 'opencode') {
          // For OpenCode, check if it's available in the system
          try {
            const openCodePath =
              await EnvironmentConfig.findExecutable('opencode');
            if (openCodePath) {
              isInstalled = true;
              console.log('[AgentConfig] OpenCode found at:', openCodePath);
            } else {
              isInstalled = false;
              console.log('[AgentConfig] OpenCode not found');
            }
          } catch (error) {
            console.log('[AgentConfig] Error checking for OpenCode:', error);
            isInstalled = false;
          }
        } else if (agentType === 'cline') {
          // Cline is a VS Code extension, consider it "installed" if VS Code is present
          // Users need to install the extension themselves
          isInstalled = true; // We can configure hooks regardless
          console.log(
            '[AgentConfig] Cline is a VS Code extension - hooks can be configured',
          );
        } else {
          // For other agents, check if config file exists
          try {
            await fs.access(configPath);
            isInstalled = true;
          } catch {
            // Not installed
          }
        }

        // Use HookConfigurationManager to check hook status
        const hookManager = HookConfigurationManager.getInstance();
        const hookStatus = await hookManager.getHookStatus(agentType);
        hasHooks = hookStatus.hasHooks;
        hookCount = hookStatus.hookCount;

        console.log(
          `[AgentConfig] ${agentType} has hooks: ${hasHooks}, total hooks: ${hookCount}`,
        );

        const status: AgentSetupStatus = {
          isInstalled,
          hasHooks,
          hookCount,
          configPath,
        };

        console.log(`[AgentConfig] Final status for ${agentType}:`, status);

        return {
          success: true,
          status,
        };
      } catch (error) {
        console.error(
          `[AgentConfig] Error checking ${agentType} status:`,
          error,
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    AgentConfigAPIEvent.GET_AGENT_HOOKS_FILE_PATH,
    async (_event, agentType: SupportedAgent) => {
      const info = AGENT_INFO[agentType];
      return {
        success: true,
        filePath: EnvironmentConfig.expandHome(info.hooksConfigurationPath),
      };
    },
  );

  ipcMain.handle(
    AgentConfigAPIEvent.GET_AGENT_MCP_FILE_PATH,
    async (_event, agentType: SupportedAgent) => {
      const info = AGENT_INFO[agentType];
      return {
        success: true,
        filePath: EnvironmentConfig.expandHome(info.mcpConfigurationPath),
      };
    },
  );

  // Add hooks to agent using HookConfigurationManager
  ipcMain.handle(
    AgentConfigAPIEvent.ADD_HOOKS_TO_AGENT,
    async (_event, agentType: SupportedAgent) => {
      const hookManager = HookConfigurationManager.getInstance();
      const result = await hookManager.addHooks(agentType);

      console.log(`[AgentConfig] Add hooks result for ${agentType}:`, result);

      return {
        success: result.success,
        hookCount: result.hookCount,
        error: result.error,
      };
    },
  );

  // Remove hooks from agent using HookConfigurationManager
  ipcMain.handle(
    AgentConfigAPIEvent.REMOVE_HOOKS_FROM_AGENT,
    async (_event, agentType: SupportedAgent) => {
      const hookManager = HookConfigurationManager.getInstance();
      const result = await hookManager.removeHooks(agentType);

      console.log(
        `[AgentConfig] Remove hooks result for ${agentType}:`,
        result,
      );

      return {
        success: result.success,
        hookCount: result.hookCount,
        error: result.error,
      };
    },
  );

  // Read agent settings
  ipcMain.handle(
    AgentConfigAPIEvent.READ_AGENT_SETTINGS,
    async (_event, agentType: SupportedAgent) => {
      try {
        const configPath = getAgentConfigPath(agentType);
        const content = await fs.readFile(configPath, 'utf8');
        let settings = JSON.parse(content);

        // Normalize OpenCode hooks format for UI consumption
        if (
          agentType === 'opencode' &&
          settings?.experimental?.anthropicHooks
        ) {
          // Convert OpenCode format to normalized format for UI
          settings.hooks = convertOpenCodeToNormalized(
            settings.experimental.anthropicHooks,
          );
        }

        return {
          success: true,
          settings,
          path: configPath,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          path: getAgentConfigPath(agentType),
        };
      }
    },
  );

  // Update agent settings (generic)
  ipcMain.handle(
    AgentConfigAPIEvent.UPDATE_AGENT_SETTINGS,
    async (_event, agentType: SupportedAgent, settings: AgentSettings) => {
      try {
        const configPath = getAgentConfigPath(agentType);
        const configDir = path.dirname(configPath);

        // Ensure directory exists
        await fs.mkdir(configDir, { recursive: true });

        // Convert normalized hooks format back to OpenCode format if needed
        let settingsToSave = { ...settings };
        if (agentType === 'opencode' && settings.hooks) {
          // Remove the normalized hooks field
          const { hooks, ...restSettings } = settingsToSave;
          settingsToSave = restSettings;

          // Ensure experimental.anthropicHooks structure exists
          if (!settingsToSave.experimental) {
            settingsToSave.experimental = {};
          }
          const experimental = settingsToSave.experimental as Record<
            string,
            unknown
          >;
          if (!experimental.anthropicHooks) {
            experimental.anthropicHooks = {};
          }

          // Convert normalized hooks back to OpenCode format
          experimental.anthropicHooks = convertNormalizedToOpenCode(
            hooks as Record<string, NormalizedHook[]>,
          );
        }

        // Write settings
        await fs.writeFile(configPath, JSON.stringify(settingsToSave, null, 2));

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // MCP Configuration Handlers
  ipcMain.handle(
    AgentConfigAPIEvent.ADD_MCP_TO_AGENT,
    async (
      _event,
      agentType: SupportedAgent,
      serverName: string = APP_BRANDING.MCP_SERVER_CONFIG_KEY,
    ) => {
      try {
        const resolvedServerName = serverName || DEFAULT_MCP_SERVER_NAME;
        const status = await enableAgentMCP(agentType, {
          serverName: resolvedServerName,
        });

        return {
          success: true,
          status: {
            hasMCP: status.hasMCP,
            mcpCount: status.mcpCount,
            configPath: status.configPath,
            servers: status.servers,
          },
        };
      } catch (error) {
        console.error('Error adding MCP to agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    AgentConfigAPIEvent.REMOVE_MCP_FROM_AGENT,
    async (
      _event,
      agentType: SupportedAgent,
      serverName: string = APP_BRANDING.MCP_SERVER_CONFIG_KEY,
    ) => {
      try {
        const resolvedServerName = serverName || DEFAULT_MCP_SERVER_NAME;
        const status = await disableAgentMCP(agentType, resolvedServerName);

        return {
          success: true,
          status: {
            hasMCP: status.hasMCP,
            mcpCount: status.mcpCount,
            configPath: status.configPath,
            servers: status.servers,
          },
        };
      } catch (error) {
        console.error('Error removing MCP from agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    AgentConfigAPIEvent.GET_AGENT_MCP_STATUS,
    async (
      _event,
      agentType: SupportedAgent,
      serverName: string = APP_BRANDING.MCP_SERVER_CONFIG_KEY,
    ) => {
      try {
        const resolvedServerName = serverName || DEFAULT_MCP_SERVER_NAME;
        const status = await getAgentMCPStatus(agentType, resolvedServerName);

        return {
          success: true,
          status: {
            hasMCP: status.hasMCP,
            mcpCount: status.mcpCount,
            configPath: status.configPath,
            servers: status.servers,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          status: {
            hasMCP: false,
            mcpCount: 0,
          },
        };
      }
    },
  );
}
