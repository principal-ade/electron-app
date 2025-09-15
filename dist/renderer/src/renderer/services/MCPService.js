import { McpToolsService } from '../main-process-api/McpToolsService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { APP_BRANDING } from '../../shared/config/appBranding';
export class MCPService {
    static instance;
    logs = [];
    listeners = new Set();
    constructor() {
        this.setupIPCListeners();
    }
    static getInstance() {
        if (!MCPService.instance) {
            MCPService.instance = new MCPService();
        }
        return MCPService.instance;
    }
    setupIPCListeners() {
        McpToolsService.onLog((log) => {
            const mcpMessage = {
                type: log.type || 'notification',
                content: log,
                timestamp: Date.now(),
            };
            this.addLog(mcpMessage);
        });
        McpToolsService.onServersDiscovered((servers) => {
            console.log('MCP servers discovered:', servers);
        });
        McpToolsService.onServerStarted((serverInfo) => {
            console.log('MCP server started:', serverInfo);
        });
        McpToolsService.onServerStopped((serverName) => {
            console.log('MCP server stopped:', serverName);
        });
    }
    addLog(log) {
        this.logs.push(log);
        // Keep only last 1000 logs
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }
        // Notify all listeners
        this.listeners.forEach((listener) => listener(log));
    }
    // Public API
    async getAvailableServers() {
        try {
            const servers = await McpToolsService.getServers();
            return servers || [];
        }
        catch (error) {
            console.error('Error getting MCP servers:', error);
            return [];
        }
    }
    async getServerTools(serverName) {
        try {
            const tools = await McpToolsService.getTools(serverName);
            return tools || [];
        }
        catch (error) {
            console.error('Error getting MCP tools:', error);
            return [];
        }
    }
    async callTool(serverName, toolName, args) {
        try {
            const result = await McpToolsService.callTool({
                serverName,
                toolName,
                arguments: args,
            });
            return result;
        }
        catch (error) {
            console.error('Error calling MCP tool:', error);
            throw error;
        }
    }
    async startServer(serverName) {
        try {
            await McpToolsService.startServer(serverName);
            return true;
        }
        catch (error) {
            console.error('Error starting MCP server:', error);
            return false;
        }
    }
    async stopServer(serverName) {
        try {
            await McpToolsService.stopServer(serverName);
            return true;
        }
        catch (error) {
            console.error('Error stopping MCP server:', error);
            return false;
        }
    }
    async restartServer(serverName) {
        try {
            await McpToolsService.restartServer(serverName);
            return true;
        }
        catch (error) {
            console.error('Error restarting MCP server:', error);
            return false;
        }
    }
    async sendMessage(content) {
        try {
            const result = await McpToolsService.sendMessage({ content });
            return result;
        }
        catch (error) {
            console.error('Error sending MCP message:', error);
            throw error;
        }
    }
    // Log management
    getLogs() {
        return [...this.logs];
    }
    clearLogs() {
        this.logs = [];
    }
    onLogAdded(callback) {
        this.listeners.add(callback);
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }
    // Configuration
    async getMCPConfig() {
        try {
            const config = await McpToolsService.getConfig();
            return config;
        }
        catch (error) {
            console.error('Error getting MCP config:', error);
            return null;
        }
    }
    async updateMCPConfig(config) {
        try {
            await McpToolsService.updateConfig(config);
            return true;
        }
        catch (error) {
            console.error('Error updating MCP config:', error);
            return false;
        }
    }
    async openMCPConfig() {
        try {
            await McpToolsService.openConfig();
        }
        catch (error) {
            console.error('Error opening MCP config:', error);
        }
    }
    // Claude configuration methods
    async enableMcpServer(serverId) {
        try {
            const [homeDir, projectPath, mcpServerPath] = await Promise.all([
                FileSystemService.getHomePath(),
                FileSystemService.getCurrentWorkingDirectory(),
                McpToolsService.getResolvedMcpScriptPath(),
            ]);
            const claudeConfigPath = `${homeDir}/.claude.json`;
            const result = await FileSystemService.readFile(claudeConfigPath);
            let config = {};
            if (result?.content) {
                config = JSON.parse(result.content);
            }
            // Initialize project config if it doesn't exist
            if (!config.projects) {
                config.projects = {};
            }
            if (!config.projects[projectPath]) {
                config.projects[projectPath] = {
                    allowedTools: [],
                    history: [],
                    mcpContextUris: [],
                    mcpServers: {},
                    enabledMcpjsonServers: [],
                    disabledMcpjsonServers: [],
                    hasTrustDialogAccepted: false,
                    projectOnboardingSeenCount: 0,
                    hasClaudeMdExternalIncludesApproved: false,
                    hasClaudeMdExternalIncludesWarningShown: false,
                };
            }
            // Enable MCP server by adding it
            if (!config.projects[projectPath].mcpServers) {
                config.projects[projectPath].mcpServers = {};
            }
            config.projects[projectPath].mcpServers[serverId] = {
                type: 'stdio',
                command: 'node',
                args: [mcpServerPath],
                env: {},
            };
            // Write updated config back
            const writeResult = await FileSystemService.writeFile(claudeConfigPath, JSON.stringify(config, null, 2));
            if (writeResult?.success) {
                return { success: true };
            }
            return { success: false, error: 'Failed to write configuration file' };
        }
        catch (error) {
            console.error('Error enabling MCP server:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async disableMcpServer(serverId) {
        try {
            const [homeDir, projectPath] = await Promise.all([
                FileSystemService.getHomePath(),
                FileSystemService.getCurrentWorkingDirectory(),
            ]);
            const claudeConfigPath = `${homeDir}/.claude.json`;
            const result = await FileSystemService.readFile(claudeConfigPath);
            if (!result?.content) {
                return { success: false, error: 'Configuration file not found' };
            }
            const config = JSON.parse(result.content);
            // Remove MCP server
            if (config.projects?.[projectPath]?.mcpServers?.[serverId]) {
                delete config.projects[projectPath].mcpServers[serverId];
                // Write updated config back
                const writeResult = await FileSystemService.writeFile(claudeConfigPath, JSON.stringify(config, null, 2));
                if (writeResult?.success) {
                    return { success: true };
                }
                return { success: false, error: 'Failed to write configuration file' };
            }
            return { success: true }; // Already disabled
        }
        catch (error) {
            console.error('Error disabling MCP server:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    // Get the manual CLI command for adding our MCP server
    async getManualMCPCommand() {
        try {
            const mcpServerPath = await McpToolsService.getResolvedMcpScriptPath();
            return `claude mcp add ${APP_BRANDING.MCP_SERVER_CONFIG_KEY} -- node "${mcpServerPath}"`;
        }
        catch (error) {
            console.error('Error getting MCP command:', error);
            return `claude mcp add ${APP_BRANDING.MCP_SERVER_CONFIG_KEY} -- node <path-to-${APP_BRANDING.MCP_SERVER_CONFIG_KEY}-server>`;
        }
    }
    // Add our MCP server to ALL projects in the config file
    async addMCPToAllProjects() {
        try {
            const [homeDir, mcpServerPath] = await Promise.all([
                FileSystemService.getHomePath(),
                McpToolsService.getResolvedMcpScriptPath(),
            ]);
            const claudeConfigPath = `${homeDir}/.claude.json`;
            const result = await FileSystemService.readFile(claudeConfigPath);
            let config = {};
            if (result?.content) {
                config = JSON.parse(result.content);
            }
            // Initialize projects if it doesn't exist
            if (!config.projects) {
                config.projects = {};
            }
            let projectsUpdated = 0;
            // Add MCP server to all existing projects
            for (const projectPath in config.projects) {
                if (!config.projects[projectPath].mcpServers) {
                    config.projects[projectPath].mcpServers = {};
                }
                // Only add if not already present
                if (!config.projects[projectPath].mcpServers[APP_BRANDING.MCP_SERVER_CONFIG_KEY]) {
                    config.projects[projectPath].mcpServers[APP_BRANDING.MCP_SERVER_CONFIG_KEY] = {
                        type: 'stdio',
                        command: 'node',
                        args: [mcpServerPath],
                        env: {},
                    };
                    projectsUpdated++;
                }
            }
            // Write updated config back
            const writeResult = await FileSystemService.writeFile(claudeConfigPath, JSON.stringify(config, null, 2));
            if (writeResult?.success) {
                return { success: true, projectsUpdated };
            }
            return { success: false, error: 'Failed to write configuration file' };
        }
        catch (error) {
            console.error('Error adding MCP to all projects:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    // Get all projects and their MCP status
    async getAllProjectsWithMCPStatus() {
        try {
            const homeDir = await FileSystemService.getHomePath();
            const claudeConfigPath = `${homeDir}/.claude.json`;
            const result = await FileSystemService.readFile(claudeConfigPath);
            if (!result?.content) {
                return { success: true, projects: [] };
            }
            const config = JSON.parse(result.content);
            const projects = [];
            if (config.projects) {
                for (const [projectPath, projectConfig] of Object.entries(config.projects)) {
                    const mcpServers = projectConfig?.mcpServers || {};
                    const hasPrincipleMD = !!mcpServers[APP_BRANDING.MCP_SERVER_CONFIG_KEY];
                    projects.push({
                        path: projectPath,
                        hasPrincipleMD,
                        mcpServers,
                    });
                }
            }
            return { success: true, projects };
        }
        catch (error) {
            console.error('Error getting projects with MCP status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    // Toggle MCP server for a specific project
    async toggleMCPForProject(projectPath, enable) {
        try {
            const [homeDir, mcpServerPath] = await Promise.all([
                FileSystemService.getHomePath(),
                enable
                    ? McpToolsService.getResolvedMcpScriptPath()
                    : Promise.resolve(''),
            ]);
            const claudeConfigPath = `${homeDir}/.claude.json`;
            const result = await FileSystemService.readFile(claudeConfigPath);
            let config = {};
            if (result?.content) {
                config = JSON.parse(result.content);
            }
            // Initialize projects if it doesn't exist
            if (!config.projects) {
                config.projects = {};
            }
            // Initialize project config if it doesn't exist
            if (!config.projects[projectPath]) {
                config.projects[projectPath] = {
                    allowedTools: [],
                    history: [],
                    mcpContextUris: [],
                    mcpServers: {},
                    enabledMcpjsonServers: [],
                    disabledMcpjsonServers: [],
                    hasTrustDialogAccepted: false,
                    projectOnboardingSeenCount: 0,
                    hasClaudeMdExternalIncludesApproved: false,
                    hasClaudeMdExternalIncludesWarningShown: false,
                };
            }
            if (!config.projects[projectPath].mcpServers) {
                config.projects[projectPath].mcpServers = {};
            }
            if (enable) {
                // Add MCP server
                config.projects[projectPath].mcpServers[APP_BRANDING.MCP_SERVER_CONFIG_KEY] = {
                    type: 'stdio',
                    command: 'node',
                    args: [mcpServerPath],
                    env: {},
                };
            }
            else {
                // Remove MCP server
                delete config.projects[projectPath].mcpServers[APP_BRANDING.MCP_SERVER_CONFIG_KEY];
            }
            // Write updated config back
            const writeResult = await FileSystemService.writeFile(claudeConfigPath, JSON.stringify(config, null, 2));
            if (writeResult?.success) {
                return { success: true };
            }
            return { success: false, error: 'Failed to write configuration file' };
        }
        catch (error) {
            console.error('Error toggling MCP for project:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    // These methods are deprecated - use the main process IPC handlers instead
    // Keeping for backward compatibility but they should not be used
    async getGeminiMCPStatus() {
        console.warn('MCPService.getGeminiMCPStatus is deprecated. Use main process handlers instead.');
        return { success: false, error: 'Deprecated method' };
    }
    async toggleGeminiMCP(enable) {
        console.warn('MCPService.toggleGeminiMCP is deprecated. Use main process handlers instead.');
        return { success: false, error: 'Deprecated method' };
    }
}
// Export singleton instance
export const mcpService = MCPService.getInstance();
