/**
 * @deprecated This file is deprecated. Use McpToolsService from src/renderer/main-process-api/McpToolsService.ts instead.
 *
 * This file provides a compatibility layer during migration.
 * All functionality has been moved to the structured MainProcessAPI pattern.
 */
import { McpToolsService } from '../../main-process-api/McpToolsService';
// Compatibility wrapper that delegates to the new service
export const mcp = {
    getServers: async () => {
        try {
            return await McpToolsService.getServers();
        }
        catch (error) {
            console.warn('mcp.getServers error:', error);
            return [];
        }
    },
    getTools: async (serverName) => {
        try {
            return await McpToolsService.getTools(serverName);
        }
        catch (error) {
            console.warn('mcp.getTools error:', error);
            return [];
        }
    },
    callTool: async (params) => {
        try {
            // Note: 'args' in old API vs 'arguments' in new API
            return await McpToolsService.callTool({
                ...params,
                arguments: params.args
            });
        }
        catch (error) {
            console.warn('mcp.callTool error:', error);
            return null;
        }
    },
    startServer: async (serverName) => {
        try {
            await McpToolsService.startServer(serverName);
        }
        catch (error) {
            console.warn('mcp.startServer error:', error);
        }
    },
    stopServer: async (serverName) => {
        try {
            await McpToolsService.stopServer(serverName);
        }
        catch (error) {
            console.warn('mcp.stopServer error:', error);
        }
    },
    restartServer: async (serverName) => {
        try {
            await McpToolsService.restartServer(serverName);
        }
        catch (error) {
            console.warn('mcp.restartServer error:', error);
        }
    },
    sendMessage: async (params) => {
        try {
            return await McpToolsService.sendMessage(params);
        }
        catch (error) {
            console.warn('mcp.sendMessage error:', error);
            return null;
        }
    },
    getConfig: async () => {
        try {
            return await McpToolsService.getConfig();
        }
        catch (error) {
            console.warn('mcp.getConfig error:', error);
            return null;
        }
    },
    updateConfig: async (config) => {
        try {
            await McpToolsService.updateConfig(config);
        }
        catch (error) {
            console.warn('mcp.updateConfig error:', error);
        }
    },
    openConfig: async () => {
        try {
            await McpToolsService.openConfig();
        }
        catch (error) {
            console.warn('mcp.openConfig error:', error);
        }
    },
    checkClaudeCli: async () => {
        try {
            return await McpToolsService.checkClaudeCli();
        }
        catch (error) {
            console.warn('mcp.checkClaudeCli error:', error);
            return { installed: false, error: 'Not available' };
        }
    },
    // Event listeners
    onLog: (callback) => {
        try {
            return McpToolsService.onLog(callback);
        }
        catch (error) {
            console.warn('mcp.onLog error:', error);
            return () => { };
        }
    },
    onServersDiscovered: (callback) => {
        try {
            return McpToolsService.onServersDiscovered(callback);
        }
        catch (error) {
            console.warn('mcp.onServersDiscovered error:', error);
            return () => { };
        }
    },
    onServerStarted: (callback) => {
        try {
            return McpToolsService.onServerStarted(callback);
        }
        catch (error) {
            console.warn('mcp.onServerStarted error:', error);
            return () => { };
        }
    },
    onServerStopped: (callback) => {
        try {
            return McpToolsService.onServerStopped(callback);
        }
        catch (error) {
            console.warn('mcp.onServerStopped error:', error);
            return () => { };
        }
    },
};
