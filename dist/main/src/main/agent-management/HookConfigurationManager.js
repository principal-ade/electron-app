import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SupportedAgent, configureAgentHooks, removeAgentHooks, countAgentHooks, hasAgentHook, getAgentInfo } from '@principal-ai/agent-monitoring';
/**
 * Manages hook configuration for different AI agents.
 * This class encapsulates all logic for adding, removing, and managing hooks
 * for Claude, Gemini, and OpenCode agents.
 *
 * Future: This will be extracted into an NPX package that can be called via:
 * - npx @principal-ai/agent-hooks claude-hook --enable --port 3043 --dir ~/a24z/
 * - npx @principal-ai/agent-hooks gemini-hook --enable --port 3043 --dir ~/a24z/
 * - npx @principal-ai/agent-hooks opencode-hook --enable --port 3043 --dir ~/a24z/
 */
export class HookConfigurationManager {
    static instance;
    // Claude hook types - includes all available hooks from documentation
    CLAUDE_HOOK_TYPES = [
        'PreToolUse',
        'PostToolUse',
        'Notification',
        'Stop',
        'SubagentStop',
        'UserPromptSubmit', // Missing in current implementation
        'PreCompact', // Missing in current implementation
        'SessionStart', // Missing in current implementation
        'SessionEnd' // Missing in current implementation
    ];
    // Gemini hook types
    GEMINI_HOOK_TYPES = [
        'PreToolUse',
        'PostToolUse',
        'Stop',
        'Notification',
        'SubagentStop',
        'PreCompact'
    ];
    // OpenCode hook types (will be deprecated in favor of plugins)
    OPENCODE_HOOK_TYPES = [
        'tool_call',
        'file_read',
        'file_edited',
        'web_access',
        'session_stop'
    ];
    constructor() {
        // Singleton pattern
    }
    static getInstance() {
        if (!HookConfigurationManager.instance) {
            HookConfigurationManager.instance = new HookConfigurationManager();
        }
        return HookConfigurationManager.instance;
    }
    /**
     * Add hooks to an agent's configuration
     */
    async addHooks(agentType) {
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
            // Get configuration path
            const configPath = this.getConfigPath(agentType);
            // Read current settings
            const currentSettings = await this.readAgentSettings(configPath);
            // Configure hooks based on agent type
            const updatedSettings = await this.configureHooksForAgent(agentType, currentSettings);
            // Write updated settings
            await this.writeAgentSettings(configPath, updatedSettings);
            // Count hooks
            const hookCount = this.countHooksForAgent(agentType, updatedSettings);
            return {
                success: true,
                hookCount,
                configPath
            };
        }
        catch (error) {
            console.error(`[HookConfigManager] Failed to add hooks to ${agentType}:`, error);
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
    async removeHooks(agentType) {
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
            // Get configuration path
            const configPath = this.getConfigPath(agentType);
            // Read current settings
            const currentSettings = await this.readAgentSettings(configPath);
            if (!currentSettings || Object.keys(currentSettings).length === 0) {
                // No config to remove hooks from
                return {
                    success: true,
                    hookCount: 0,
                    configPath
                };
            }
            // Get the NPX command for this agent to remove
            const npxCommand = this.getNpxCommand(agentType);
            // Remove hooks using core library
            const updatedSettings = removeAgentHooks(agentType, currentSettings, npxCommand);
            // Write updated settings
            await this.writeAgentSettings(configPath, updatedSettings);
            // Count remaining hooks
            const hookCount = this.countHooksForAgent(agentType, updatedSettings);
            return {
                success: true,
                hookCount,
                configPath
            };
        }
        catch (error) {
            console.error(`[HookConfigManager] Failed to remove hooks from ${agentType}:`, error);
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
    async getHookStatus(agentType) {
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
            const configPath = this.getConfigPath(agentType);
            const npxCommand = this.getNpxCommand(agentType);
            const settings = await this.readAgentSettings(configPath);
            const hasHooks = hasAgentHook(agentType, settings, npxCommand);
            const hookCount = this.countHooksForAgent(agentType, settings);
            return {
                hasHooks,
                hookCount,
                isSupported: true
            };
        }
        catch (error) {
            console.error(`[HookConfigManager] Failed to get hook status for ${agentType}:`, error);
            return {
                hasHooks: false,
                hookCount: 0,
                isSupported: true
            };
        }
    }
    /**
     * Check if an agent type is supported for hook configuration
     */
    checkAgentSupport(agentType) {
        if (agentType === SupportedAgent.OPENCODE) {
            return {
                isSupported: false,
                message: 'OpenCode is transitioning to a plugin-based system. Hook configuration is not currently supported. Please use the OpenCode plugin system instead.'
            };
        }
        return { isSupported: true };
    }
    /**
     * Get the NPX command for a specific agent
     */
    getNpxCommand(agentType) {
        switch (agentType) {
            case SupportedAgent.CLAUDE:
                return 'npx @principal-ai/agent-hooks claude-hook --port 3043';
            case SupportedAgent.GEMINI:
                return 'npx @principal-ai/agent-hooks gemini-hook --port 3043';
            case SupportedAgent.OPENCODE:
                return 'npx @principal-ai/agent-hooks opencode-hook --port 3043';
            default:
                throw new Error(`Unsupported agent type: ${agentType}`);
        }
    }
    /**
     * Configure hooks for a specific agent type
     */
    async configureHooksForAgent(agentType, currentSettings) {
        const npxCommand = this.getNpxCommand(agentType);
        switch (agentType) {
            case SupportedAgent.CLAUDE:
                return this.configureClaudeHooks(currentSettings, npxCommand);
            case SupportedAgent.GEMINI:
                // Use existing implementation from core library with NPX command
                return configureAgentHooks(agentType, currentSettings, npxCommand);
            case SupportedAgent.OPENCODE:
                // This should never be reached due to support check
                throw new Error('OpenCode hook configuration is not supported');
            default:
                throw new Error(`Unsupported agent type: ${agentType}`);
        }
    }
    /**
     * Configure Claude hooks with ALL available hook types
     */
    configureClaudeHooks(settings, npxCommand) {
        const updatedSettings = JSON.parse(JSON.stringify(settings));
        if (!updatedSettings.hooks) {
            updatedSettings.hooks = {};
        }
        const hookConfig = {
            type: 'command',
            command: npxCommand,
            timeout: 30
        };
        // Add ALL Claude hook types
        this.CLAUDE_HOOK_TYPES.forEach(hookType => {
            if (!updatedSettings.hooks[hookType]) {
                updatedSettings.hooks[hookType] = [];
            }
            // Check if hook already exists
            const existingIndex = updatedSettings.hooks[hookType].findIndex((h) => h.matcher === '*' && h.hooks.some((hook) => hook.command.includes('@principal-ai/agent-hooks')));
            if (existingIndex === -1) {
                updatedSettings.hooks[hookType].push({
                    matcher: '*',
                    hooks: [hookConfig]
                });
            }
            else {
                // Update existing
                updatedSettings.hooks[hookType][existingIndex] = {
                    matcher: '*',
                    hooks: [hookConfig]
                };
            }
        });
        return updatedSettings;
    }
    /**
     * Count hooks for a specific agent type
     */
    countHooksForAgent(agentType, settings) {
        try {
            // For Claude, we need custom counting since we're adding more hook types
            if (agentType === SupportedAgent.CLAUDE && settings.hooks) {
                let count = 0;
                Object.values(settings.hooks).forEach((hookArray) => {
                    if (Array.isArray(hookArray)) {
                        hookArray.forEach((hookConfig) => {
                            if (hookConfig.hooks && Array.isArray(hookConfig.hooks)) {
                                count += hookConfig.hooks.length;
                            }
                        });
                    }
                });
                return count;
            }
            // Use core library for other agents
            return countAgentHooks(agentType, settings);
        }
        catch (error) {
            console.error(`[HookConfigManager] Error counting hooks for ${agentType}:`, error);
            return 0;
        }
    }
    /**
     * Get the configuration file path for an agent
     */
    getConfigPath(agentType) {
        const agentInfo = getAgentInfo(agentType);
        return this.expandHome(agentInfo.hooksConfigurationPath);
    }
    /**
     * Expand home directory in path
     */
    expandHome(filePath) {
        if (filePath.startsWith('~/')) {
            return path.join(os.homedir(), filePath.slice(2));
        }
        if (process.platform === 'win32' && filePath.includes('%USERPROFILE%')) {
            return filePath.replace('%USERPROFILE%', os.homedir());
        }
        return filePath;
    }
    /**
     * Read agent settings from file
     */
    async readAgentSettings(configPath) {
        try {
            const content = await fs.readFile(configPath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            // Return empty settings if file doesn't exist
            return {};
        }
    }
    /**
     * Write agent settings to file
     */
    async writeAgentSettings(configPath, settings) {
        const configDir = path.dirname(configPath);
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(settings, null, 2));
    }
    /**
     * Future NPX interface - these methods simulate what the NPX package will do
     */
    async executeNpxCommand(command, agentType, action) {
        console.log(`[HookConfigManager] Simulating: npx @principal-ai/agent-hooks ${command} --${action}`);
        switch (action) {
            case 'enable':
                const addResult = await this.addHooks(agentType);
                console.log(`Hooks ${addResult.success ? 'enabled' : 'failed to enable'} for ${agentType}`);
                break;
            case 'disable':
                const removeResult = await this.removeHooks(agentType);
                console.log(`Hooks ${removeResult.success ? 'disabled' : 'failed to disable'} for ${agentType}`);
                break;
            case 'status':
                const status = await this.getHookStatus(agentType);
                console.log(`${agentType} hooks: ${status.hasHooks ? 'enabled' : 'disabled'} (${status.hookCount} hooks)`);
                break;
        }
    }
}
