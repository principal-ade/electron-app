#!/usr/bin/env node
"use strict";
/**
 * MCP Server Entry Point
 * Main executable for the PrincipalAI MCP server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = exports.McpServer = void 0;
const branding_1 = require("../constants/branding");
const server_1 = require("./server");
// Export all public APIs
var server_2 = require("./server");
Object.defineProperty(exports, "McpServer", { enumerable: true, get: function () { return server_2.McpServer; } });
var tools_1 = require("./tools");
Object.defineProperty(exports, "BaseTool", { enumerable: true, get: function () { return tools_1.BaseTool; } });
// Run server if executed directly
if (require.main === module) {
    const config = {
        name: branding_1.BRANDING.MCP_SERVER_NAME,
        version: branding_1.BRANDING.MCP_VERSION,
        httpBridgePort: parseInt(process.env.HTTP_BRIDGE_PORT || '3042'),
        httpBridgeHost: process.env.HTTP_BRIDGE_HOST || 'localhost',
        httpBridgePath: process.env.HTTP_BRIDGE_PATH || '/mcp-message',
    };
    const server = new server_1.McpServer(config);
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
