"use strict";
/**
 * Agent Configuration Utilities
 * Functions for configuring agent settings with hooks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENCODE_HOOK_TYPES = exports.GEMINI_HOOK_TYPES = exports.CLAUDE_HOOK_TYPES = void 0;
exports.configureClaudeHooks = configureClaudeHooks;
exports.removeClaudeHooks = removeClaudeHooks;
exports.hasClaudeHook = hasClaudeHook;
exports.countClaudeHooks = countClaudeHooks;
exports.getClaudeHookScripts = getClaudeHookScripts;
exports.configureGeminiHooks = configureGeminiHooks;
exports.removeGeminiHooks = removeGeminiHooks;
exports.hasGeminiHook = hasGeminiHook;
exports.countGeminiHooks = countGeminiHooks;
exports.configureOpenCodeHooks = configureOpenCodeHooks;
exports.removeOpenCodeHooks = removeOpenCodeHooks;
exports.hasOpenCodeHook = hasOpenCodeHook;
exports.countOpenCodeHooks = countOpenCodeHooks;
exports.getHookTypeDisplayName = getHookTypeDisplayName;
exports.getHookTypeDescription = getHookTypeDescription;
exports.hookTypeUsesMatchers = hookTypeUsesMatchers;
exports.getDefaultMatcher = getDefaultMatcher;
exports.getAvailableHookTypes = getAvailableHookTypes;
exports.configureAgentHooks = configureAgentHooks;
exports.removeAgentHooks = removeAgentHooks;
exports.hasAgentHook = hasAgentHook;
exports.countAgentHooks = countAgentHooks;
/**
 * Hook types supported by Claude
 */
exports.CLAUDE_HOOK_TYPES = [
    'PreToolUse',
    'PostToolUse',
    'Notification',
    'Stop',
    'SubagentStop',
];
/**
 * Hook types supported by Gemini
 */
exports.GEMINI_HOOK_TYPES = [
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'Notification',
    'SubagentStop',
    'PreCompact',
];
/**
 * Configure hooks for Claude agent
 * Adds or updates hooks configuration to register all hook types with the provided script
 *
 * @param settings - Current Claude settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns Modified settings object with hooks configured
 */
function configureClaudeHooks(settings, hookScriptPath) {
    // Create a copy of settings to avoid mutation
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    // Initialize hooks if not present
    if (!updatedSettings.hooks) {
        updatedSettings.hooks = {};
    }
    // Configure each hook type to use our script with a wildcard matcher
    // TODO: Check for node in path
    const hookCommand = {
        type: 'command',
        command: `node ${hookScriptPath}`,
        timeout: 30, // 30 seconds timeout
    };
    // Add hook configuration for each type
    exports.CLAUDE_HOOK_TYPES.forEach(hookType => {
        // Initialize array if not present
        if (!updatedSettings.hooks[hookType]) {
            updatedSettings.hooks[hookType] = [];
        }
        // Check if our hook already exists
        const existingHookIndex = updatedSettings.hooks[hookType].findIndex((matcher) => matcher.matcher === '*' && matcher.hooks.some(h => h.command.includes(hookScriptPath)));
        if (existingHookIndex === -1) {
            // Add new hook configuration with wildcard matcher
            updatedSettings.hooks[hookType].push({
                matcher: '*', // Match all events
                hooks: [hookCommand],
            });
        }
        else {
            // Update existing hook configuration
            updatedSettings.hooks[hookType][existingHookIndex] = {
                matcher: '*',
                hooks: [hookCommand],
            };
        }
    });
    return updatedSettings;
}
/**
 * Remove hooks configuration for a specific script
 *
 * @param settings - Current Claude settings object
 * @param hookScriptPath - Full path to the hook script to remove
 * @returns Modified settings object with hooks removed
 */
function removeClaudeHooks(settings, hookScriptPath) {
    // Create a copy of settings to avoid mutation
    console.log('removeClaudeHooks', hookScriptPath);
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.hooks) {
        return updatedSettings;
    }
    // Remove hook configuration for each type
    exports.CLAUDE_HOOK_TYPES.forEach(hookType => {
        if (!updatedSettings.hooks[hookType]) {
            return;
        }
        // Filter out matchers that contain our hook script
        updatedSettings.hooks[hookType] = updatedSettings.hooks[hookType].filter((matcher) => {
            // Keep the matcher if it doesn't contain our hook script
            matcher.hooks = matcher.hooks.filter(h => !h.command.includes(hookScriptPath));
            // Only keep the matcher if it still has hooks
            return matcher.hooks.length > 0;
        });
        // Remove the hook type array if empty
        if (updatedSettings.hooks[hookType].length === 0) {
            delete updatedSettings.hooks[hookType];
        }
    });
    // Remove hooks object if empty
    if (Object.keys(updatedSettings.hooks).length === 0) {
        delete updatedSettings.hooks;
    }
    return updatedSettings;
}
/**
 * Check if a settings object has a specific hook script configured
 *
 * @param settings - Claude settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns True if the hook script is configured
 */
