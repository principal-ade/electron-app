#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * Main executable for the PrincipalAI MCP server
 */
import { BRANDING } from '../constants/branding';
import { McpServer } from './server';
// Export all public APIs
export { McpServer } from './server';
export { BaseTool } from './tools';
// Run server if executed directly
if (require.main === module) {
    const config = {
        name: BRANDING.MCP_SERVER_NAME,
        version: BRANDING.MCP_VERSION,
        httpBridgePort: parseInt(process.env.HTTP_BRIDGE_PORT || '3042'),
        httpBridgeHost: process.env.HTTP_BRIDGE_HOST || 'localhost',
        httpBridgePath: process.env.HTTP_BRIDGE_PATH || '/mcp-message',
    };
    const server = new McpServer(config);
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.error('\nShutting down MCP server...');
        await server.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.error('\nShutting down MCP server...');
        await server.stop();
        process.exit(0);
    });
    // Start the server
    server.start().catch(error => {
        console.error('❌ Failed to start MCP server:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map