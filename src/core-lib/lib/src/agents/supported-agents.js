/**
 * Supported AI coding assistant CLI types
 */
export var SupportedAgent;
(function (SupportedAgent) {
    SupportedAgent["CLAUDE"] = "claude";
    SupportedAgent["GEMINI"] = "gemini";
    SupportedAgent["OPENCODE"] = "opencode";
})(SupportedAgent || (SupportedAgent = {}));
/**
 * Array of supported agents for backward compatibility and iteration
 */
export const SUPPORTED_AGENTS = Object.values(SupportedAgent);
/**
 * Check if a string is a valid supported agent
 * @param agent - The string to check
 * @returns True if the string is a valid supported agent
 */
export function isSupportedAgent(agent) {
    return SUPPORTED_AGENTS.includes(agent);
}
/**
 * Centralized agent information
 */
export const AGENT_INFO = {
    [SupportedAgent.CLAUDE]: {
        name: 'claude',
        displayName: 'Claude Code',
        installation: {
            source: 'github-release',
            artifactType: 'native-binary',
            runtime: 'none',
            binaryName: 'claude',
            requiresWrapper: false,
            platformSpecific: true,
        },
        openSource: {
            isOpenSource: false,
            repository: 'https://github.com/anthropics/claude-code',
        },
        documentation: {
            hooks: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
            general: 'https://docs.anthropic.com/en/docs/claude-code',
            setup: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
        },
        ui: {
            color: '#da7756',
            downloadUrl: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
            description: "Anthropic's AI assistant for code",
        },
        settingsSchema: 'https://json.schemastore.org/claude-code-settings.json',
        settingsPath: '~/.claude/settings.json',
        hooksConfigurationPath: '~/.claude/settings.json',
        mcpConfigurationPath: '~/.claude.json',
        hookPath: 'hooks/claude-hook.cjs',
        bridgeRoute: 'claude-hook',
        fallbackFileName: 'claude-hook-events.json',
        errorFileName: 'claude-hook-events-errors.json',
        storageEventsNamespace: 'claude-hook-events',
    },
    [SupportedAgent.GEMINI]: {
        name: 'gemini',
        displayName: 'Gemini Cli',
        installation: {
            source: 'github-release',
            artifactType: 'node-module-esm',
            runtime: 'node',
            githubRepo: 'principle-md/gemini-cli',
            binaryName: 'principal-gemini',
            assetName: 'gemini.mjs',
            requiresWrapper: true,
            platformSpecific: false,
        },
        openSource: {
            isOpenSource: true,
            license: 'MIT',
            repository: 'https://github.com/google-gemini/gemini-cli',
            supportsHooks: false,
            hookSupportingFork: 'https://github.com/principle-md/gemini-cli',
        },
        documentation: {
            general: 'https://cloud.google.com/gemini/docs/code-assist',
        },
        ui: {
            color: '#4796E3',
            downloadUrl: 'https://github.com/principle-md/gemini-cli/tree/add-hooks-feature',
            description: "Google's AI code assistant with hooks support",
        },
        settingsSchema: 'https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/settings.ts',
        settingsPath: '~/.gemini/settings.json',
        hooksConfigurationPath: '~/.gemini/settings.json',
        mcpConfigurationPath: '~/.gemini/settings.json',
        bridgeRoute: 'gemini-hook',
        hookPath: 'hooks/gemini-hook.cjs',
        fallbackFileName: 'gemini-hook-events.json',
        errorFileName: 'gemini-hook-events-errors.json',
        storageEventsNamespace: 'gemini-hook-events',
    },
    [SupportedAgent.OPENCODE]: {
        name: 'opencode',
        displayName: 'OpenCode',
        installation: {
            source: 'github-release',
            artifactType: 'native-binary',
            runtime: 'none',
            githubRepo: 'principle-md/opencode',
            binaryName: 'principal-opencode',
            requiresWrapper: false,
            platformSpecific: true,
        },
        openSource: {
            isOpenSource: true,
            license: 'MIT',
            repository: 'https://github.com/sst/opencode',
            supportsHooks: true,
            hookSupportingFork: 'https://github.com/principle-md/opencode',
        },
        documentation: {
            general: 'https://github.com/opencodeinterpreter/opencode#readme',
        },
        ui: {
            color: '#10B981',
            downloadUrl: 'https://github.com/opencodeinterpreter/opencode/releases',
            description: 'Open source code interpreter with AI assistance',
        },
        settingsSchema: 'https://opencode.ai/config.json',
        settingsPath: '~/.config/openCode/openCode.json',
        hooksConfigurationPath: '~/.config/openCode/openCode.json',
        mcpConfigurationPath: '~/.config/openCode/openCode.json',
        bridgeRoute: 'opencode-hook',
        hookPath: 'hooks/opencode-hook.cjs',
        fallbackFileName: 'opencode-hook-events.json',
        errorFileName: 'opencode-hook-events-errors.json',
        storageEventsNamespace: 'opencode-hook-events',
    },
};
/**
 * Get agent info by agent type
 * @param agent - The agent type
 * @returns The agent info object
 */
export function getAgentInfo(agent) {
    return AGENT_INFO[agent];
}
/**
 * Get agent installation command
 * @param agent - The agent type
 * @returns Installation command or null if not applicable
 */
export function getAgentInstallCommand(agent) {
    const info = AGENT_INFO[agent];
    const install = info.installation;
    switch (install.source) {
        case 'npm-registry':
            return install.npmPackage ? `npm install -g ${install.npmPackage}` : null;
        case 'homebrew':
            return install.brewFormula ? `brew install ${install.brewFormula}` : null;
        case 'custom-installer':
            return `Visit ${install.installerUrl} to download the installer`;
        case 'github-release':
            // GitHub releases are handled by our installation service
            return null;
        default:
            return null;
    }
}
//# sourceMappingURL=supported-agents.js.map