function hasClaudeHook(settings, hookScriptPath) {
    if (!settings.hooks) {
        return false;
    }
    return exports.CLAUDE_HOOK_TYPES.some(hookType => {
        const matchers = settings.hooks?.[hookType];
        if (!matchers)
            return false;
        return matchers.some((matcher) => matcher.hooks.some(h => h.command.includes(hookScriptPath)));
    });
}
/**
 * Count total number of hooks configured
 *
 * @param settings - Claude settings object
 * @returns Total number of hook commands configured
 */
function countClaudeHooks(settings) {
    if (!settings.hooks) {
        return 0;
    }
    let count = 0;
    exports.CLAUDE_HOOK_TYPES.forEach(hookType => {
        const matchers = settings.hooks?.[hookType];
        if (matchers) {
            matchers.forEach((matcher) => {
                count += matcher.hooks.length;
            });
        }
    });
    return count;
}
/**
 * Get all unique hook scripts configured
 *
 * @param settings - Claude settings object
 * @returns Array of unique hook script paths
 */
function getClaudeHookScripts(settings) {
    if (!settings.hooks) {
        return [];
    }
    const scripts = new Set();
    exports.CLAUDE_HOOK_TYPES.forEach(hookType => {
        const matchers = settings.hooks?.[hookType];
        if (matchers) {
            matchers.forEach((matcher) => {
                matcher.hooks.forEach(h => scripts.add(h.command));
            });
        }
    });
    return Array.from(scripts);
}
/**
 * Configure hooks for Gemini agent
 */
function configureGeminiHooks(settings, hookScriptPath) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.hooks) {
        updatedSettings.hooks = {};
    }
    // Gemini uses tool name matchers for different hook types
    const hookCommand = {
        type: 'command',
        command: hookScriptPath,
        timeout: 30000, // 30 seconds timeout
    };
    // Configure all available Gemini hook types
    exports.GEMINI_HOOK_TYPES.forEach(hookType => {
        // Initialize array if not present
        if (!updatedSettings.hooks[hookType]) {
            updatedSettings.hooks[hookType] = [];
        }
        // Check if our hook already exists
        const existingHookIndex = updatedSettings.hooks[hookType].findIndex((config) => config.hooks && config.hooks.some(h => h.command === hookScriptPath));
        if (existingHookIndex === -1) {
            // Add hook configuration based on hook type
            let matcher;
            switch (hookType) {
                case 'PreToolUse':
                case 'PostToolUse':
                    // For tool use hooks, match common file operations
                    matcher = 'read_file|write_file|replace|read_many_files|list_files|search_files';
                    break;
                case 'Stop':
                case 'SubagentStop':
                case 'Notification':
                    // These hooks don't need specific matchers
                    matcher = '';
                    break;
                case 'PreCompact':
                    // Pre-compact hook for context management
                    matcher = '*';
                    break;
                default:
                    matcher = '*';
            }
            updatedSettings.hooks[hookType].push({
                matcher,
                hooks: [hookCommand],
            });
        }
        else {
            // Update existing hook configuration
            updatedSettings.hooks[hookType][existingHookIndex] = {
                matcher: updatedSettings.hooks[hookType][existingHookIndex].matcher,
                hooks: [hookCommand],
            };
        }
    });
    return updatedSettings;
}
/**
 * Remove hooks from Gemini configuration
 */
function removeGeminiHooks(settings, hookScriptPath) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.hooks) {
        return updatedSettings;
    }
    // Remove hooks for each type
    exports.GEMINI_HOOK_TYPES.forEach(hookType => {
        if (!updatedSettings.hooks[hookType]) {
            return;
        }
        // Filter out configurations that contain our hook script
        updatedSettings.hooks[hookType] = updatedSettings.hooks[hookType].filter((config) => {
            // Ensure config.hooks exists and is an array
            if (!config.hooks || !Array.isArray(config.hooks)) {
                return true; // Keep configs without hooks array
            }
            // Filter out hooks that match our script path
            config.hooks = config.hooks.filter(h => {
                // Ensure the hook has a command property
                if (!h || typeof h.command !== 'string') {
                    return true; // Keep hooks without valid command
                }
                return !h.command.includes(hookScriptPath);
            });
            // Only keep the config if it still has hooks
            return config.hooks.length > 0;
        });
        // Remove the hook type array if empty
        if (updatedSettings.hooks[hookType].length === 0) {
            delete updatedSettings.hooks[hookType];
        }
    });
    // Remove hooks object if empty
    if (Object.keys(updatedSettings.hooks).length === 0) {
        delete updatedSettings.hooks;
    }
    return updatedSettings;
}
/**
 * Check if Gemini has hooks configured
 */
