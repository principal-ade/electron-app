import { SupportedAgent } from '@principal-ai/agent-monitoring';
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
export declare class HookConfigurationManagerV2 {
    private static instance;
    private claudeManager;
    private constructor();
    static getInstance(): HookConfigurationManagerV2;
    /**
     * Add hooks to an agent's configuration
     */
    addHooks(agentType: SupportedAgent): Promise<HookOperationResult>;
    /**
     * Remove hooks from an agent's configuration
     */
    removeHooks(agentType: SupportedAgent): Promise<HookOperationResult>;
    /**
     * Get the status of hooks for an agent
     */
    getHookStatus(agentType: SupportedAgent): Promise<HookConfigStatus>;
    /**
     * Check if an agent has a specific hook type configured
     */
    hasHook(agentType: SupportedAgent, hookType: string): Promise<boolean>;
    /**
     * Count the number of hooks configured for an agent
     */
    countHooks(agentType: SupportedAgent): Promise<number>;
    /**
     * Check if an agent is supported for hook configuration
     */
    private checkAgentSupport;
    /**
     * Get the configuration path for an agent
     */
    getConfigPath(agentType: SupportedAgent): string;
}
//# sourceMappingURL=HookConfigurationManagerV2.d.ts.map