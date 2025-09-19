import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
// import os from 'os'; - removed unused import

import {
  SupportedAgent,
  AgentSettings,
  AGENT_INFO,
  convertOpenCodeToNormalized,
  convertNormalizedToOpenCode,
  NormalizedHook,
} from '@principal-ai/agent-monitoring';

// MOCK IMPLEMENTATIONS - These functions are not exported from @principal-ai/agent-monitoring
// TODO: These need to be properly implemented or the package needs to be updated
function configureAgentMCP(
  _agentType: SupportedAgent,
  _settings: any,
  _serverName: string,
  _serverPath: string,
): any {
  throw new Error(
    'MOCK: configureAgentMCP is not implemented - missing from @principal-ai/agent-monitoring package',
  );
}

function removeAgentMCP(
  _agentType: SupportedAgent,
  _settings: any,
  _serverName: string,
): any {
  throw new Error(
    'MOCK: removeAgentMCP is not implemented - missing from @principal-ai/agent-monitoring package',
  );
}

function hasAgentMCP(
  _agentType: SupportedAgent,
  _settings: any,
  _serverName: string,
): boolean {
  throw new Error(
    'MOCK: hasAgentMCP is not implemented - missing from @principal-ai/agent-monitoring package',
  );
}

function countAgentMCPServers(
  _agentType: SupportedAgent,
  _settings: any,
): number {
  throw new Error(
    'MOCK: countAgentMCPServers is not implemented - missing from @principal-ai/agent-monitoring package',
  );
}
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

// Get agent MCP config path
function getAgentMCPConfigPath(agent: SupportedAgent): string {
  const info = AGENT_INFO[agent];
  if (!info.mcpConfigurationPath) {
    throw new Error(`Agent ${agent} does not have an MCP configuration path`);
  }
  return EnvironmentConfig.expandHome(info.mcpConfigurationPath);
}

// Helper function to read agent settings
async function readAgentSettings(configPath: string): Promise<AgentSettings> {
  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (_error) {
    // Return empty settings if file doesn't exist
    return {};
  }
}

// Helper function to write agent settings
async function writeAgentSettings(
  configPath: string,
  settings: AgentSettings,
): Promise<void> {
  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(settings, null, 2));
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
        const configPath = getAgentMCPConfigPath(agentType);
        let currentSettings = await readAgentSettings(configPath);

        // Get the MCP server path
        const mcpServerPath = EnvironmentConfig.getAssetsPath(
          APP_BRANDING.MCP_SERVER_FILENAME,
        );

        // Verify MCP server exists
        if (
          !(await fs
            .access(mcpServerPath)
            .then(() => true)
            .catch(() => false))
        ) {
          return {
            success: false,
            error: `MCP server not found at ${mcpServerPath}`,
          };
        }

        // Configure our MCP using core library
        let updatedSettings = configureAgentMCP(
          agentType,
          currentSettings,
          serverName,
          mcpServerPath,
        );

        // Also add a24z-memory MCP server (using npx to run it)
        // This provides the note storage functionality
        const a24zServerName = 'a24z-memory';

        // Check if a24z-memory is already configured
        if (!hasAgentMCP(agentType, updatedSettings, a24zServerName)) {
          console.log(
            '[AgentConfig] Adding a24z-memory MCP server alongside PrincipleMD MCP',
          );

          // For a24z-memory, we use npx to run it
          // This assumes a24z-memory is installed as a dependency
          updatedSettings = configureAgentMCP(
            agentType,
            updatedSettings,
            a24zServerName,
            'a24z-memory', // This will be run with npx
          );

          // Update the command to use npx for a24z-memory
          if (agentType === 'claude' && updatedSettings.mcpServers) {
            updatedSettings.mcpServers[a24zServerName] = {
              type: 'stdio' as const,
              command: 'npx',
              args: ['a24z-memory'],
              env: {},
            };
          }
        }

        // Write updated settings
        await writeAgentSettings(configPath, updatedSettings);

        return {
          success: true,
          status: {
            hasMCP: true,
            mcpCount: countAgentMCPServers(agentType, updatedSettings),
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
        const configPath = getAgentMCPConfigPath(agentType);
        let currentSettings = await readAgentSettings(configPath);

        // Remove our MCP using core library
        let updatedSettings = removeAgentMCP(
          agentType,
          currentSettings,
          serverName,
        );

        // Also remove a24z-memory MCP if it exists
        const a24zServerName = 'a24z-memory';
        if (hasAgentMCP(agentType, updatedSettings, a24zServerName)) {
          console.log('[AgentConfig] Also removing a24z-memory MCP server');
          updatedSettings = removeAgentMCP(
            agentType,
            updatedSettings,
            a24zServerName,
          );
        }

        // Write updated settings
        await writeAgentSettings(configPath, updatedSettings);

        return {
          success: true,
          status: {
            hasMCP: hasAgentMCP(agentType, updatedSettings, serverName),
            mcpCount: countAgentMCPServers(agentType, updatedSettings),
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
        const configPath = getAgentMCPConfigPath(agentType);
        const settings = await readAgentSettings(configPath);

        return {
          success: true,
          status: {
            hasMCP: hasAgentMCP(agentType, settings, serverName),
            mcpCount: countAgentMCPServers(agentType, settings),
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