function hasGeminiHook(settings, hookScriptPath) {
    if (!settings.hooks) {
        return false;
    }
    return exports.GEMINI_HOOK_TYPES.some(hookType => {
        const configs = settings.hooks?.[hookType];
        if (!configs || !Array.isArray(configs))
            return false;
        return configs.some((config) => {
            if (!config.hooks || !Array.isArray(config.hooks))
                return false;
            return config.hooks.some(h => {
                if (!h || typeof h.command !== 'string')
                    return false;
                return h.command.includes(hookScriptPath);
            });
        });
    });
}
/**
 * Count Gemini hooks
 */
function countGeminiHooks(settings) {
    if (!settings.hooks) {
        return 0;
    }
    let count = 0;
    exports.GEMINI_HOOK_TYPES.forEach(hookType => {
        const configs = settings.hooks?.[hookType];
        if (configs) {
            configs.forEach((config) => {
                count += config.hooks.length;
            });
        }
    });
    return count;
}
/**
 * OpenCode hook types
 */
exports.OPENCODE_HOOK_TYPES = [
    'tool_call',
    'file_read',
    'file_edited',
    'web_access',
    'session_stop',
];
/**
 * Configure hooks for OpenCode agent
 */
function configureOpenCodeHooks(settings, hookScriptPath) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    // Initialize experimental section if not present
    if (!updatedSettings.experimental) {
        updatedSettings.experimental = {};
    }
    // Initialize hooks if not present
    if (!updatedSettings.experimental.anthropicHooks) {
        updatedSettings.experimental.anthropicHooks = {};
    }
    // Create hook command configuration
    const hookCommand = {
        command: ['node', hookScriptPath],
        environment: {
            AGENT_HOOK_TRACK_ALL_TOOLS: 'true',
        },
    };
    // Configure each hook type
    exports.OPENCODE_HOOK_TYPES.forEach(hookType => {
        // Initialize array if not present
        if (!updatedSettings.experimental.anthropicHooks[hookType]) {
            updatedSettings.experimental.anthropicHooks[hookType] = [];
        }
        // Check if our hook already exists
        const existingHookIndex = updatedSettings.experimental.anthropicHooks[hookType].findIndex((cmd) => cmd.command.some(part => part.includes(hookScriptPath)));
        if (existingHookIndex === -1) {
            // Add new hook configuration
            updatedSettings.experimental.anthropicHooks[hookType].push(hookCommand);
        }
        else {
            // Update existing hook configuration
            updatedSettings.experimental.anthropicHooks[hookType][existingHookIndex] = hookCommand;
        }
    });
    return updatedSettings;
}
/**
 * Remove hooks from OpenCode configuration
 */
function removeOpenCodeHooks(settings, hookScriptPath) {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    if (!updatedSettings.experimental?.anthropicHooks) {
        return updatedSettings;
    }
    // Remove hooks for each type
    exports.OPENCODE_HOOK_TYPES.forEach(hookType => {
        if (!updatedSettings.experimental.anthropicHooks[hookType]) {
            return;
        }
        // Filter out configurations that contain our hook script
        updatedSettings.experimental.anthropicHooks[hookType] =
            updatedSettings.experimental.anthropicHooks[hookType].filter((cmd) => {
                // Check if command array contains our hook script path
                if (!cmd.command || !Array.isArray(cmd.command)) {
                    return true; // Keep commands without valid command array
                }
                return !cmd.command.some(part => part.includes(hookScriptPath));
            });
        // Remove the hook type array if empty
        if (updatedSettings.experimental.anthropicHooks[hookType].length === 0) {
            delete updatedSettings.experimental.anthropicHooks[hookType];
        }
    });
    // Remove hook object if empty
    if (Object.keys(updatedSettings.experimental.anthropicHooks).length === 0) {
        delete updatedSettings.experimental.anthropicHooks;
    }
    // Remove experimental object if only had hook
    if (updatedSettings.experimental && Object.keys(updatedSettings.experimental).length === 0) {
        delete updatedSettings.experimental;
    }
    return updatedSettings;
}
/**
 * Check if OpenCode has hooks configured
 */
function hasOpenCodeHook(settings, hookScriptPath) {
    if (!settings.experimental?.anthropicHooks) {
        return false;
    }
    return exports.OPENCODE_HOOK_TYPES.some(hookType => {
        const commands = settings.experimental?.anthropicHooks?.[hookType];
        if (!commands || !Array.isArray(commands))
            return false;
        return commands.some((cmd) => {
            if (!cmd.command || !Array.isArray(cmd.command))
                return false;
            return cmd.command.some(part => part.includes(hookScriptPath));
        });
    });
}
/**
 * Count OpenCode hooks
 */
