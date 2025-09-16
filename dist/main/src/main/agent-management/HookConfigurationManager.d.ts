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
 * Manages hook configuration for different AI agents.
 * This class encapsulates all logic for adding, removing, and managing hooks
 * for Claude, Gemini, and OpenCode agents.
 *
 * Future: This will be extracted into an NPX package that can be called via:
 * - npx @principal-ai/agent-hooks claude-hook --enable --port 3043 --dir ~/a24z/
 * - npx @principal-ai/agent-hooks gemini-hook --enable --port 3043 --dir ~/a24z/
 * - npx @principal-ai/agent-hooks opencode-hook --enable --port 3043 --dir ~/a24z/
 */
export declare class HookConfigurationManager {
    private static instance;
    private readonly CLAUDE_HOOK_TYPES;
    private readonly GEMINI_HOOK_TYPES;
    private readonly OPENCODE_HOOK_TYPES;
    private constructor();
    static getInstance(): HookConfigurationManager;
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
     * Check if an agent type is supported for hook configuration
     */
    private checkAgentSupport;
    /**
     * Get the NPX command for a specific agent
     */
    private getNpxCommand;
    /**
     * Configure hooks for a specific agent type
     */
    private configureHooksForAgent;
    /**
     * Configure Claude hooks with ALL available hook types
     */
    private configureClaudeHooks;
    /**
     * Count hooks for a specific agent type
     */
    private countHooksForAgent;
    /**
     * Get the configuration file path for an agent
     */
    private getConfigPath;
    /**
     * Expand home directory in path
     */
    private expandHome;
    /**
     * Read agent settings from file
     */
    private readAgentSettings;
    /**
     * Write agent settings to file
     */
    private writeAgentSettings;
    /**
     * Future NPX interface - these methods simulate what the NPX package will do
     */
    executeNpxCommand(command: string, agentType: SupportedAgent, action: 'enable' | 'disable' | 'status'): Promise<void>;
}
//# sourceMappingURL=HookConfigurationManager.d.ts.map