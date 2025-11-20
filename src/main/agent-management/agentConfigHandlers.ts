import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
// import os from 'os'; - removed unused import

import { SupportedAgent, AGENT_INFO } from '@principal-ai/agent-monitoring';
import {
  DEFAULT_MCP_SERVER_NAME,
  disableAgentMCP,
  enableAgentMCP,
  getAgentMCPStatus,
} from '@principal-ade/agent-manager';
import { AgentSettings } from '../../shared/types/agent-settings.types';
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
        // For Claude, OpenCode, and Cline - we don't block on installation
        // Users can configure hooks regardless of whether we detect the binary
        if (agentType === 'claude') {
          // Claude: Don't block on installation detection
          isInstalled = true;
          console.log('[AgentConfig] Claude - allowing configuration regardless of installation status');
        } else if (agentType === 'opencode') {
          // OpenCode: Don't block on installation detection
          isInstalled = true;
          console.log('[AgentConfig] OpenCode - allowing configuration regardless of installation status');
        } else if (agentType === 'cline') {
          // Cline is a VS Code extension, consider it "installed" if VS Code is present
          // Users need to install the extension themselves
          isInstalled = true; // We can configure hooks regardless
          console.log(
            '[AgentConfig] Cline is a VS Code extension - hooks can be configured',
          );
        } else if (agentType === 'droid') {
          // Droid: Don't block on installation detection
          isInstalled = true;
          console.log('[AgentConfig] Droid - allowing configuration regardless of installation status');
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
        const settings = JSON.parse(content);

        // Note: OpenCode now uses a plugin system, not hooks
        // The UI should handle OpenCode differently

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
        // OpenCode should use plugin system, not direct settings updates for hooks
        if (agentType === 'opencode') {
          return {
            success: false,
            error:
              'OpenCode uses a plugin system. Hook configuration is not supported via settings.',
          };
        }

        const configPath = getAgentConfigPath(agentType);
        const configDir = path.dirname(configPath);

        // Ensure directory exists
        await fs.mkdir(configDir, { recursive: true });

        // Write settings
        await fs.writeFile(configPath, JSON.stringify(settings, null, 2));

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