function countOpenCodeHooks(settings) {
    if (!settings.experimental?.anthropicHooks) {
        return 0;
    }
    let count = 0;
    exports.OPENCODE_HOOK_TYPES.forEach(hookType => {
        const commands = settings.experimental?.anthropicHooks?.[hookType];
        if (commands && Array.isArray(commands)) {
            count += commands.length;
        }
    });
    return count;
}
/**
 * Get the display name for a hook type
 */
function getHookTypeDisplayName(hookType) {
    const displayNames = {
        PreToolUse: 'Pre Tool Use',
        PostToolUse: 'Post Tool Use',
        Notification: 'Notification',
        Stop: 'Stop',
        SubagentStop: 'Subagent Stop',
        PreCompact: 'Pre Compact',
        tool_call: 'Tool Call',
        file_read: 'File Read',
        file_edited: 'File Edited',
        web_access: 'Web Access',
        session_stop: 'Session Stop',
    };
    return displayNames[hookType] || hookType;
}
/**
 * Get the description for a hook type
 */
function getHookTypeDescription(hookType) {
    const descriptions = {
        PreToolUse: 'Runs before a tool is executed',
        PostToolUse: 'Runs after a tool is executed',
        Notification: 'Handles agent notifications',
        Stop: 'Runs when the agent stops',
        SubagentStop: 'Runs when a subagent stops',
        PreCompact: 'Runs before context compaction',
        tool_call: 'Runs when any tool is called',
        file_read: 'Runs when a file is read',
        file_edited: 'Runs when a file is edited',
        web_access: 'Runs when web content is accessed',
        session_stop: 'Runs when the session stops',
    };
    return descriptions[hookType] || 'Custom hook type';
}
/**
 * Check if a hook type uses matchers
 * Some hook types (like Stop) don't use matchers
 */
function hookTypeUsesMatchers(hookType) {
    const noMatcherTypes = ['Stop', 'SubagentStop', 'session_stop'];
    return !noMatcherTypes.includes(hookType);
}
/**
 * Get the default matcher for a hook type
 */
function getDefaultMatcher(hookType) {
    if (!hookTypeUsesMatchers(hookType)) {
        return '';
    }
    return '*'; // Default to wildcard for most hook types
}
/**
 * Get available hook types for a specific agent
 */
function getAvailableHookTypes(agent) {
    switch (agent) {
        case 'claude':
            return exports.CLAUDE_HOOK_TYPES;
        case 'gemini':
            return exports.GEMINI_HOOK_TYPES;
        case 'opencode':
            return exports.OPENCODE_HOOK_TYPES;
        default:
            return [];
    }
}
/**
 * Configure hooks for any supported agent
 * This is a generic function that delegates to agent-specific implementations
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns Modified settings object with hooks configured
 */
function configureAgentHooks(agent, settings, hookScriptPath) {
    switch (agent) {
        case 'claude':
            return configureClaudeHooks(settings, hookScriptPath);
        case 'gemini':
            return configureGeminiHooks(settings, hookScriptPath);
        case 'opencode':
            return configureOpenCodeHooks(settings, hookScriptPath);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
/**
 * Remove hooks configuration for any supported agent
 *
 * @param agent - The agent type
 * @param settings - Current agent settings object
 * @param hookScriptPath - Full path to the hook script to remove
 * @returns Modified settings object with hooks removed
 */
function removeAgentHooks(agent, settings, hookScriptPath) {
    switch (agent) {
        case 'claude':
            return removeClaudeHooks(settings, hookScriptPath);
        case 'gemini':
            return removeGeminiHooks(settings, hookScriptPath);
        case 'opencode':
            return removeOpenCodeHooks(settings, hookScriptPath);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
/**
 * Check if an agent has a specific hook script configured
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @param hookScriptPath - Full path to the hook script
 * @returns True if the hook script is configured
 */
function hasAgentHook(agent, settings, hookScriptPath) {
    switch (agent) {
        case 'claude':
            return hasClaudeHook(settings, hookScriptPath);
        case 'gemini':
            return hasGeminiHook(settings, hookScriptPath);
        case 'opencode':
            return hasOpenCodeHook(settings, hookScriptPath);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
/**
 * Count total number of hooks configured for an agent
 *
 * @param agent - The agent type
 * @param settings - Agent settings object
 * @returns Total number of hook commands configured
 */
function countAgentHooks(agent, settings) {
    switch (agent) {
        case 'claude':
            return countClaudeHooks(settings);
        case 'gemini':
            return countGeminiHooks(settings);
        case 'opencode':
            return countOpenCodeHooks(settings);
        default:
            throw new Error(`Unsupported agent: ${agent}`);
    }
}
