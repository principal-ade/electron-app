import { InstallationInfo } from './install-types';
/**
 * Supported AI coding assistant CLI types
 */
export declare enum SupportedAgent {
    CLAUDE = "claude",
    GEMINI = "gemini",
    OPENCODE = "opencode"
}
/**
 * Array of supported agents for backward compatibility and iteration
 */
export declare const SUPPORTED_AGENTS: SupportedAgent[];
/**
 * Check if a string is a valid supported agent
 * @param agent - The string to check
 * @returns True if the string is a valid supported agent
 */
export declare function isSupportedAgent(agent: string): agent is SupportedAgent;
/**
 * Agent metadata and configuration
 */
export interface AgentInfo {
    name: string;
    displayName: string;
    installation: InstallationInfo;
    openSource: {
        isOpenSource: boolean;
        license?: string;
        repository?: string;
        supportsHooks?: boolean;
        hookSupportingFork?: string;
    };
    documentation: {
        hooks?: string;
        general?: string;
        setup?: string;
    };
    ui: {
        color: string;
        downloadUrl: string;
        description?: string;
    };
    settingsSchema?: string;
    settingsPath: string;
    hooksConfigurationPath: string;
    mcpConfigurationPath: string;
    bridgeRoute: string;
    hookPath: string;
    fallbackFileName: string;
    errorFileName: string;
    storageEventsNamespace: string;
}
/**
 * Centralized agent information
 */
export declare const AGENT_INFO: Record<SupportedAgent, AgentInfo>;
/**
 * Get agent info by agent type
 * @param agent - The agent type
 * @returns The agent info object
 */
export declare function getAgentInfo(agent: SupportedAgent): AgentInfo;
/**
 * Get agent installation command
 * @param agent - The agent type
 * @returns Installation command or null if not applicable
 */
export declare function getAgentInstallCommand(agent: SupportedAgent): string | null;
//# sourceMappingURL=supported-agents.d.ts.map