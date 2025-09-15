/**
 * Configuration file for Claude Code CLI settings
 */
export interface ClaudeConfigConfig {
    $schema?: string;
    apiKeyHelper?: string;
    cleanupPeriodDays?: number;
    env?: any;
    includeCoAuthoredBy?: boolean;
    model?: string;
    permissions?: {
        allow?: any[];
        deny?: any[];
        defaultMode?: string;
        disableBypassPermissionsMode?: string;
        additionalDirectories?: string[];
    };
    enableAllProjectMcpServers?: boolean;
    enabledMcpjsonServers?: string[];
    disabledMcpjsonServers?: string[];
    hooks?: {
        PreToolUse?: any[];
        PostToolUse?: any[];
        Notification?: any[];
        Stop?: any[];
        SubagentStop?: any[];
    };
    learnMode?: boolean;
    forceLoginMethod?: string;
    [key: string]: any;
}
export interface OpencodeConfigConfig {
    $schema?: string;
    theme?: string;
    keybinds?: {
        leader?: string;
        app_help?: string;
        [key: string]: any;
    };
    experimental?: {
        anthropicHooks?: any;
        [key: string]: any;
    };
    [key: string]: any;
}
